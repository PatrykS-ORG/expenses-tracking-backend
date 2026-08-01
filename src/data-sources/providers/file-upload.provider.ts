import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSourceType, User } from '../../generated/prisma/client';
import { DataSourceProvider } from '../data-source.provider';
import { parseFileUploadConfig } from '../data-source.types';
import { SupabaseStorageService } from '../supabase-storage.service';

@Injectable()
export class FileUploadProvider implements DataSourceProvider {
  readonly type = DataSourceType.FILE_UPLOAD;

  constructor(private readonly storageService: SupabaseStorageService) {}

  validateConfig(config: User['data_source_config']): boolean {
    return parseFileUploadConfig(config) !== null;
  }

  async fetchExpenseContent(user: User): Promise<string> {
    const parsedConfig = parseFileUploadConfig(user.data_source_config);
    if (!parsedConfig) {
      throw new NotFoundException('File upload data source is not configured');
    }

    return this.storageService.readTextFile(
      parsedConfig.bucket,
      parsedConfig.filePath,
      parsedConfig.uploadedAt,
    );
  }
}
