import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SavingsGoalsResolver } from './savings-goals.resolver';
import { SavingsGoalsService } from './savings-goals.service';

@Module({
  imports: [UsersModule],
  providers: [SavingsGoalsService, SavingsGoalsResolver],
})
export class SavingsGoalsModule {}
