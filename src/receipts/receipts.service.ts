import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseStorageService } from '../data-sources/supabase-storage.service';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly storageService: SupabaseStorageService,
    private readonly templatesService: TemplatesService,
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

  private appendReceiptText(existingContent: string, appendedText: string): string {
    const existing = existingContent.trimEnd();
    if (!existing) {
      return `${appendedText}\n`;
    }

    return `${existing}\n\n${appendedText}\n`;
  }
}
