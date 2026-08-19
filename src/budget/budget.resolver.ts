import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { MonthlyBudgetModel } from './models/monthly-budget.model';
import { SaveMonthlyBudgetInput } from './dto/save-monthly-budget.input';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';
import {
  extractUserId,
  type AuthenticatedUser,
} from '../auth/authenticated-user';

@Resolver(() => MonthlyBudgetModel)
export class BudgetResolver {
  constructor(private readonly budgetService: BudgetService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => MonthlyBudgetModel, { nullable: true })
  myMonthlyBudget(
    @CurrentUserGql() user: AuthenticatedUser,
  ): Promise<MonthlyBudgetModel | null> {
    return this.budgetService.getMyMonthlyBudget(
      extractUserId(user),
      user.email,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => MonthlyBudgetModel)
  saveMonthlyBudget(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: SaveMonthlyBudgetInput,
  ): Promise<MonthlyBudgetModel> {
    return this.budgetService.saveMonthlyBudget(
      extractUserId(user),
      user.email,
      input,
    );
  }
}
