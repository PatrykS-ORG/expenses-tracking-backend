import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserProfileService } from '../users/user-profile.service';
import { MonthCloseClock } from './month-close.clock.service';
import { MONTH_CLOSE_ERRORS } from './month-close.errors';
import { MonthCloseService } from './month-close.service';

describe('MonthCloseService', () => {
  let service: MonthCloseService;

  const prismaMock = {
    user: { findUnique: jest.fn() },
    monthClose: { findUnique: jest.fn() },
    savingsGoalItem: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const userProfileServiceMock = {
    ensureUserProfile: jest.fn(),
  };
  const clockMock = {
    now: jest.fn(),
  };
  const dataSourcesServiceMock = {
    readExpenseFileContentOrEmpty: jest.fn(),
    replaceExpenseFileContent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    userProfileServiceMock.ensureUserProfile.mockResolvedValue(undefined);
    clockMock.now.mockReturnValue(new Date('2026-10-01T08:00:00.000Z'));
    prismaMock.user.findUnique.mockResolvedValue({
      salary_cents: 500_000,
      summary_currency: 'PLN',
      summary_timezone: 'Europe/Warsaw',
    });
    prismaMock.monthClose.findUnique.mockResolvedValue(null);
    dataSourcesServiceMock.readExpenseFileContentOrEmpty.mockResolvedValue(
      'Groceries | Biedronka 100.00\n',
    );
    dataSourcesServiceMock.replaceExpenseFileContent.mockResolvedValue(
      undefined,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonthCloseService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UserProfileService, useValue: userProfileServiceMock },
        { provide: MonthCloseClock, useValue: clockMock },
        { provide: DataSourcesService, useValue: dataSourcesServiceMock },
      ],
    }).compile();

    service = module.get(MonthCloseService);
  });

  it('reports needsClosure for a positive leftover in a new month', async () => {
    const status = await service.getStatus('user-1', 'a@b.c');

    expect(status).toMatchObject({
      needsClosure: true,
      period: '2026-09',
      currentPeriod: '2026-10',
      salaryCents: 500_000,
      totalExpensesCents: 10_000,
      freeSavingsCents: 490_000,
      currency: 'PLN',
    });
  });

  it('does not require closure when leftover is negative', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      salary_cents: 5_000,
      summary_currency: 'PLN',
      summary_timezone: 'Europe/Warsaw',
    });

    const status = await service.getStatus('user-1', 'a@b.c');
    expect(status.needsClosure).toBe(false);
    expect(status.freeSavingsCents).toBe(-5_000);
  });

  it('does not require closure when the previous period is already closed', async () => {
    prismaMock.monthClose.findUnique.mockResolvedValue({ id: 'close-1' });

    const status = await service.getStatus('user-1', 'a@b.c');
    expect(status.needsClosure).toBe(false);
  });

  it('honors an explicit testNow override around a Warsaw month boundary', async () => {
    clockMock.now.mockImplementation((explicit?: string | null) =>
      explicit ? new Date(explicit) : new Date('2026-09-10T12:00:00.000Z'),
    );

    const status = await service.getStatus(
      'user-1',
      'a@b.c',
      '2026-10-01T00:00:00.000+02:00',
    );
    expect(clockMock.now).toHaveBeenCalledWith('2026-10-01T00:00:00.000+02:00');
    expect(status.period).toBe('2026-09');
    expect(status.currentPeriod).toBe('2026-10');
  });

  it('blocks writes while the previous month still needs closure', async () => {
    await expect(
      service.assertMonthWritable('user-1', 'a@b.c'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects closeMonth when allocations do not match leftover', async () => {
    await expect(
      service.closeMonth('user-1', 'a@b.c', {
        period: '2026-09',
        allocations: [{ itemId: 'item-1', amountCents: 100 }],
      }),
    ).rejects.toMatchObject({ message: MONTH_CLOSE_ERRORS.AMOUNT_MISMATCH });
  });

  it('rejects a currency mismatch between event and summary currency', async () => {
    prismaMock.savingsGoalItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        event: { user_id: 'user-1', currency: 'EUR' },
      },
    ]);

    await expect(
      service.closeMonth('user-1', 'a@b.c', {
        period: '2026-09',
        allocations: [{ itemId: 'item-1', amountCents: 490_000 }],
      }),
    ).rejects.toMatchObject({ message: MONTH_CLOSE_ERRORS.CURRENCY_MISMATCH });
  });

  it('rejects an item owned by another user', async () => {
    prismaMock.savingsGoalItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        event: { user_id: 'other-user', currency: 'PLN' },
      },
    ]);

    await expect(
      service.closeMonth('user-1', 'a@b.c', {
        period: '2026-09',
        allocations: [{ itemId: 'item-1', amountCents: 490_000 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates contributions, snapshots analytics, and clears the file', async () => {
    prismaMock.savingsGoalItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        event: { user_id: 'user-1', currency: 'PLN' },
      },
    ]);
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => {
        const tx = {
          savingsGoalContribution: { create: jest.fn() },
          summaryAnalytics: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          monthClose: { create: jest.fn() },
        };
        await fn(tx);
        expect(tx.savingsGoalContribution.create).toHaveBeenCalledTimes(1);
        expect(tx.summaryAnalytics.create).toHaveBeenCalledTimes(1);
        expect(tx.monthClose.create).toHaveBeenCalledTimes(1);
      },
    );
    prismaMock.monthClose.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'close-1' });

    const status = await service.closeMonth('user-1', 'a@b.c', {
      period: '2026-09',
      allocations: [{ itemId: 'item-1', amountCents: 490_000 }],
    });

    expect(
      dataSourcesServiceMock.replaceExpenseFileContent,
    ).toHaveBeenCalledWith('user-1', 'a@b.c', '');
    expect(status.needsClosure).toBe(false);
  });

  it('rejects a second close of the same period', async () => {
    prismaMock.monthClose.findUnique.mockResolvedValue({ id: 'close-1' });

    await expect(
      service.closeMonth('user-1', 'a@b.c', {
        period: '2026-09',
        allocations: [{ itemId: 'item-1', amountCents: 490_000 }],
      }),
    ).rejects.toMatchObject({ message: MONTH_CLOSE_ERRORS.ALREADY_CLOSED });
  });
});
