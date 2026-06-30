import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SummaryService } from './summary.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { DataSourceResolverService } from '../data-sources/data-source-resolver.service';
import { UserProfileService } from '../users/user-profile.service';

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
        next_summary_at: true,
      },
    });
    expect(result).toEqual({
      enabled: false,
      schedule_day: 1,
      schedule_hour: 8,
      timezone: 'Europe/Warsaw',
      email_language: 'PL',
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
});
