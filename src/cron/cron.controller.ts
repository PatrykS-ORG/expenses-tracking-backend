import { Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { CronAuthGuard } from './cron-auth.guard';
import { SummaryService } from '../summary/summary.service';

@Controller('api/cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(private readonly summaryService: SummaryService) {}

  @Post('process-summaries')
  @UseGuards(CronAuthGuard)
  async processSummaries() {
    const result = await this.summaryService.processDueSummaries();
    this.logger.log(`Cron summary run completed: ${JSON.stringify(result)}`);
    return result;
  }
}
