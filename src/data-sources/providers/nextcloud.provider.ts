import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'webdav';
import { DataSourceType, User } from '../../generated/prisma/client';
import { DataSourceProvider } from '../data-source.provider';
import { parseNextcloudConfig } from '../data-source.types';

@Injectable()
export class NextcloudProvider implements DataSourceProvider {
  readonly type = DataSourceType.NEXTCLOUD;

  constructor(private readonly configService: ConfigService) {}

  validateConfig(config: User['data_source_config']): boolean {
    return parseNextcloudConfig(config) !== null;
  }

  async fetchExpenseContent(user: User): Promise<string> {
    const parsedConfig = parseNextcloudConfig(user.data_source_config);
    if (!parsedConfig) {
      throw new NotFoundException('Nextcloud path is not configured');
    }

    const baseUrl = this.configService
      .get<string>('NEXTCLOUD_WEBDAV_URL')
      ?.trim();
    const username = this.configService
      .get<string>('NEXTCLOUD_USERNAME')
      ?.trim();
    const password = this.configService
      .get<string>('NEXTCLOUD_PASSWORD')
      ?.trim();

    if (!baseUrl || !username || !password) {
      throw new ServiceUnavailableException(
        'Nextcloud WebDAV is not configured (NEXTCLOUD_WEBDAV_URL, NEXTCLOUD_USERNAME, NEXTCLOUD_PASSWORD)',
      );
    }

    const webdavClient = createClient(baseUrl, {
      username,
      password,
    });

    const content = await webdavClient.getFileContents(parsedConfig.filePath, {
      format: 'text',
    });

    if (typeof content !== 'string') {
      throw new ServiceUnavailableException(
        'Unexpected Nextcloud response while reading expense file',
      );
    }

    return content;
  }
}
