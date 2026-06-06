import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { FileUploadDataSourceConfig } from './data-source.types';

const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;

interface StorageCredentials {
  supabaseUrl: string;
  serviceRoleKey: string;
}

@Injectable()
export class SupabaseStorageService {
  constructor(private readonly configService: ConfigService) {}

  getDefaultBucket(): string {
    return this.configService.get<string>('SUPABASE_STORAGE_BUCKET', '');
  }

  async uploadExpenseFile(
    userId: string,
    file: Express.Multer.File,
  ): Promise<FileUploadDataSourceConfig> {
    if (!file) {
      throw new BadRequestException('Missing file');
    }

    if (!this.isAllowedFile(file.originalname)) {
      throw new BadRequestException('Only .txt and .csv files are supported');
    }

    const monthKey = new Date().toISOString().slice(0, 7);
    const extension = this.getExtension(file.originalname);
    const bucket = this.getDefaultBucket();
    const filePath = `${userId}/${monthKey}${extension}`;

    await this.uploadObject(
      bucket,
      filePath,
      file.buffer,
      file.mimetype || 'text/plain',
    );

    return {
      bucket,
      filePath,
      uploadedAt: new Date().toISOString(),
      originalFileName: file.originalname,
    };
  }

  async overwriteExpenseFile(
    bucket: string,
    filePath: string,
    fileBuffer: Buffer,
  ): Promise<void> {
    if (fileBuffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('File content exceeds 2MB limit');
    }

    await this.uploadObject(
      bucket,
      filePath,
      fileBuffer,
      this.getContentType(filePath),
    );
  }

  async readTextFile(bucket: string, filePath: string): Promise<string> {
    return this.downloadTextFile(bucket, filePath, { allowMissing: false });
  }

  async readTextFileOrEmpty(bucket: string, filePath: string): Promise<string> {
    return this.downloadTextFile(bucket, filePath, { allowMissing: true });
  }

  private getStorageCredentials(): StorageCredentials {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')?.trim();
    const serviceRoleKey = this.configService
      .get<string>('SUPABASE_SERVICE_ROLE_KEY')
      ?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ServiceUnavailableException(
        'Supabase storage is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
      );
    }

    return {
      supabaseUrl: supabaseUrl.replace(/\/$/, ''),
      serviceRoleKey,
    };
  }

  private buildObjectUrl(
    supabaseUrl: string,
    bucket: string,
    filePath: string,
  ): string {
    const encodedPath = filePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;
  }

  private getAuthHeaders(serviceRoleKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    };
  }

  private async downloadTextFile(
    bucket: string,
    filePath: string,
    options: { allowMissing: boolean },
  ): Promise<string> {
    const { supabaseUrl, serviceRoleKey } = this.getStorageCredentials();
    const url = this.buildObjectUrl(supabaseUrl, bucket, filePath);

    try {
      const response = await axios.get<string>(url, {
        headers: this.getAuthHeaders(serviceRoleKey),
        responseType: 'text',
        validateStatus: () => true,
      });

      if (response.status === 404 || response.status === 400) {
        if (options.allowMissing) {
          return '';
        }

        throw new InternalServerErrorException(
          `Failed to download file "${filePath}" from bucket "${bucket}": file not found`,
        );
      }

      if (response.status < 200 || response.status >= 300) {
        const details = String(response.data ?? '').slice(0, 200);
        throw new InternalServerErrorException(
          `Failed to download file "${filePath}" from bucket "${bucket}": HTTP ${response.status} ${details}`,
        );
      }

      return response.data;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      const message = isAxiosError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

      throw new InternalServerErrorException(
        `Failed to download file "${filePath}" from bucket "${bucket}": ${message}`,
      );
    }
  }

  private async uploadObject(
    bucket: string,
    filePath: string,
    fileBuffer: Buffer,
    contentType: string,
  ): Promise<void> {
    const { supabaseUrl, serviceRoleKey } = this.getStorageCredentials();
    const url = this.buildObjectUrl(supabaseUrl, bucket, filePath);

    try {
      const response = await axios.post(url, fileBuffer, {
        headers: {
          ...this.getAuthHeaders(serviceRoleKey),
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        validateStatus: () => true,
      });

      if (response.status < 200 || response.status >= 300) {
        const details = String(response.data ?? '').slice(0, 200);
        throw new InternalServerErrorException(
          `Failed to upload file "${filePath}" to bucket "${bucket}": HTTP ${response.status} ${details}`,
        );
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      const message = isAxiosError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

      throw new InternalServerErrorException(
        `Failed to upload file "${filePath}" to bucket "${bucket}": ${message}`,
      );
    }
  }

  private isAllowedFile(fileName: string): boolean {
    const lowerName = fileName.toLowerCase();
    return lowerName.endsWith('.txt') || lowerName.endsWith('.csv');
  }

  private getExtension(fileName: string): '.txt' | '.csv' {
    return fileName.toLowerCase().endsWith('.csv') ? '.csv' : '.txt';
  }

  private getContentType(fileName: string): 'text/csv' | 'text/plain' {
    return fileName.toLowerCase().endsWith('.csv') ? 'text/csv' : 'text/plain';
  }
}
