import { Module } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { SummaryResolver } from './summary.resolver';
import { AiModule } from '../ai/ai.module';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { EmailModule } from '../email/email.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    AiModule,
    AiUsageModule,
    EmailModule,
    DataSourcesModule,
    UsersModule,
  ],
  providers: [SummaryService, SummaryResolver],
  exports: [SummaryService],
})
export class SummaryModule {}
