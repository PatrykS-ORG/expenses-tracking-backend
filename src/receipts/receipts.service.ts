import { decodeUploadedFile } from '../common/decode-uploaded-file';
import { BadRequestException, Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { SupabaseStorageService } from '../data-sources/supabase-storage.service';
import { ScanReceiptInput } from './dto/scan-receipt.input';
import { ReceiptScanResult } from './models/receipt-scan-result.model';
import { TemplatesService } from '../templates/templates.service';

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly storageService: SupabaseStorageService,
    private readonly templatesService: TemplatesService,
    private readonly aiService: AiService,
  ) {}

  async approveReceiptExpenses(
    userId: string,
    userEmail: string | undefined,
    text: string,
  ): Promise<boolean> {
    const trimmedText = text.trim();
    if (!trimmedText) {
      throw new BadRequestException('Receipt expense text cannot be empty');
    }

    const uploadedFileConfig = await this.templatesService.getFileUploadSourceConfig(
      userId,
      userEmail,
    );
    const currentContent = await this.storageService.readTextFileOrEmpty(
      uploadedFileConfig.bucket,
      uploadedFileConfig.filePath,
    );

    const updatedContent = this.appendReceiptText(currentContent, trimmedText);

    await this.storageService.overwriteExpenseFile(
      uploadedFileConfig.bucket,
      uploadedFileConfig.filePath,
      Buffer.from(updatedContent, 'utf-8'),
    );

    const updatedConfig = {
      ...uploadedFileConfig,
      uploadedAt: new Date().toISOString(),
    };
    await this.templatesService.setFileUploadSource(userId, userEmail, updatedConfig);

    return true;
  }

  async scanReceipt(input: ScanReceiptInput): Promise<ReceiptScanResult> {
    const file = decodeUploadedFile(input);

    if (!SUPPORTED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WEBP images are supported',
      );
    }

    const extractedText = await this.aiService.extractExpensesFromImage(
      file.buffer,
      file.mimetype,
    );

    return { extractedText };
  }

  private appendReceiptText(existingContent: string, appendedText: string): string {
    const existing = existingContent.trimEnd();
    if (!existing) {
      return `${appendedText}\n`;
    }

    return `${existing}\n\n${appendedText}\n`;
  }
}
