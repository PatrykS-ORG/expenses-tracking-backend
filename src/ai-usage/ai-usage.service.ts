import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserProfileService } from '../users/user-profile.service';
import { AiActionType, AiUsageTrigger } from '../generated/prisma/client';
import {
  AI_MONTHLY_CREDIT_LIMIT_ENV,
  AI_TOKENS_PER_CREDIT_ENV,
  DEFAULT_MONTHLY_AI_CREDIT_LIMIT,
  TOKENS_PER_CREDIT,
} from './ai-usage.constants';
import { AiActionTypeEnum } from './models/ai-action-type.enum';
import { AiUsageTriggerEnum } from './models/ai-usage-trigger.enum';
import { AiUsageLogEntry } from './models/ai-usage-log-entry.model';
import { AiUsageSummary } from './models/ai-usage-summary.model';

export interface RecordAiUsageInput {
  userId: string;
  action: AiActionType;
  trigger?: AiUsageTrigger;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  success: boolean;
  errorMessage?: string | null;
}

@Injectable()
export class AiUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userProfileService: UserProfileService,
    private readonly configService: ConfigService,
  ) {}

  getTokensPerCredit(): number {
    return this.readPositiveIntEnv(AI_TOKENS_PER_CREDIT_ENV, TOKENS_PER_CREDIT);
  }

  getDefaultMonthlyCreditLimit(): number {
    return this.readPositiveIntEnv(
      AI_MONTHLY_CREDIT_LIMIT_ENV,
      DEFAULT_MONTHLY_AI_CREDIT_LIMIT,
    );
  }

  tokensToCredits(tokens: number): number {
    if (tokens <= 0) {
      return 0;
    }
    return Math.ceil(tokens / this.getTokensPerCredit());
  }

  getCurrentPeriod(now = new Date()): { periodStart: Date; periodEnd: Date } {
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    );
    return { periodStart, periodEnd };
  }

  async getUsageSummary(
    userId: string,
    userEmail?: string,
  ): Promise<AiUsageSummary> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const { periodStart, periodEnd } = this.getCurrentPeriod();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ai_credit_limit: true },
    });

    const limit = user?.ai_credit_limit ?? this.getDefaultMonthlyCreditLimit();
    const used = await this.sumCreditsUsedInPeriod(
      userId,
      periodStart,
      periodEnd,
    );

    return {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      periodStart,
      periodEnd,
    };
  }

  async ensureWithinLimit(userId: string): Promise<void> {
    const summary = await this.getUsageSummary(userId);
    if (summary.used >= summary.limit) {
      throw new BadRequestException(
        `AI credit limit reached (${summary.used}/${summary.limit} credits used this month). Limit resets on ${summary.periodEnd.toISOString().slice(0, 10)}.`,
      );
    }
  }

  async hasRemainingCredits(userId: string): Promise<boolean> {
    const summary = await this.getUsageSummary(userId);
    return summary.used < summary.limit;
  }

  async recordUsage(input: RecordAiUsageInput): Promise<void> {
    const promptTokens = Math.max(0, input.promptTokens);
    const completionTokens = Math.max(0, input.completionTokens);
    const totalTokens =
      input.totalTokens > 0
        ? input.totalTokens
        : promptTokens + completionTokens;

    await this.prisma.aiUsageLog.create({
      data: {
        user_id: input.userId,
        action: input.action,
        trigger: input.trigger ?? AiUsageTrigger.MANUAL,
        model: input.model,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        credits_used: this.tokensToCredits(totalTokens),
        success: input.success,
        error_message: input.errorMessage ?? null,
      },
    });
  }

  async getUsageLog(
    userId: string,
    options: { limit?: number; offset?: number } = {},
    userEmail?: string,
  ): Promise<AiUsageLogEntry[]> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const take = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const skip = Math.max(options.offset ?? 0, 0);

    const rows = await this.prisma.aiUsageLog.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    });

    return rows.map((row) => ({
      id: row.id,
      action: row.action as AiActionTypeEnum,
      trigger: row.trigger as AiUsageTriggerEnum,
      model: row.model,
      promptTokens: row.prompt_tokens,
      completionTokens: row.completion_tokens,
      totalTokens: row.total_tokens,
      creditsUsed: row.credits_used,
      success: row.success,
      errorMessage: row.error_message,
      createdAt: row.created_at,
    }));
  }

  private readPositiveIntEnv(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key)?.trim();
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return parsed;
  }

  private async sumCreditsUsedInPeriod(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<number> {
    const aggregate = await this.prisma.aiUsageLog.aggregate({
      where: {
        user_id: userId,
        created_at: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
      _sum: {
        credits_used: true,
      },
    });

    return aggregate._sum.credits_used ?? 0;
  }
}
