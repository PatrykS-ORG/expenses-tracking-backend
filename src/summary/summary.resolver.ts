import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { SummaryService } from './summary.service';
import {
  SummarySchedule,
  UpdateSummaryScheduleInput,
} from './models/summary-schedule.model';
import { toSummaryEmailLanguageEnum } from './models/summary-email-language.enum';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';

interface AuthenticatedUser {
  sub?: string;
  id?: string;
  email?: string;
}

@Resolver(() => SummarySchedule)
export class SummaryResolver {
  constructor(private readonly summaryService: SummaryService) {}

  private extractUserId(user: AuthenticatedUser): string {
    const userId = user.sub ?? user.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user identifier');
    }
    return userId;
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => SummarySchedule)
  async mySummarySchedule(
    @CurrentUserGql() user: AuthenticatedUser,
  ): Promise<SummarySchedule> {
    const schedule = await this.summaryService.getSummarySchedule(
      this.extractUserId(user),
      user.email,
    );

    return {
      enabled: schedule.enabled,
      scheduleDay: schedule.schedule_day,
      scheduleHour: schedule.schedule_hour,
      timezone: schedule.timezone,
      emailLanguage: toSummaryEmailLanguageEnum(schedule.email_language),
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
      this.extractUserId(user),
      user.email,
      input,
    );

    return {
      enabled: schedule.enabled,
      scheduleDay: schedule.schedule_day,
      scheduleHour: schedule.schedule_hour,
      timezone: schedule.timezone,
      emailLanguage: toSummaryEmailLanguageEnum(schedule.email_language),
      nextSummaryAt: schedule.next_summary_at,
    };
  }
}
