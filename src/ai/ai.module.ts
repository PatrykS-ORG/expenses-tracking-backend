import { Module } from '@nestjs/common';
import { ReceiptOcrModule } from '../receipts/receipt-ocr.module';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { AiService } from './ai.service';

@Module({
  imports: [ReceiptOcrModule, AiUsageModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
