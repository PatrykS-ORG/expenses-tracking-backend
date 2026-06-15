import { Controller, Post, UseGuards } from '@nestjs/common';
import { CronAuthGuard } from './cron-auth.guard';
import { SummaryService } from '../summary/summary.service';

@Controller('api/cron')
export class CronController {
  constructor(private readonly summaryService: SummaryService) {}

  @Post('process-summaries')
  @UseGuards(CronAuthGuard)
  async processSummaries() {
    return this.summaryService.processDueSummaries();
  }
}
