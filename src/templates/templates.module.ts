import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesResolver } from './templates.resolver';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [TemplatesResolver, TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
