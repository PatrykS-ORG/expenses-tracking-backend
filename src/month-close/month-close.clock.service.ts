import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveMonthCloseNow } from './month-close.clock';

@Injectable()
export class MonthCloseClock {
  constructor(private readonly configService: ConfigService) {}

  now(explicit?: string | Date | null): Date {
    return resolveMonthCloseNow({
      explicit,
      envNow: this.configService.get<string>('TEST_NOW_ISO'),
      nodeEnv: this.configService.get<string>('NODE_ENV'),
    });
  }
}
