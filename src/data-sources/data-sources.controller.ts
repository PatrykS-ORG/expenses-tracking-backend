import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TemplatesService } from '../templates/templates.service';
import { SupabaseStorageService } from './supabase-storage.service';

interface AuthenticatedUser {
  id: string;
  email?: string;
}

@Controller('api/data-sources')
export class DataSourcesController {
  constructor(
    private readonly storageService: SupabaseStorageService,
    private readonly templatesService: TemplatesService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  async uploadExpenseFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Please attach a file in "file" field');
    }

    const uploadedFileConfig = await this.storageService.uploadExpenseFile(
      user.id,
      file,
    );

    await this.templatesService.setFileUploadSource(
      user.id,
      user.email,
      uploadedFileConfig,
    );

    return {
      dataSourceType: 'FILE_UPLOAD',
      uploadedFilePath: uploadedFileConfig.filePath,
      bucket: uploadedFileConfig.bucket,
      uploadedAt: uploadedFileConfig.uploadedAt,
      originalFileName: uploadedFileConfig.originalFileName,
    };
  }
}
