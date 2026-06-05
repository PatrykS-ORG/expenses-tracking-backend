import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { FileUploadDataSourceConfig } from './data-source.types';

const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024;

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

    const client = this.createClient();
    const { error } = await client.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype || 'text/plain',
        upsert: true,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload expense file: ${error}`,
      );
    }

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

    const client = this.createClient();
    const { error } = await client.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: this.getContentType(filePath),
        upsert: true,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to overwrite expense file: ${error.message}`,
      );
    }
  }

  async readTextFile(bucket: string, filePath: string): Promise<string> {
    const client = this.createClient();
    const { data, error } = await client.storage
      .from(bucket)
      .download(filePath);

    if (error || !data) {
      throw new InternalServerErrorException(
        `Failed to download file "${filePath}" from bucket "${bucket}": ${error?.message ?? 'Unknown error'}`,
      );
    }

    return data.text();
  }

  private createClient(): ReturnType<typeof createClient> {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')?.trim();
    const serviceRoleKey = this.configService
      .get<string>('SUPABASE_SERVICE_ROLE_KEY')
      ?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ServiceUnavailableException(
        'Supabase storage is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
      );
    }

    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
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
