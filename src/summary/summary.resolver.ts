import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SummaryService } from './summary.service';
import {
  SummarySchedule,
  UpdateSummaryScheduleInput,
} from './models/summary-schedule.model';
import {
  CreateManualSummaryInput,
  SummaryAnalyticsModel,
  UpdateManualSummaryInput,
} from './models/summary-analytics.model';
import { toSummaryAnalyticsModel } from './summary-analytics.mapper';
import { toSummaryEmailLanguageEnum } from './models/summary-email-language.enum';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';
import {
  extractUserId,
  type AuthenticatedUser,
} from '../auth/authenticated-user';

@Resolver(() => SummarySchedule)
export class SummaryResolver {
  constructor(private readonly summaryService: SummaryService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => SummarySchedule)
  async mySummarySchedule(
    @CurrentUserGql() user: AuthenticatedUser,
  ): Promise<SummarySchedule> {
    const schedule = await this.summaryService.getSummarySchedule(
      extractUserId(user),
      user.email,
    );

    return {
      enabled: schedule.enabled,
      scheduleDay: schedule.schedule_day,
      scheduleHour: schedule.schedule_hour,
      timezone: schedule.timezone,
      emailLanguage: toSummaryEmailLanguageEnum(schedule.email_language),
      currency: schedule.currency,
      nextSummaryAt: schedule.next_summary_at,
    };
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SummarySchedule)
  async updateSummarySchedule(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: UpdateSummaryScheduleInput,
  ): Promise<SummarySchedule> {
    const schedule = await this.summaryService.updateSummarySchedule(
      extractUserId(user),
      user.email,
      input,
    );

    return {
      enabled: schedule.enabled,
      scheduleDay: schedule.schedule_day,
      scheduleHour: schedule.schedule_hour,
      timezone: schedule.timezone,
      emailLanguage: toSummaryEmailLanguageEnum(schedule.email_language),
      currency: schedule.currency,
      nextSummaryAt: schedule.next_summary_at,
    };
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Int)
  async updateSalary(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('salaryAmount') salaryAmount: string,
  ): Promise<number> {
    return this.summaryService.updateSalary(
      extractUserId(user),
      user.email,
      salaryAmount,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  sendSummaryNow(@CurrentUserGql() user: AuthenticatedUser): Promise<boolean> {
    return this.summaryService.sendSummaryNow(extractUserId(user), user.email);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [SummaryAnalyticsModel])
  async mySummaries(
    @CurrentUserGql() user: AuthenticatedUser,
  ): Promise<SummaryAnalyticsModel[]> {
    const rows = await this.summaryService.getMySummaries(
      extractUserId(user),
      user.email,
    );
    return rows.map(toSummaryAnalyticsModel);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => SummaryAnalyticsModel, { nullable: true })
  async mySummary(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('month') month: string,
  ): Promise<SummaryAnalyticsModel | null> {
    const row = await this.summaryService.getMySummary(
      extractUserId(user),
      month,
      user.email,
    );
    return row ? toSummaryAnalyticsModel(row) : null;
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [String])
  summaryCategoryKeys(): string[] {
    return [...this.summaryService.getSummaryCategoryKeys()];
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SummaryAnalyticsModel)
  async createManualSummary(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: CreateManualSummaryInput,
  ): Promise<SummaryAnalyticsModel> {
    const row = await this.summaryService.createManualSummary(
      extractUserId(user),
      user.email,
      input,
    );
    return toSummaryAnalyticsModel(row);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => SummaryAnalyticsModel)
  async updateManualSummary(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: UpdateManualSummaryInput,
  ): Promise<SummaryAnalyticsModel> {
    const row = await this.summaryService.updateManualSummary(
      extractUserId(user),
      user.email,
      input,
    );
    return toSummaryAnalyticsModel(row);
  }
}
