import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';
import {
  extractUserId,
  type AuthenticatedUser,
} from '../auth/authenticated-user';
import { AiUsageService } from './ai-usage.service';
import { AiUsageSummary } from './models/ai-usage-summary.model';
import { AiUsageLogEntry } from './models/ai-usage-log-entry.model';

@Resolver()
export class AiUsageResolver {
  constructor(private readonly aiUsageService: AiUsageService) {}

  @UseGuards(GqlAuthGuard)
  @Query(() => AiUsageSummary)
  async myAiUsageSummary(
    @CurrentUserGql() user: AuthenticatedUser,
  ): Promise<AiUsageSummary> {
    return this.aiUsageService.getUsageSummary(extractUserId(user), user.email);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [AiUsageLogEntry])
  async myAiUsageLog(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<AiUsageLogEntry[]> {
    return this.aiUsageService.getUsageLog(
      extractUserId(user),
      { limit, offset },
      user.email,
    );
  }
}
