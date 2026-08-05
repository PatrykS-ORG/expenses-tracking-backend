import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AiUsageService } from '../ai-usage/ai-usage.service';
import { EmailService } from '../email/email.service';
import { DataSourceResolverService } from '../data-sources/data-source-resolver.service';
import { UserProfileService } from '../users/user-profile.service';
import { AiUsageTrigger } from '../generated/prisma/client';

jest.mock('webdav', () => ({
  createClient: jest.fn(),
}));

describe('SummaryService', () => {
  let service: SummaryService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
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

  beforeEach(async () => {
    jest.clearAllMocks();

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

  it('provisions first-time OAuth user before reading schedule', async () => {
    userProfileServiceMock.ensureUserProfile.mockResolvedValue(undefined);
    prismaMock.user.findUnique.mockResolvedValue({
      summary_enabled: false,
      summary_schedule_day: 1,
      summary_schedule_hour: 8,
      summary_timezone: 'Europe/Warsaw',
      summary_email_language: 'PL',
      summary_currency: 'PLN',
      next_summary_at: null,
    });

    const result = await service.getSummarySchedule(
      'oauth-user-1',
      'google.user@example.com',
    );

    expect(userProfileServiceMock.ensureUserProfile).toHaveBeenCalledWith(
      'oauth-user-1',
      'google.user@example.com',
    );
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'oauth-user-1' },
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
    expect(result).toEqual({
      enabled: false,
      schedule_day: 1,
      schedule_hour: 8,
      timezone: 'Europe/Warsaw',
      email_language: 'PL',
      currency: 'PLN',
      next_summary_at: null,
    });
  });

  it('throws when profile still cannot be loaded after provisioning', async () => {
    userProfileServiceMock.ensureUserProfile.mockResolvedValue(undefined);
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      service.getSummarySchedule('oauth-user-1', 'google.user@example.com'),
    ).rejects.toThrow(NotFoundException);
  });

  it('sends a real summary immediately without changing the schedule', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      data_source_type: 'FILE_UPLOAD',
      data_source_config: { bucket: 'expenses', filePath: 'user-1/file.txt' },
      active_template_id: 'template-1',
      activeTemplate: { content: '<p>{{ totalExpenses }}</p>' },
      summary_email_language: 'EN',
      summary_currency: 'EUR',
      summary_timezone: 'Europe/Warsaw',
    });
    dataSourceResolverMock.fetchExpenseContent.mockResolvedValue(
      'Salary: 3000 EUR\nGroceries: 100 EUR',
    );
    aiServiceMock.analyzeExpenses.mockResolvedValue({
      summary: {
        userName: 'User',
        currentMonth: 'July 2026',
        salaryAmount: '3,000.00 EUR',
        totalExpenses: '100.00 EUR',
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
        categories: [],
      },
    });

    await expect(
      service.sendSummaryNow('user-1', 'user@example.com'),
    ).resolves.toBe(true);

    expect(aiServiceMock.analyzeExpenses).toHaveBeenCalledWith(
      'user-1',
      'Salary: 3000 EUR\nGroceries: 100 EUR',
      'EN',
      'EUR',
      '2026-07',
      AiUsageTrigger.MANUAL,
    );
    expect(emailServiceMock.sendEmail).toHaveBeenCalledWith(
      'user@example.com',
      'Expense summary — July 2026',
      '<p>100.00 EUR</p>',
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
