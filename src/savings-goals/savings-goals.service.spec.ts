import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserProfileService } from '../users/user-profile.service';
import { SavingsGoalsService } from './savings-goals.service';

describe('SavingsGoalsService', () => {
  let service: SavingsGoalsService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    savingsGoalEvent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    savingsGoalItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    savingsGoalContribution: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const userProfileServiceMock = {
    ensureUserProfile: jest.fn(),
  };

  const occurredOn = new Date('2026-06-01T00:00:00.000Z');
  const createdAt = new Date('2026-09-01T00:00:00.000Z');

  const storedContribution = {
    id: 'contrib-1',
    item_id: 'item-1',
    amount_cents: 50_000,
    occurred_on: occurredOn,
    note: null,
    created_at: createdAt,
  };

  const storedItem = {
    id: 'item-1',
    event_id: 'event-1',
    name: 'Wedding suit',
    target_amount_cents: 100_000,
    target_date: null,
    sort_order: 0,
    created_at: createdAt,
    updated_at: createdAt,
    contributions: [storedContribution],
  };

  const storedEvent = {
    id: 'event-1',
    user_id: 'user-1',
    name: 'The wedding',
    currency: 'PLN',
    target_date: null,
    created_at: createdAt,
    updated_at: createdAt,
    items: [storedItem],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    userProfileServiceMock.ensureUserProfile.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingsGoalsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UserProfileService, useValue: userProfileServiceMock },
      ],
    }).compile();

    service = module.get(SavingsGoalsService);
  });

  it('returns an empty list when the user has no events', async () => {
    prismaMock.savingsGoalEvent.findMany.mockResolvedValue([]);

    const result = await service.getMySavingsGoals('user-1', 'a@b.c');

    expect(userProfileServiceMock.ensureUserProfile).toHaveBeenCalledWith(
      'user-1',
      'a@b.c',
    );
    expect(result).toEqual([]);
  });

  it('maps derived progress from stored contributions', async () => {
    prismaMock.savingsGoalEvent.findMany.mockResolvedValue([storedEvent]);

    const result = await service.getMySavingsGoals('user-1', 'a@b.c');

    expect(result).toHaveLength(1);
    expect(result[0].totalTargetCents).toBe(100_000);
    expect(result[0].totalSavedCents).toBe(50_000);
    expect(result[0].progressPercent).toBe(50);
    expect(result[0].items[0].savedCents).toBe(50_000);
    expect(result[0].items[0].remainingCents).toBe(50_000);
    expect(result[0].items[0].progressPercent).toBe(50);
    expect(result[0].items[0].monthlySuggestionCents).toBeNull();
  });

  it('creates an event using the profile summary currency when omitted', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ summary_currency: 'eur' });
    prismaMock.savingsGoalEvent.create.mockResolvedValue({
      ...storedEvent,
      items: [],
      currency: 'EUR',
    });

    const result = await service.createSavingsGoalEvent('user-1', 'a@b.c', {
      name: '  The wedding  ',
    });

    expect(prismaMock.savingsGoalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          user_id: 'user-1',
          name: 'The wedding',
          currency: 'EUR',
          target_date: null,
        },
      }),
    );
    expect(result.currency).toBe('EUR');
  });

  it('rejects an empty event name', async () => {
    await expect(
      service.createSavingsGoalEvent('user-1', 'a@b.c', { name: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsupported currency', async () => {
    await expect(
      service.createSavingsGoalEvent('user-1', 'a@b.c', {
        name: 'The wedding',
        currency: 'BTC',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes an owned event', async () => {
    prismaMock.savingsGoalEvent.findUnique.mockResolvedValue(storedEvent);
    prismaMock.savingsGoalEvent.delete.mockResolvedValue(storedEvent);

    await expect(
      service.deleteSavingsGoalEvent('user-1', 'a@b.c', 'event-1'),
    ).resolves.toBe(true);
    expect(prismaMock.savingsGoalEvent.delete).toHaveBeenCalledWith({
      where: { id: 'event-1' },
    });
  });

  it('hides another user event as not found', async () => {
    prismaMock.savingsGoalEvent.findUnique.mockResolvedValue({
      ...storedEvent,
      user_id: 'other-user',
    });

    await expect(
      service.updateSavingsGoalEvent('user-1', 'a@b.c', 'event-1', {
        name: 'Updated',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates an item on an owned event and appends sort order', async () => {
    prismaMock.savingsGoalEvent.findUnique.mockResolvedValue({
      ...storedEvent,
      items: [],
    });
    prismaMock.savingsGoalItem.aggregate.mockResolvedValue({
      _max: { sort_order: 2 },
    });
    prismaMock.savingsGoalItem.create.mockResolvedValue({});

    await service.createSavingsGoalItem('user-1', 'a@b.c', 'event-1', {
      name: 'Bartender',
      targetAmountCents: 80_000,
    });

    expect(prismaMock.savingsGoalItem.create).toHaveBeenCalledWith({
      data: {
        event_id: 'event-1',
        name: 'Bartender',
        target_amount_cents: 80_000,
        target_date: null,
        sort_order: 3,
      },
    });
  });

  it('rejects a non-positive item target', async () => {
    prismaMock.savingsGoalEvent.findUnique.mockResolvedValue(storedEvent);

    await expect(
      service.createSavingsGoalItem('user-1', 'a@b.c', 'event-1', {
        name: 'Bartender',
        targetAmountCents: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects creating an item on another user event', async () => {
    prismaMock.savingsGoalEvent.findUnique.mockResolvedValue({
      ...storedEvent,
      user_id: 'other-user',
    });

    await expect(
      service.createSavingsGoalItem('user-1', 'a@b.c', 'event-1', {
        name: 'Bartender',
        targetAmountCents: 80_000,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds a contribution on an owned item', async () => {
    prismaMock.savingsGoalItem.findUnique.mockResolvedValue({
      ...storedItem,
      event: { user_id: 'user-1' },
    });
    prismaMock.savingsGoalContribution.create.mockResolvedValue({});
    prismaMock.savingsGoalEvent.findUnique.mockResolvedValue(storedEvent);

    const result = await service.addSavingsGoalContribution(
      'user-1',
      'a@b.c',
      'item-1',
      {
        amountCents: 10_000,
        occurredOn,
      },
    );

    expect(prismaMock.savingsGoalContribution.create).toHaveBeenCalledWith({
      data: {
        item_id: 'item-1',
        amount_cents: 10_000,
        occurred_on: occurredOn,
        note: null,
      },
    });
    expect(result.id).toBe('event-1');
  });

  it('rejects a non-positive contribution amount', async () => {
    prismaMock.savingsGoalItem.findUnique.mockResolvedValue({
      ...storedItem,
      event: { user_id: 'user-1' },
    });

    await expect(
      service.addSavingsGoalContribution('user-1', 'a@b.c', 'item-1', {
        amountCents: 0,
        occurredOn,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('hides another user contribution as not found', async () => {
    prismaMock.savingsGoalContribution.findUnique.mockResolvedValue({
      id: 'contrib-1',
      item: {
        event_id: 'event-1',
        event: { user_id: 'other-user' },
      },
    });

    await expect(
      service.deleteSavingsGoalContribution('user-1', 'a@b.c', 'contrib-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
