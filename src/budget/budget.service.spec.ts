import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserProfileService } from '../users/user-profile.service';

describe('BudgetService', () => {
  let service: BudgetService;

  const prismaMock = {
    monthlyBudget: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const userProfileServiceMock = {
    ensureUserProfile: jest.fn(),
  };

  const storedRow = {
    id: 'budget-1',
    user_id: 'user-1',
    currency: 'PLN',
    categories: [{ key: 'Groceries', amountCents: 80_000 }],
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    updated_at: new Date('2026-08-19T00:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    userProfileServiceMock.ensureUserProfile.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UserProfileService, useValue: userProfileServiceMock },
      ],
    }).compile();

    service = module.get(BudgetService);
  });

  it('returns null when the user has no budget', async () => {
    prismaMock.monthlyBudget.findUnique.mockResolvedValue(null);

    const result = await service.getMyMonthlyBudget('user-1', 'a@b.c');

    expect(userProfileServiceMock.ensureUserProfile).toHaveBeenCalledWith(
      'user-1',
      'a@b.c',
    );
    expect(result).toBeNull();
  });

  it('returns the mapped budget when a row exists', async () => {
    prismaMock.monthlyBudget.findUnique.mockResolvedValue(storedRow);

    const result = await service.getMyMonthlyBudget('user-1', 'a@b.c');

    expect(result).toEqual({
      id: 'budget-1',
      currency: 'PLN',
      categories: [{ key: 'Groceries', amountCents: 80_000 }],
      updatedAt: storedRow.updated_at,
    });
  });

  it('upserts a valid budget', async () => {
    prismaMock.monthlyBudget.upsert.mockResolvedValue(storedRow);

    const result = await service.saveMonthlyBudget('user-1', 'a@b.c', {
      currency: 'pln',
      categories: [{ key: 'Groceries', amountCents: 80_000 }],
    });

    expect(prismaMock.monthlyBudget.upsert).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      create: {
        user_id: 'user-1',
        currency: 'PLN',
        categories: [{ key: 'Groceries', amountCents: 80_000 }],
      },
      update: {
        currency: 'PLN',
        categories: [{ key: 'Groceries', amountCents: 80_000 }],
      },
    });
    expect(result.id).toBe('budget-1');
  });

  it('rejects an invalid category key', async () => {
    await expect(
      service.saveMonthlyBudget('user-1', 'a@b.c', {
        currency: 'PLN',
        categories: [{ key: 'Food', amountCents: 100 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate category key', async () => {
    await expect(
      service.saveMonthlyBudget('user-1', 'a@b.c', {
        currency: 'PLN',
        categories: [
          { key: 'Groceries', amountCents: 100 },
          { key: 'Groceries', amountCents: 200 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a negative amount', async () => {
    await expect(
      service.saveMonthlyBudget('user-1', 'a@b.c', {
        currency: 'PLN',
        categories: [{ key: 'Groceries', amountCents: -1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsupported currency', async () => {
    await expect(
      service.saveMonthlyBudget('user-1', 'a@b.c', {
        currency: 'BTC',
        categories: [{ key: 'Groceries', amountCents: 100 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
