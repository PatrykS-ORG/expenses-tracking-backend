import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';
import {
  extractUserId,
  type AuthenticatedUser,
} from '../auth/authenticated-user';
import { AddSavingsGoalContributionInput } from './dto/add-savings-goal-contribution.input';
import {
  CreateSavingsGoalEventInput,
  UpdateSavingsGoalEventInput,
} from './dto/savings-goal-event.input';
import {
  CreateSavingsGoalItemInput,
  UpdateSavingsGoalItemInput,
} from './dto/savings-goal-item.input';
import { SavingsGoalEventModel } from './models/savings-goal-event.model';
import { SavingsGoalsService } from './savings-goals.service';

@Resolver(() => SavingsGoalEventModel)
export class SavingsGoalsResolver {
  constructor(private readonly savingsGoalsService: SavingsGoalsService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => [SavingsGoalEventModel])
  mySavingsGoals(
    @CurrentUserGql() user: AuthenticatedUser,
  ): Promise<SavingsGoalEventModel[]> {
    return this.savingsGoalsService.getMySavingsGoals(
      extractUserId(user),
      user.email,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SavingsGoalEventModel)
  createSavingsGoalEvent(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: CreateSavingsGoalEventInput,
  ): Promise<SavingsGoalEventModel> {
    return this.savingsGoalsService.createSavingsGoalEvent(
      extractUserId(user),
      user.email,
      input,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SavingsGoalEventModel)
  updateSavingsGoalEvent(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('id') id: string,
    @Args('input') input: UpdateSavingsGoalEventInput,
  ): Promise<SavingsGoalEventModel> {
    return this.savingsGoalsService.updateSavingsGoalEvent(
      extractUserId(user),
      user.email,
      id,
      input,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  deleteSavingsGoalEvent(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.savingsGoalsService.deleteSavingsGoalEvent(
      extractUserId(user),
      user.email,
      id,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SavingsGoalEventModel)
  createSavingsGoalItem(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('eventId') eventId: string,
    @Args('input') input: CreateSavingsGoalItemInput,
  ): Promise<SavingsGoalEventModel> {
    return this.savingsGoalsService.createSavingsGoalItem(
      extractUserId(user),
      user.email,
      eventId,
      input,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SavingsGoalEventModel)
  updateSavingsGoalItem(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('id') id: string,
    @Args('input') input: UpdateSavingsGoalItemInput,
  ): Promise<SavingsGoalEventModel> {
    return this.savingsGoalsService.updateSavingsGoalItem(
      extractUserId(user),
      user.email,
      id,
      input,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SavingsGoalEventModel)
  deleteSavingsGoalItem(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('id') id: string,
  ): Promise<SavingsGoalEventModel> {
    return this.savingsGoalsService.deleteSavingsGoalItem(
      extractUserId(user),
      user.email,
      id,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SavingsGoalEventModel)
  addSavingsGoalContribution(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('itemId') itemId: string,
    @Args('input') input: AddSavingsGoalContributionInput,
  ): Promise<SavingsGoalEventModel> {
    return this.savingsGoalsService.addSavingsGoalContribution(
      extractUserId(user),
      user.email,
      itemId,
      input,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SavingsGoalEventModel)
  deleteSavingsGoalContribution(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('id') id: string,
  ): Promise<SavingsGoalEventModel> {
    return this.savingsGoalsService.deleteSavingsGoalContribution(
      extractUserId(user),
      user.email,
      id,
    );
  }
}
