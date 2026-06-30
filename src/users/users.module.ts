import { Module } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';

@Module({
  providers: [UserProfileService],
  exports: [UserProfileService],
})
export class UsersModule {}
