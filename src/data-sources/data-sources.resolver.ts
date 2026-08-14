import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';
import { DataSourcesService } from './data-sources.service';
import { ExpenseFileUploadInput } from './dto/expense-file-upload.input';
import { SaveCurrentMonthExpensesInput } from './dto/save-current-month-expenses.input';
import { CurrentMonthExpenses } from './models/current-month-expenses.model';
import { SuggestExpenseCategoriesResult } from './models/suggest-expense-categories.model';
import {
  CurrentExpenseFile,
  UploadedExpenseFile,
} from './models/uploaded-expense-file.model';

interface AuthenticatedUser {
  sub?: string;
  id?: string;
  email?: string;
}

@Resolver()
export class DataSourcesResolver {
  constructor(private readonly dataSourcesService: DataSourcesService) {}

  private extractUserId(user: AuthenticatedUser): string {
    const userId = user.sub ?? user.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user identifier');
    }
    return userId;
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => CurrentExpenseFile)
  async currentExpenseFile(
    @CurrentUserGql() user: AuthenticatedUser,
  ): Promise<CurrentExpenseFile> {
    return this.dataSourcesService.getCurrentExpenseFile(
      this.extractUserId(user),
      user.email,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => CurrentMonthExpenses)
  async currentMonthExpenses(
    @CurrentUserGql() user: AuthenticatedUser,
  ): Promise<CurrentMonthExpenses> {
    return this.dataSourcesService.getCurrentMonthExpenses(
      this.extractUserId(user),
      user.email,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => UploadedExpenseFile)
  async uploadExpenseFile(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: ExpenseFileUploadInput,
  ): Promise<UploadedExpenseFile> {
    return this.dataSourcesService.uploadExpenseFile(
      this.extractUserId(user),
      user.email,
      input,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => UploadedExpenseFile)
  async overwriteCurrentExpenseFile(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: ExpenseFileUploadInput,
  ): Promise<UploadedExpenseFile> {
    return this.dataSourcesService.overwriteCurrentExpenseFile(
      this.extractUserId(user),
      user.email,
      input,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => CurrentMonthExpenses)
  async saveCurrentMonthExpenses(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: SaveCurrentMonthExpensesInput,
  ): Promise<CurrentMonthExpenses> {
    return this.dataSourcesService.saveCurrentMonthExpenses(
      this.extractUserId(user),
      user.email,
      input,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SuggestExpenseCategoriesResult)
  async suggestExpenseCategories(
    @CurrentUserGql() user: AuthenticatedUser,
  ): Promise<SuggestExpenseCategoriesResult> {
    return this.dataSourcesService.suggestExpenseCategories(
      this.extractUserId(user),
      user.email,
    );
  }
}
