import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { parseExpenseFile } from '../ai/expense-file.parser';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildCanonicalCategoriesFromExpenses } from '../summary/summary-analytics-canonical.mapper';
import { categoriesToPrismaJson } from '../summary/summary-analytics.mapper';
import {
  getCurrentCalendarPeriod,
  getSummaryPeriod,
  getZonedDateParts,
  normalizeTimezone,
} from '../summary/summary-schedule.util';
import { UserProfileService } from '../users/user-profile.service';
import { CloseMonthInput } from './dto/close-month.input';
import { MonthCloseClock } from './month-close.clock.service';
import { MONTH_CLOSE_ERRORS } from './month-close.errors';
import {
  evaluateMonthClosure,
  monthCloseAnalyticsSource,
  monthCloseContributionNote,
  MonthClosureSnapshot,
  sumAllocationCents,
} from './month-close.logic';
import { MonthClosureStatusModel } from './models/month-closure-status.model';

@Injectable()
export class MonthCloseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userProfileService: UserProfileService,
    private readonly clock: MonthCloseClock,
    @Inject(forwardRef(() => DataSourcesService))
    private readonly dataSourcesService: DataSourcesService,
  ) {}

  async getStatus(
    userId: string,
    userEmail: string | undefined,
    testNow?: string | null,
  ): Promise<MonthClosureStatusModel> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    return this.computeStatus(userId, userEmail, testNow);
  }

  async assertMonthWritable(
    userId: string,
    userEmail: string | undefined,
  ): Promise<void> {
    const status = await this.computeStatus(userId, userEmail);
    if (status.needsClosure) {
      throw new BadRequestException(MONTH_CLOSE_ERRORS.MONTH_NOT_CLOSED);
    }
  }

  async closeMonth(
    userId: string,
    userEmail: string | undefined,
    input: CloseMonthInput,
  ): Promise<MonthClosureStatusModel> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);

    const status = await this.computeStatus(userId, userEmail, input.testNow);
    if (!status.needsClosure) {
      throw new BadRequestException(MONTH_CLOSE_ERRORS.ALREADY_CLOSED);
    }
    if (input.period !== status.period) {
      throw new BadRequestException(MONTH_CLOSE_ERRORS.PERIOD_MISMATCH);
    }
    if (input.allocations.length === 0) {
      throw new BadRequestException(MONTH_CLOSE_ERRORS.EMPTY_ALLOCATIONS);
    }

    const allocations = input.allocations.map((allocation) => ({
      itemId: allocation.itemId.trim(),
      amountCents: this.parsePositiveCents(allocation.amountCents),
    }));
    const allocatedCents = sumAllocationCents(allocations);
    if (allocatedCents !== status.freeSavingsCents) {
      throw new BadRequestException(MONTH_CLOSE_ERRORS.AMOUNT_MISMATCH);
    }

    const itemIds = [
      ...new Set(allocations.map((allocation) => allocation.itemId)),
    ];
    const items = await this.prisma.savingsGoalItem.findMany({
      where: { id: { in: itemIds } },
      include: {
        event: { select: { user_id: true, currency: true } },
      },
    });
    const itemsById = new Map(items.map((item) => [item.id, item]));
    for (const allocation of allocations) {
      const item = itemsById.get(allocation.itemId);
      if (!item || item.event.user_id !== userId) {
        throw new NotFoundException('Savings goal item not found');
      }
      if (item.event.currency !== status.currency) {
        throw new BadRequestException(MONTH_CLOSE_ERRORS.CURRENCY_MISMATCH);
      }
    }

    const now = this.clock.now(input.testNow);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { summary_timezone: true },
    });
    const occurredOn = this.toOccurredOn(
      now,
      normalizeTimezone(user?.summary_timezone),
    );
    const note = monthCloseContributionNote(status.period);
    const content = await this.dataSourcesService.readExpenseFileContentOrEmpty(
      userId,
      userEmail,
    );
    const expenses = parseExpenseFile(content).expenses;
    const categories = buildCanonicalCategoriesFromExpenses(expenses, []);

    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        for (const allocation of allocations) {
          await tx.savingsGoalContribution.create({
            data: {
              item_id: allocation.itemId,
              amount_cents: allocation.amountCents,
              occurred_on: occurredOn,
              note,
            },
          });
        }

        const existingAnalytics = await tx.summaryAnalytics.findUnique({
          where: {
            user_id_period: {
              user_id: userId,
              period: status.period,
            },
          },
        });
        if (!existingAnalytics) {
          await tx.summaryAnalytics.create({
            data: {
              user_id: userId,
              period: status.period,
              source: monthCloseAnalyticsSource(),
              currency: status.currency,
              salary_cents: status.salaryCents,
              total_expenses_cents: status.totalExpensesCents,
              savings_cents: status.freeSavingsCents,
              savings_message: null,
              categories: categoriesToPrismaJson(categories),
            },
          });
        }

        await tx.monthClose.create({
          data: {
            user_id: userId,
            period: status.period,
            free_savings_cents: status.freeSavingsCents,
            allocated_cents: allocatedCents,
            currency: status.currency,
            closed_at: now,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(MONTH_CLOSE_ERRORS.ALREADY_CLOSED);
      }
      throw error;
    }

    await this.dataSourcesService.replaceExpenseFileContent(
      userId,
      userEmail,
      '',
    );

    return this.computeStatus(userId, userEmail, input.testNow);
  }

  private async computeStatus(
    userId: string,
    userEmail: string | undefined,
    testNow?: string | null,
  ): Promise<MonthClosureSnapshot> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        salary_cents: true,
        summary_currency: true,
        summary_timezone: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const now = this.clock.now(testNow);
    const timezone = normalizeTimezone(user.summary_timezone);
    const currentPeriod = getCurrentCalendarPeriod(timezone, now);
    const previousPeriod = getSummaryPeriod(timezone, now);
    const alreadyClosed = Boolean(
      await this.prisma.monthClose.findUnique({
        where: {
          user_id_period: {
            user_id: userId,
            period: previousPeriod,
          },
        },
        select: { id: true },
      }),
    );
    const content = await this.dataSourcesService.readExpenseFileContentOrEmpty(
      userId,
      userEmail,
    );
    const totalExpensesCents = parseExpenseFile(content).expenses.reduce(
      (sum, expense) => sum + expense.amountCents,
      0,
    );

    return evaluateMonthClosure({
      currentPeriod,
      previousPeriod,
      alreadyClosed,
      salaryCents: user.salary_cents ?? 0,
      totalExpensesCents,
      currency: user.summary_currency,
    });
  }

  private parsePositiveCents(value: number): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(
        'amountCents must be a positive integer in cents',
      );
    }
    return value;
  }

  private toOccurredOn(now: Date, timezone: string): Date {
    const parts = getZonedDateParts(now, timezone);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  }
}
