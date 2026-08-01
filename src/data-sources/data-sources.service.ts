import { Injectable } from '@nestjs/common';
import { decodeUploadedFile } from '../common/decode-uploaded-file';
import { DATA_SOURCE_TYPES } from './data-source.types';
import { DataSourceTypeEnum } from '../templates/models/data-source-type.enum';
import { ExpenseFileUploadInput } from './dto/expense-file-upload.input';
import {
  CurrentExpenseFile,
  UploadedExpenseFile,
} from './models/uploaded-expense-file.model';
import { SupabaseStorageService } from './supabase-storage.service';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class DataSourcesService {
  constructor(
    private readonly storageService: SupabaseStorageService,
    private readonly templatesService: TemplatesService,
  ) {}

  async uploadExpenseFile(
    userId: string,
    userEmail: string | undefined,
    input: ExpenseFileUploadInput,
  ): Promise<UploadedExpenseFile> {
    const file = decodeUploadedFile(input);
    const uploadedFileConfig = await this.storageService.uploadExpenseFile(
      userId,
      file,
    );

    await this.templatesService.setFileUploadSource(
      userId,
      userEmail,
      uploadedFileConfig,
    );

    return this.toUploadedExpenseFile(uploadedFileConfig);
  }

  async getCurrentExpenseFile(
    userId: string,
    userEmail: string | undefined,
  ): Promise<CurrentExpenseFile> {
    const uploadedFileConfig =
      await this.templatesService.getFileUploadSourceConfig(userId, userEmail);
    const content = await this.storageService.readTextFile(
      uploadedFileConfig.bucket,
      uploadedFileConfig.filePath,
      uploadedFileConfig.uploadedAt,
    );

    return {
      ...this.toUploadedExpenseFile(uploadedFileConfig),
      content,
    };
  }

  async overwriteCurrentExpenseFile(
    userId: string,
    userEmail: string | undefined,
    input: ExpenseFileUploadInput,
  ): Promise<UploadedExpenseFile> {
    const file = decodeUploadedFile(input);
    const existingConfig =
      await this.templatesService.tryGetFileUploadSourceConfig(
        userId,
        userEmail,
      );

    if (!existingConfig) {
      const uploadedFileConfig = await this.storageService.uploadExpenseFile(
        userId,
        file,
      );
      await this.templatesService.setFileUploadSource(
        userId,
        userEmail,
        uploadedFileConfig,
      );
      return this.toUploadedExpenseFile(uploadedFileConfig);
    }

    await this.storageService.overwriteExpenseFile(
      existingConfig.bucket,
      existingConfig.filePath,
      file.buffer,
    );

    const updatedConfig = {
      ...existingConfig,
      uploadedAt: new Date().toISOString(),
    };
    await this.templatesService.setFileUploadSource(
      userId,
      userEmail,
      updatedConfig,
    );

    return this.toUploadedExpenseFile(updatedConfig);
  }

  private toUploadedExpenseFile(config: {
    bucket: string;
    filePath: string;
    uploadedAt?: string;
    originalFileName?: string;
  }): UploadedExpenseFile {
    return {
      dataSourceType: DATA_SOURCE_TYPES.FILE_UPLOAD as DataSourceTypeEnum,
      uploadedFilePath: config.filePath,
      bucket: config.bucket,
      uploadedAt: config.uploadedAt,
      originalFileName: config.originalFileName,
    };
  }
}
