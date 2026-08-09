import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AiUsageService } from '../ai-usage/ai-usage.service';
import { EmailService } from '../email/email.service';
import { DataSourceResolverService } from '../data-sources/data-source-resolver.service';
import {
  parseFileUploadConfig,
  parseNextcloudConfig,
} from '../data-sources/data-source.types';
import { applyTemplateValues } from '../email/template-renderer';
import { expenseSummaryToTemplateValues } from './expense-summary.mapper';
import {
  clampScheduleDay,
  clampScheduleHour,
  computeNextSummaryAt,
  getCurrentCalendarPeriod,
  getSummaryPeriod,
  isCreatableSummaryPeriod,
  isEndedSummaryPeriod,
  isOnOrAfterEarliestSummaryPeriod,
  isValidSummaryPeriod,
  normalizeTimezone,
} from './summary-schedule.util';
import {
  fromSummaryEmailLanguageEnum,
  SummaryEmailLanguageEnum,
} from './models/summary-email-language.enum';
import { getSummaryEmailSubject } from './summary-email-language.util';
import {
  AiUsageTrigger,
  SummaryAnalyticsSource,
  SummaryEmailLanguage,
  SummaryLogStatus,
  User,
  DataSourceType,
} from '../generated/prisma/client';
import { UserProfileService } from '../users/user-profile.service';
import { SummaryAnalyticsSnapshot } from './summary-analytics.types';
import {
  toSummaryAnalyticsRecord,
  SummaryAnalyticsRecord,
  categoriesToPrismaJson,
} from './summary-analytics.mapper';
import {
  CreateManualSummaryInput,
  UpdateManualSummaryInput,
} from './models/summary-analytics.model';
import {
  parseManualSummaryPayload,
  parseMoneyToCents,
} from './summary-manual-input.parser';
import { CANONICAL_CATEGORY_KEYS } from './summary-category.constants';

type DueUser = User & {
  activeTemplate: { content: string } | null;
};

export interface UpdateSummaryScheduleInput {
  enabled: boolean;
  scheduleDay: number;
  scheduleHour: number;
  timezone: string;
  emailLanguage: SummaryEmailLanguageEnum;
  currency: string;
}

export interface SummarySchedulePayload {
  enabled: boolean;
  schedule_day: number;
  schedule_hour: number;
  timezone: string;
  email_language: SummaryEmailLanguage;
  currency: string;
  next_summary_at: Date | null;
}

const SUPPORTED_SUMMARY_CURRENCIES = [
  'PLN',
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CZK',
  'UAH',
] as const;

export type SummaryProcessAction =
  | 'email_sent'
  | 'already_sent'
  | 'failed'
  | 'skipped';

export interface SummaryProcessOutcome {
  userId: string;
  email: string;
  action: SummaryProcessAction;
  period?: string;
  error?: string;
  reason?: string;
}

export interface ProcessSummariesResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  failures: Array<{ userId: string; error: string }>;
  outcomes: SummaryProcessOutcome[];
}

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly aiUsageService: AiUsageService,
    private readonly emailService: EmailService,
    private readonly dataSourceResolver: DataSourceResolverService,
    private readonly userProfileService: UserProfileService,
  ) {}

  async getSummarySchedule(
    userId: string,
    userEmail?: string,
  ): Promise<SummarySchedulePayload> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        summary_enabled: true,
        summary_schedule_day: true,
        summary_schedule_hour: true,
        summary_timezone: true,
        summary_email_language: true,
        summary_currency: true,
        next_summary_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return {
      enabled: user.summary_enabled,
      schedule_day: user.summary_schedule_day,
      schedule_hour: user.summary_schedule_hour,
      timezone: user.summary_timezone,
      email_language: user.summary_email_language,
      currency: user.summary_currency,
      next_summary_at: user.next_summary_at,
    };
  }

  async updateSummarySchedule(
    userId: string,
    userEmail: string | undefined,
    input: UpdateSummaryScheduleInput,
  ): Promise<SummarySchedulePayload> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const scheduleDay = clampScheduleDay(input.scheduleDay);
    const scheduleHour = clampScheduleHour(input.scheduleHour);
    const timezone = normalizeTimezone(input.timezone);
    const emailLanguage = fromSummaryEmailLanguageEnum(input.emailLanguage);
    const currency = input.currency.trim().toUpperCase();
    if (
      !SUPPORTED_SUMMARY_CURRENCIES.includes(
        currency as (typeof SUPPORTED_SUMMARY_CURRENCIES)[number],
      )
    ) {
      throw new BadRequestException('Unsupported summary currency');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        active_template_id: true,
        data_source_config: true,
        data_source_type: true,
        salary_cents: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    if (input.enabled) {
      this.ensureUserReadyForSummaries(user);
    }

    const nextSummaryAt = input.enabled
      ? computeNextSummaryAt({
          day: scheduleDay,
          hour: scheduleHour,
          timezone,
        })
      : null;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        summary_enabled: input.enabled,
        summary_schedule_day: scheduleDay,
        summary_schedule_hour: scheduleHour,
        summary_timezone: timezone,
        summary_email_language: emailLanguage,
        summary_currency: currency,
        next_summary_at: nextSummaryAt,
      },
      select: {
        summary_enabled: true,
        summary_schedule_day: true,
        summary_schedule_hour: true,
        summary_timezone: true,
        summary_email_language: true,
        summary_currency: true,
        next_summary_at: true,
      },
    });

    return {
      enabled: updated.summary_enabled,
      schedule_day: updated.summary_schedule_day,
      schedule_hour: updated.summary_schedule_hour,
      timezone: updated.summary_timezone,
      email_language: updated.summary_email_language,
      currency: updated.summary_currency,
      next_summary_at: updated.next_summary_at,
    };
  }

  async updateSalary(
    userId: string,
    userEmail: string | undefined,
    salaryAmount: string,
  ): Promise<number> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const salaryCents = parseMoneyToCents(salaryAmount, 'salaryAmount');
    if (salaryCents <= 0) {
      throw new BadRequestException('Salary must be greater than zero');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { salary_cents: salaryCents },
      select: { salary_cents: true },
    });

    return updated.salary_cents ?? salaryCents;
  }

  async sendSummaryNow(userId: string, userEmail?: string): Promise<boolean> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { activeTemplate: true },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    this.ensureUserReadyForSummaries(user);

    const period = getSummaryPeriod(normalizeTimezone(user.summary_timezone));
    await this.renderAndSendSummary(user, period, AiUsageTrigger.MANUAL);
    return true;
  }

  async getMySummaries(
    userId: string,
    userEmail?: string,
  ): Promise<SummaryAnalyticsRecord[]> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const timezone = await this.getUserTimezone(userId);
    const currentPeriod = getCurrentCalendarPeriod(timezone);

    const rows = await this.prisma.summaryAnalytics.findMany({
      where: {
        user_id: userId,
        period: { lt: currentPeriod },
      },
      orderBy: { period: 'desc' },
    });

    return rows.map(toSummaryAnalyticsRecord);
  }

  async getMySummary(
    userId: string,
    period: string,
    userEmail?: string,
  ): Promise<SummaryAnalyticsRecord | null> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const normalizedPeriod = period.trim();

    if (!isValidSummaryPeriod(normalizedPeriod)) {
      throw new BadRequestException('Invalid summary period format');
    }

    if (!isOnOrAfterEarliestSummaryPeriod(normalizedPeriod)) {
      throw new BadRequestException(
        'Summary periods before 2026-01 are not accepted',
      );
    }

    const timezone = await this.getUserTimezone(userId);
    if (!isEndedSummaryPeriod(normalizedPeriod, timezone)) {
      return null;
    }

    const row = await this.prisma.summaryAnalytics.findUnique({
      where: {
        user_id_period: {
          user_id: userId,
          period: normalizedPeriod,
        },
      },
    });

    return row ? toSummaryAnalyticsRecord(row) : null;
  }

  getSummaryCategoryKeys(): readonly string[] {
    return CANONICAL_CATEGORY_KEYS;
  }

  async createManualSummary(
    userId: string,
    userEmail: string | undefined,
    input: CreateManualSummaryInput,
  ): Promise<SummaryAnalyticsRecord> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const period = input.period.trim();

    if (!isValidSummaryPeriod(period)) {
      throw new BadRequestException('Invalid summary period format');
    }

    if (!isOnOrAfterEarliestSummaryPeriod(period)) {
      throw new BadRequestException(
        'Summary periods before 2026-01 are not accepted',
      );
    }

    const timezone = await this.getUserTimezone(userId);
    if (!isCreatableSummaryPeriod(period, timezone)) {
      throw new BadRequestException(
        'Manual summaries can only be created for months older than the previous calendar month',
      );
    }

    const existing = await this.prisma.summaryAnalytics.findUnique({
      where: {
        user_id_period: {
          user_id: userId,
          period,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Summary for this period already exists');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { summary_currency: true },
    });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const payload = parseManualSummaryPayload(input);
    const row = await this.prisma.summaryAnalytics.create({
      data: {
        user_id: userId,
        period,
        source: SummaryAnalyticsSource.MANUAL,
        currency: user.summary_currency,
        salary_cents: payload.salaryCents,
        total_expenses_cents: payload.totalExpensesCents,
        savings_cents: payload.savingsCents,
        savings_message: payload.savingsMessage,
        categories: categoriesToPrismaJson(payload.categories),
      },
    });

    return toSummaryAnalyticsRecord(row);
  }

  async updateManualSummary(
    userId: string,
    userEmail: string | undefined,
    input: UpdateManualSummaryInput,
  ): Promise<SummaryAnalyticsRecord> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const period = input.period.trim();

    if (!isValidSummaryPeriod(period)) {
      throw new BadRequestException('Invalid summary period format');
    }

    if (!isOnOrAfterEarliestSummaryPeriod(period)) {
      throw new BadRequestException(
        'Summary periods before 2026-01 are not accepted',
      );
    }

    const timezone = await this.getUserTimezone(userId);
    if (!isEndedSummaryPeriod(period, timezone)) {
      throw new BadRequestException(
        'Only ended calendar months can be updated',
      );
    }

    const existing = await this.prisma.summaryAnalytics.findUnique({
      where: {
        user_id_period: {
          user_id: userId,
          period,
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Summary for this period was not found');
    }

    const payload = parseManualSummaryPayload(input);
    const row = await this.prisma.summaryAnalytics.update({
      where: {
        user_id_period: {
          user_id: userId,
          period,
        },
      },
      data: {
        salary_cents: payload.salaryCents,
        total_expenses_cents: payload.totalExpensesCents,
        savings_cents: payload.savingsCents,
        savings_message: payload.savingsMessage,
        categories: categoriesToPrismaJson(payload.categories),
      },
    });

    return toSummaryAnalyticsRecord(row);
  }

  private async getUserTimezone(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { summary_timezone: true },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return normalizeTimezone(user.summary_timezone);
  }

  private async renderAndSendSummary(
    user: DueUser,
    period: string,
    trigger: AiUsageTrigger,
  ): Promise<SummaryAnalyticsSnapshot> {
    if (!user.activeTemplate) {
      throw new NotFoundException('Active template not found');
    }

    const rawExpenseContent =
      await this.dataSourceResolver.fetchExpenseContent(user);
    if (!rawExpenseContent.trim()) {
      throw new BadRequestException('Expense file is empty');
    }

    if (user.salary_cents == null || user.salary_cents <= 0) {
      throw new BadRequestException(
        'Set a positive salary before generating a summary',
      );
    }

    const analysis = await this.aiService.analyzeExpenses(
      user.id,
      rawExpenseContent,
      user.salary_cents,
      user.summary_email_language,
      user.summary_currency,
      period,
      trigger,
    );
    const values = expenseSummaryToTemplateValues(analysis.summary, user.email);
    const html = applyTemplateValues(user.activeTemplate.content, values);
    const subject = getSummaryEmailSubject(
      user.summary_email_language,
      values.currentMonth,
      period,
    );

    await this.emailService.sendEmail(user.email, subject, html);
    return analysis.snapshot;
  }

  async processDueSummaries(): Promise<ProcessSummariesResult> {
    const now = new Date();
    const dueUsers = (await this.prisma.user.findMany({
      where: {
        summary_enabled: true,
        active_template_id: { not: null },
        next_summary_at: { lte: now },
      },
      include: {
        activeTemplate: true,
      },
    })) as DueUser[];

    this.logger.log(
      `Processing due summaries: ${dueUsers.length} user(s) eligible at ${now.toISOString()}`,
    );

    const result: ProcessSummariesResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      failures: [],
      outcomes: [],
    };

    for (const user of dueUsers) {
      if (!this.hasValidDataSourceConfig(user)) {
        result.skipped += 1;
        const outcome: SummaryProcessOutcome = {
          userId: user.id,
          email: user.email,
          action: 'skipped',
          reason: 'invalid or missing data source config',
        };
        result.outcomes.push(outcome);
        this.logger.warn(
          `Skipping user ${user.id} (${user.email}): ${outcome.reason}`,
        );
        continue;
      }

      if (user.salary_cents == null || user.salary_cents <= 0) {
        result.skipped += 1;
        const outcome: SummaryProcessOutcome = {
          userId: user.id,
          email: user.email,
          action: 'skipped',
          reason: 'missing or invalid salary',
        };
        result.outcomes.push(outcome);
        this.logger.warn(
          `Skipping user ${user.id} (${user.email}): ${outcome.reason}`,
        );
        continue;
      }

      if (!user.activeTemplate) {
        result.skipped += 1;
        const outcome: SummaryProcessOutcome = {
          userId: user.id,
          email: user.email,
          action: 'skipped',
          reason: 'no active template',
        };
        result.outcomes.push(outcome);
        continue;
      }

      const hasCredits = await this.aiUsageService.hasRemainingCredits(user.id);
      if (!hasCredits) {
        result.skipped += 1;
        const outcome: SummaryProcessOutcome = {
          userId: user.id,
          email: user.email,
          action: 'skipped',
          reason: 'AI credit limit reached',
        };
        result.outcomes.push(outcome);
        this.logger.warn(
          `Skipping user ${user.id} (${user.email}): ${outcome.reason}`,
        );
        continue;
      }

      result.processed += 1;

      try {
        const action = await this.processUserSummary(user);
        result.succeeded += 1;
        result.outcomes.push({
          userId: user.id,
          email: user.email,
          action,
          period: getSummaryPeriod(normalizeTimezone(user.summary_timezone)),
        });
      } catch (error) {
        result.failed += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown processing error';
        result.failures.push({ userId: user.id, error: message });
        result.outcomes.push({
          userId: user.id,
          email: user.email,
          action: 'failed',
          period: getSummaryPeriod(normalizeTimezone(user.summary_timezone)),
          error: message,
        });
        this.logger.error(
          `Failed to process summary for user ${user.id} (${user.email}): ${message}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    this.logger.log(
      `Summary batch finished: processed=${result.processed} succeeded=${result.succeeded} failed=${result.failed} skipped=${result.skipped}`,
    );

    return result;
  }

  private async processUserSummary(
    user: DueUser,
  ): Promise<'email_sent' | 'already_sent'> {
    if (!user.activeTemplate) {
      throw new NotFoundException('Active template not found');
    }

    const timezone = normalizeTimezone(user.summary_timezone);
    const period = getSummaryPeriod(timezone);
    const existingLog = await this.prisma.summaryLog.findUnique({
      where: {
        user_id_period: {
          user_id: user.id,
          period,
        },
      },
    });

    if (existingLog?.status === SummaryLogStatus.SUCCESS) {
      await this.advanceNextSummaryAt(user.id, user);
      this.logger.log(
        `Summary for ${user.email} (period ${period}) was already sent; advanced next_summary_at`,
      );
      return 'already_sent';
    }

    try {
      const snapshot = await this.renderAndSendSummary(
        user,
        period,
        AiUsageTrigger.SCHEDULED,
      );

      await this.prisma.summaryLog.upsert({
        where: {
          user_id_period: {
            user_id: user.id,
            period,
          },
        },
        create: {
          user_id: user.id,
          period,
          status: SummaryLogStatus.SUCCESS,
        },
        update: {
          status: SummaryLogStatus.SUCCESS,
          error_message: null,
          sent_at: new Date(),
        },
      });

      await this.insertAnalyticsIfMissing(user.id, period, snapshot);

      await this.advanceNextSummaryAt(user.id, user);
      this.logger.log(
        `Summary email sent to ${user.email} for period ${period}`,
      );
      return 'email_sent';
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown processing error';

      await this.prisma.summaryLog.upsert({
        where: {
          user_id_period: {
            user_id: user.id,
            period,
          },
        },
        create: {
          user_id: user.id,
          period,
          status: SummaryLogStatus.FAILURE,
          error_message: message,
        },
        update: {
          status: SummaryLogStatus.FAILURE,
          error_message: message,
          sent_at: new Date(),
        },
      });

      throw error;
    }
  }

  private async insertAnalyticsIfMissing(
    userId: string,
    period: string,
    snapshot: SummaryAnalyticsSnapshot,
  ): Promise<void> {
    const existing = await this.prisma.summaryAnalytics.findUnique({
      where: {
        user_id_period: {
          user_id: userId,
          period,
        },
      },
    });

    if (existing) {
      return;
    }

    await this.prisma.summaryAnalytics.create({
      data: {
        user_id: userId,
        period,
        source: SummaryAnalyticsSource.SCHEDULED,
        currency: snapshot.currency,
        salary_cents: snapshot.salaryCents,
        total_expenses_cents: snapshot.totalExpensesCents,
        savings_cents: snapshot.savingsCents,
        savings_message: snapshot.savingsMessage,
        categories: categoriesToPrismaJson(snapshot.categories),
      },
    });
  }

  private async advanceNextSummaryAt(
    userId: string,
    user: Pick<
      User,
      | 'summary_schedule_day'
      | 'summary_schedule_hour'
      | 'summary_timezone'
      | 'next_summary_at'
    >,
  ): Promise<void> {
    const from = user.next_summary_at ?? new Date();
    const nextSummaryAt = computeNextSummaryAt({
      day: user.summary_schedule_day,
      hour: user.summary_schedule_hour,
      timezone: normalizeTimezone(user.summary_timezone),
      from,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { next_summary_at: nextSummaryAt },
    });
  }

  private hasValidDataSourceConfig(user: User): boolean {
    if (!user.data_source_config) {
      return false;
    }

    if (user.data_source_type === DataSourceType.FILE_UPLOAD) {
      return parseFileUploadConfig(user.data_source_config) !== null;
    }

    const nextcloudConfig = parseNextcloudConfig(user.data_source_config);
    return nextcloudConfig !== null && nextcloudConfig.filePath.trim() !== '';
  }

  private ensureUserReadyForSummaries(user: {
    active_template_id: string | null;
    data_source_config: User['data_source_config'];
    data_source_type: User['data_source_type'];
    salary_cents?: number | null;
  }): void {
    if (!user.active_template_id) {
      throw new BadRequestException(
        'Set an active template before enabling summary emails',
      );
    }

    if (!this.hasValidDataSourceConfig(user as User)) {
      throw new BadRequestException(
        'Configure a valid expense data source before enabling summary emails',
      );
    }

    if (user.salary_cents == null || user.salary_cents <= 0) {
      throw new BadRequestException(
        'Set a positive salary before enabling summary emails',
      );
    }
  }
}
