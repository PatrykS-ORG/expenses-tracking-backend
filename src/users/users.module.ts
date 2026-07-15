import { Module } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UsersResolver } from './users.resolver';

@Module({
  providers: [UserProfileService, UsersResolver],
  exports: [UserProfileService],
})
export class UsersModule {}
