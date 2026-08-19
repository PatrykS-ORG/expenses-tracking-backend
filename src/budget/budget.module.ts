import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { BudgetResolver } from './budget.resolver';
import { BudgetService } from './budget.service';

@Module({
  imports: [UsersModule],
  providers: [BudgetService, BudgetResolver],
})
export class BudgetModule {}
