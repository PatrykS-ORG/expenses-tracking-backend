import { Module } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { SummaryResolver } from './summary.resolver';
import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';

@Module({
  imports: [AiModule, EmailModule, DataSourcesModule],
  providers: [SummaryService, SummaryResolver],
  exports: [SummaryService],
})
export class SummaryModule {}
