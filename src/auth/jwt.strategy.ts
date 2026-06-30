import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';

interface SupabaseJwtPayload {
  sub?: string;
  email?: string;
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private configService: ConfigService) {
    const supabaseUrl = configService
      .get<string>('SUPABASE_URL', '')
      .replace(/\/$/, '');
    const legacySecret = configService
      .get<string>('SUPABASE_JWT_SECRET', '')
      .trim();

    if (!supabaseUrl && !legacySecret) {
      throw new Error(
        'Configure SUPABASE_URL (asymmetric JWKS) or SUPABASE_JWT_SECRET (legacy HS256)',
      );
    }

    super(
      supabaseUrl
        ? {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKeyProvider: passportJwtSecret({
              cache: true,
              rateLimit: true,
              jwksRequestsPerMinute: 5,
              jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
            }),
            algorithms: ['ES256'],
            issuer: `${supabaseUrl}/auth/v1`,
            audience: 'authenticated',
          }
        : {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: legacySecret,
            algorithms: ['HS256'],
          },
    );
  }

  validate(payload: SupabaseJwtPayload) {
    const userId = payload.sub?.trim();
    if (!userId) {
      this.logger.warn('JWT payload rejected: missing required sub claim');
      throw new UnauthorizedException('Invalid authentication token payload');
    }

    const email = payload.email?.trim() || undefined;
    return { id: userId, email, roles: payload.role };
  }
}
