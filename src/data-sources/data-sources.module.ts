import { Module } from '@nestjs/common';
import { TemplatesModule } from '../templates/templates.module';
import { DataSourceResolverService } from './data-source-resolver.service';
import { DataSourcesResolver } from './data-sources.resolver';
import { DataSourcesService } from './data-sources.service';
import { FileUploadProvider } from './providers/file-upload.provider';
import { NextcloudProvider } from './providers/nextcloud.provider';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  imports: [TemplatesModule],
  providers: [
    SupabaseStorageService,
    FileUploadProvider,
    NextcloudProvider,
    DataSourceResolverService,
    DataSourcesService,
    DataSourcesResolver,
  ],
  exports: [DataSourceResolverService, SupabaseStorageService],
})
export class DataSourcesModule {}
