import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import {
  isProductionEnv,
  parseTestNow,
  runWithMonthCloseNow,
} from './month-close.clock';

@Injectable()
export class MonthCloseNowMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    if (isProductionEnv(this.configService.get<string>('NODE_ENV'))) {
      next();
      return;
    }

    const header = req.headers['x-test-now'];
    const headerValue = Array.isArray(header) ? header[0] : header;
    const fromHeader = parseTestNow(headerValue);
    const fromEnv = parseTestNow(
      this.configService.get<string>('TEST_NOW_ISO'),
    );
    const now = fromHeader ?? fromEnv;
    if (!now) {
      next();
      return;
    }

    runWithMonthCloseNow(now, () => next());
  }
}
