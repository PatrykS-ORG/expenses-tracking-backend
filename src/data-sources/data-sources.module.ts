import { Module } from '@nestjs/common';
import { TemplatesModule } from '../templates/templates.module';
import { DataSourceResolverService } from './data-source-resolver.service';
import { DataSourcesController } from './data-sources.controller';
import { FileUploadProvider } from './providers/file-upload.provider';
import { NextcloudProvider } from './providers/nextcloud.provider';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  imports: [TemplatesModule],
  controllers: [DataSourcesController],
  providers: [
    SupabaseStorageService,
    FileUploadProvider,
    NextcloudProvider,
    DataSourceResolverService,
  ],
  exports: [DataSourceResolverService, SupabaseStorageService],
})
export class DataSourcesModule {}
