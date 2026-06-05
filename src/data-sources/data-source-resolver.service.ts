import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSourceType, User } from '../generated/prisma/client';
import { DataSourceProvider } from './data-source.provider';
import { FileUploadProvider } from './providers/file-upload.provider';
import { NextcloudProvider } from './providers/nextcloud.provider';

@Injectable()
export class DataSourceResolverService {
  private readonly providers: Map<DataSourceType, DataSourceProvider>;

  constructor(
    fileUploadProvider: FileUploadProvider,
    nextcloudProvider: NextcloudProvider,
  ) {
    this.providers = new Map<DataSourceType, DataSourceProvider>([
      [fileUploadProvider.type, fileUploadProvider],
      [nextcloudProvider.type, nextcloudProvider],
    ]);
  }

  getProvider(type: DataSourceType): DataSourceProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new NotFoundException(`Unsupported data source type: ${type}`);
    }
    return provider;
  }

  async fetchExpenseContent(user: User): Promise<string> {
    const provider = this.getProvider(user.data_source_type);
    if (!provider.validateConfig(user.data_source_config)) {
      throw new NotFoundException(
        `Data source config is invalid for type ${user.data_source_type}`,
      );
    }
    return provider.fetchExpenseContent(user);
  }
}
