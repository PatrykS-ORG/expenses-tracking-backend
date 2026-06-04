import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
    return { id: payload.sub, email: payload.email, roles: payload.role };
  }
}
