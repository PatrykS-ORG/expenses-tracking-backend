import { Module } from '@nestjs/common';
import { CronController } from './cron.controller';
import { CronAuthGuard } from './cron-auth.guard';
import { SummaryModule } from '../summary/summary.module';

@Module({
  imports: [SummaryModule],
  controllers: [CronController],
  providers: [CronAuthGuard],
})
export class CronModule {}
