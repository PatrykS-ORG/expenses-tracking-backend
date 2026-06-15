import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class CronAuthGuard implements CanActivate {
  private readonly cronSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.cronSecret = this.configService.get<string>('CRON_SECRET') ?? '';
    if (!this.cronSecret) {
      throw new Error('Missing required configuration: CRON_SECRET');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing cron authorization token');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (token !== this.cronSecret) {
      throw new UnauthorizedException('Invalid cron authorization token');
    }

    return true;
  }
}
