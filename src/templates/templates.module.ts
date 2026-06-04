import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesResolver } from './templates.resolver';
import { AiModule } from '../ai/ai.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [AiModule, EmailModule],
  providers: [TemplatesResolver, TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
