import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { TemplatesModule } from '../templates/templates.module';
import { ReceiptsResolver } from './receipts.resolver';
import { ReceiptsService } from './receipts.service';

@Module({
  imports: [AiModule, DataSourcesModule, TemplatesModule],
  providers: [ReceiptsResolver, ReceiptsService],
})
export class ReceiptsModule {}
