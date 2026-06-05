import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
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

  @Get('upload/current')
  @UseGuards(JwtAuthGuard)
  async getCurrentExpenseFile(@CurrentUser() user: AuthenticatedUser) {
    const uploadedFileConfig =
      await this.templatesService.getFileUploadSourceConfig(
        user.id,
        user.email,
      );
    const content = await this.storageService.readTextFile(
      uploadedFileConfig.bucket,
      uploadedFileConfig.filePath,
    );

    return {
      dataSourceType: 'FILE_UPLOAD',
      uploadedFilePath: uploadedFileConfig.filePath,
      bucket: uploadedFileConfig.bucket,
      uploadedAt: uploadedFileConfig.uploadedAt,
      originalFileName: uploadedFileConfig.originalFileName,
      content,
    };
  }

  @Put('upload/current')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  async overwriteCurrentExpenseFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Please attach a file in "file" field');
    }

    const uploadedFileConfig =
      await this.templatesService.getFileUploadSourceConfig(
        user.id,
        user.email,
      );
    await this.storageService.overwriteExpenseFile(
      uploadedFileConfig.bucket,
      uploadedFileConfig.filePath,
      file.buffer,
    );

    const updatedConfig = {
      ...uploadedFileConfig,
      uploadedAt: new Date().toISOString(),
    };
    await this.templatesService.setFileUploadSource(
      user.id,
      user.email,
      updatedConfig,
    );

    return {
      dataSourceType: 'FILE_UPLOAD',
      uploadedFilePath: updatedConfig.filePath,
      bucket: updatedConfig.bucket,
      uploadedAt: updatedConfig.uploadedAt,
      originalFileName: updatedConfig.originalFileName,
    };
  }
}
