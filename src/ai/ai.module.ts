import { Module } from '@nestjs/common';
import { ReceiptOcrModule } from '../receipts/receipt-ocr.module';
import { AiService } from './ai.service';

@Module({
  imports: [ReceiptOcrModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
