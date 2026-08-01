import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AiUsageService } from './ai-usage.service';
import { AiUsageResolver } from './ai-usage.resolver';

@Module({
  imports: [UsersModule],
  providers: [AiUsageService, AiUsageResolver],
  exports: [AiUsageService],
})
export class AiUsageModule {}
