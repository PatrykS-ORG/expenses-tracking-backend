import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SummaryService } from './summary.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AiUsageService } from '../ai-usage/ai-usage.service';
import { EmailService } from '../email/email.service';
import { DataSourceResolverService } from '../data-sources/data-source-resolver.service';
import { UserProfileService } from '../users/user-profile.service';
import {
  SummaryAnalyticsSource,
  SummaryLogStatus,
} from '../generated/prisma/client';

jest.mock('webdav', () => ({
  createClient: jest.fn(),
}));

type ProcessUserSummaryResult = 'email_sent' | 'already_sent';

type SummaryServicePrivate = {
  processUserSummary: (user: unknown) => Promise<ProcessUserSummaryResult>;
};

function callProcessUserSummary(
  summaryService: SummaryService,
  user: unknown,
): Promise<ProcessUserSummaryResult> {
  return (
    summaryService as unknown as SummaryServicePrivate
  ).processUserSummary(user);
}

function firstMockArg<T>(mockFn: jest.Mock): T {
  const calls = mockFn.mock.calls as unknown as Array<[T]>;
  const firstCall = calls[0];
  if (!firstCall) {
    throw new Error('Expected mock to have been called at least once');
  }
  return firstCall[0];
}

describe('SummaryService analytics', () => {
  let service: SummaryService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    summaryLog: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    summaryAnalytics: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const aiServiceMock = {
    analyzeExpenses: jest.fn(),
  };

  const aiUsageServiceMock = {
    hasRemainingCredits: jest.fn(),
    ensureWithinLimit: jest.fn(),
  };

  const emailServiceMock = {
    sendEmail: jest.fn(),
  };

  const dataSourceResolverMock = {
    fetchExpenseContent: jest.fn(),
  };

  const userProfileServiceMock = {
    ensureUserProfile: jest.fn(),
  };

  const dueUser = {
    id: 'user-1',
    email: 'user@example.com',
    data_source_type: 'FILE_UPLOAD',
    data_source_config: { bucket: 'expenses', filePath: 'user-1/file.txt' },
    active_template_id: 'template-1',
    activeTemplate: { content: '<p>{{ totalExpenses }}</p>' },
    summary_email_language: 'EN',
    summary_currency: 'EUR',
    summary_timezone: 'Europe/Warsaw',
    summary_schedule_day: 1,
    summary_schedule_hour: 8,
    next_summary_at: new Date('2026-04-01T06:00:00.000Z'),
    salary_cents: 300_000,
  };

  const analysisResult = {
    summary: {
      userName: 'User',
      currentMonth: 'March 2026',
      salaryAmount: '3,000.00 EUR',
      totalExpenses: '100.00 EUR',
      spendingAmount: '100.00 EUR',
      investedAmount: '0.00 EUR',
      savingsAmount: '2,900.00 EUR',
      savingsMessage: 'A useful summary.',
      expensesList: '<p>Groceries: 100.00 EUR</p>',
    },
    snapshot: {
      currency: 'EUR',
      salaryCents: 300_000,
      totalExpensesCents: 10_000,
      savingsCents: 290_000,
      savingsMessage: 'A useful summary.',
      categories: [
        {
          name: 'Groceries',
          totalCents: 10_000,
          items: [{ name: 'Groceries', amountCents: 10_000 }],
        },
      ],
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-10T10:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummaryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AiService, useValue: aiServiceMock },
        { provide: AiUsageService, useValue: aiUsageServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
        {
          provide: DataSourceResolverService,
          useValue: dataSourceResolverMock,
        },
        { provide: UserProfileService, useValue: userProfileServiceMock },
      ],
    }).compile();

    service = module.get<SummaryService>(SummaryService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('inserts analytics after cron email success when missing', async () => {
    prismaMock.summaryLog.findUnique.mockResolvedValue(null);
    dataSourceResolverMock.fetchExpenseContent.mockResolvedValue('expenses');
    aiServiceMock.analyzeExpenses.mockResolvedValue(analysisResult);
    prismaMock.summaryAnalytics.findUnique.mockResolvedValue(null);
    prismaMock.summaryAnalytics.create.mockResolvedValue({
      id: 'analytics-1',
      user_id: 'user-1',
      period: '2026-03',
      source: SummaryAnalyticsSource.SCHEDULED,
      currency: 'EUR',
      salary_cents: 300_000,
      total_expenses_cents: 10_000,
      savings_cents: 290_000,
      savings_message: 'A useful summary.',
      categories: analysisResult.snapshot.categories,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const action = await callProcessUserSummary(service, dueUser);

    expect(action).toBe('email_sent');

    const upsertArg = firstMockArg<{
      create: { status: SummaryLogStatus };
    }>(prismaMock.summaryLog.upsert);
    expect(upsertArg.create.status).toBe(SummaryLogStatus.SUCCESS);

    const createArg = firstMockArg<{
      data: {
        user_id: string;
        period: string;
        source: SummaryAnalyticsSource;
      };
    }>(prismaMock.summaryAnalytics.create);
    expect(createArg.data).toMatchObject({
      user_id: 'user-1',
      period: '2026-03',
      source: SummaryAnalyticsSource.SCHEDULED,
    });
  });

  it('does not overwrite existing analytics after cron email success', async () => {
    prismaMock.summaryLog.findUnique.mockResolvedValue(null);
    dataSourceResolverMock.fetchExpenseContent.mockResolvedValue('expenses');
    aiServiceMock.analyzeExpenses.mockResolvedValue(analysisResult);
    prismaMock.summaryAnalytics.findUnique.mockResolvedValue({
      id: 'existing',
    });

    await callProcessUserSummary(service, dueUser);

    expect(emailServiceMock.sendEmail).toHaveBeenCalled();
    expect(prismaMock.summaryAnalytics.create).not.toHaveBeenCalled();
  });

  it('skips cron send when SummaryLog is already SUCCESS', async () => {
    prismaMock.summaryLog.findUnique.mockResolvedValue({
      status: SummaryLogStatus.SUCCESS,
    });

    const action = await callProcessUserSummary(service, dueUser);

    expect(action).toBe('already_sent');
    expect(aiServiceMock.analyzeExpenses).not.toHaveBeenCalled();
    expect(prismaMock.summaryAnalytics.create).not.toHaveBeenCalled();
  });

  it('does not write analytics for sendSummaryNow', async () => {
    prismaMock.user.findUnique.mockResolvedValue(dueUser);
    dataSourceResolverMock.fetchExpenseContent.mockResolvedValue('expenses');
    aiServiceMock.analyzeExpenses.mockResolvedValue(analysisResult);

    await service.sendSummaryNow('user-1', 'user@example.com');

    expect(emailServiceMock.sendEmail).toHaveBeenCalled();
    expect(prismaMock.summaryAnalytics.create).not.toHaveBeenCalled();
    expect(prismaMock.summaryAnalytics.findUnique).not.toHaveBeenCalled();
  });

  it('creates manual summary for ended months including the previous month', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      summary_timezone: 'Europe/Warsaw',
      summary_currency: 'PLN',
    });
    prismaMock.summaryAnalytics.findUnique.mockResolvedValue(null);
    prismaMock.summaryAnalytics.create.mockResolvedValue({
      id: 'analytics-1',
      user_id: 'user-1',
      period: '2026-03',
      source: SummaryAnalyticsSource.MANUAL,
      currency: 'PLN',
      salary_cents: 500_000,
      total_expenses_cents: 100_000,
      savings_cents: 400_000,
      savings_message: null,
      categories: [],
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Fake timers: 2026-04-10 → previous month 2026-03 is creatable.
    await service.createManualSummary('user-1', 'user@example.com', {
      period: '2026-03',
      salaryAmount: '5000',
      categories: [{ name: 'Groceries', total: '1000' }],
    });

    expect(prismaMock.summaryAnalytics.create).toHaveBeenCalled();

    await expect(
      service.createManualSummary('user-1', 'user@example.com', {
        period: '2026-04',
        salaryAmount: '5000',
        categories: [{ name: 'Groceries', total: '1000' }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('conflicts when manual summary already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      summary_timezone: 'Europe/Warsaw',
      summary_currency: 'PLN',
    });
    prismaMock.summaryAnalytics.findUnique.mockResolvedValue({
      id: 'existing',
    });

    await expect(
      service.createManualSummary('user-1', 'user@example.com', {
        period: '2026-02',
        salaryAmount: '5000',
        categories: [{ name: 'Groceries', total: '1000' }],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('updates existing ended-month summary and keeps source unchanged', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      summary_timezone: 'Europe/Warsaw',
    });
    prismaMock.summaryAnalytics.findUnique.mockResolvedValue({
      id: 'analytics-1',
      source: SummaryAnalyticsSource.SCHEDULED,
    });
    prismaMock.summaryAnalytics.update.mockResolvedValue({
      id: 'analytics-1',
      user_id: 'user-1',
      period: '2026-03',
      source: SummaryAnalyticsSource.SCHEDULED,
      currency: 'PLN',
      salary_cents: 500_000,
      total_expenses_cents: 100_000,
      savings_cents: 400_000,
      savings_message: 'Updated',
      categories: [{ name: 'Groceries', totalCents: 100_000, items: [] }],
      created_at: new Date(),
      updated_at: new Date(),
    });

    const result = await service.updateManualSummary(
      'user-1',
      'user@example.com',
      {
        period: '2026-03',
        salaryAmount: '5000',
        categories: [{ name: 'Groceries', total: '1000' }],
        savingsMessage: 'Updated',
      },
    );

    const updateArg = firstMockArg<{
      data: Record<string, unknown>;
    }>(prismaMock.summaryAnalytics.update);
    expect(updateArg.data).not.toHaveProperty('source');
    expect(result.source).toBe(SummaryAnalyticsSource.SCHEDULED);
  });

  it('returns null for mySummary on current month', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      summary_timezone: 'Europe/Warsaw',
    });

    await expect(
      service.getMySummary('user-1', '2026-04', 'user@example.com'),
    ).resolves.toBeNull();
    expect(prismaMock.summaryAnalytics.findUnique).not.toHaveBeenCalled();
  });

  it('throws when updating a missing summary', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      summary_timezone: 'Europe/Warsaw',
    });
    prismaMock.summaryAnalytics.findUnique.mockResolvedValue(null);

    await expect(
      service.updateManualSummary('user-1', 'user@example.com', {
        period: '2026-03',
        salaryAmount: '5000',
        categories: [{ name: 'Groceries', total: '1000' }],
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
