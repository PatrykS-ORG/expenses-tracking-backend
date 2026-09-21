import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';
import {
  extractUserId,
  type AuthenticatedUser,
} from '../auth/authenticated-user';
import { CloseMonthInput } from './dto/close-month.input';
import { MonthCloseService } from './month-close.service';
import { MonthClosureStatusModel } from './models/month-closure-status.model';

@Resolver(() => MonthClosureStatusModel)
export class MonthCloseResolver {
  constructor(private readonly monthCloseService: MonthCloseService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => MonthClosureStatusModel)
  monthClosureStatus(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('testNow', { type: () => String, nullable: true })
    testNow?: string | null,
  ): Promise<MonthClosureStatusModel> {
    return this.monthCloseService.getStatus(
      extractUserId(user),
      user.email,
      testNow,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => MonthClosureStatusModel)
  closeMonth(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: CloseMonthInput,
  ): Promise<MonthClosureStatusModel> {
    return this.monthCloseService.closeMonth(
      extractUserId(user),
      user.email,
      input,
    );
  }
}
