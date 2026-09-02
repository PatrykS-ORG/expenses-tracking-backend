import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserProfileService } from '../users/user-profile.service';
import { AddSavingsGoalContributionInput } from './dto/add-savings-goal-contribution.input';
import {
  CreateSavingsGoalEventInput,
  UpdateSavingsGoalEventInput,
} from './dto/savings-goal-event.input';
import {
  CreateSavingsGoalItemInput,
  UpdateSavingsGoalItemInput,
} from './dto/savings-goal-item.input';
import {
  SavingsGoalEventRecord,
  toSavingsGoalEventModel,
} from './savings-goals.mapper';
import { SavingsGoalEventModel } from './models/savings-goal-event.model';

const SUPPORTED_SAVINGS_GOAL_CURRENCIES = [
  'PLN',
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CZK',
  'UAH',
] as const;

const NAME_MAX_LENGTH = 100;
const NOTE_MAX_LENGTH = 200;

const eventWithTreeInclude = {
  items: {
    orderBy: { sort_order: 'asc' as const },
    include: {
      contributions: {
        orderBy: { occurred_on: 'asc' as const },
      },
    },
  },
} satisfies Prisma.SavingsGoalEventInclude;

@Injectable()
export class SavingsGoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userProfileService: UserProfileService,
  ) {}

  async getMySavingsGoals(
    userId: string,
    userEmail?: string,
  ): Promise<SavingsGoalEventModel[]> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);

    const rows = await this.prisma.savingsGoalEvent.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' },
      include: eventWithTreeInclude,
    });

    return rows.map((row) => toSavingsGoalEventModel(row));
  }

  async createSavingsGoalEvent(
    userId: string,
    userEmail: string | undefined,
    input: CreateSavingsGoalEventInput,
  ): Promise<SavingsGoalEventModel> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);

    const name = this.parseName(input.name);
    const currency = input.currency
      ? this.parseCurrency(input.currency)
      : await this.resolveDefaultCurrency(userId);
    const targetDate = this.parseOptionalDate(input.targetDate, 'targetDate');

    const row = await this.prisma.savingsGoalEvent.create({
      data: {
        user_id: userId,
        name,
        currency,
        target_date: targetDate,
      },
      include: eventWithTreeInclude,
    });

    return toSavingsGoalEventModel(row);
  }

  async updateSavingsGoalEvent(
    userId: string,
    userEmail: string | undefined,
    eventId: string,
    input: UpdateSavingsGoalEventInput,
  ): Promise<SavingsGoalEventModel> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    await this.requireOwnedEvent(userId, eventId);

    const data: Prisma.SavingsGoalEventUpdateInput = {};
    if (input.name !== undefined) {
      data.name = this.parseName(input.name);
    }
    if (input.currency !== undefined) {
      data.currency = this.parseCurrency(input.currency);
    }
    if (input.targetDate !== undefined) {
      data.target_date = this.parseOptionalDate(input.targetDate, 'targetDate');
    }

    const row = await this.prisma.savingsGoalEvent.update({
      where: { id: eventId },
      data,
      include: eventWithTreeInclude,
    });

    return toSavingsGoalEventModel(row);
  }

  async deleteSavingsGoalEvent(
    userId: string,
    userEmail: string | undefined,
    eventId: string,
  ): Promise<boolean> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    await this.requireOwnedEvent(userId, eventId);

    await this.prisma.savingsGoalEvent.delete({
      where: { id: eventId },
    });

    return true;
  }

  async createSavingsGoalItem(
    userId: string,
    userEmail: string | undefined,
    eventId: string,
    input: CreateSavingsGoalItemInput,
  ): Promise<SavingsGoalEventModel> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    await this.requireOwnedEvent(userId, eventId);

    const name = this.parseName(input.name);
    const targetAmountCents = this.parsePositiveCents(
      input.targetAmountCents,
      'targetAmountCents',
    );
    const targetDate = this.parseOptionalDate(input.targetDate, 'targetDate');

    const maxSort = await this.prisma.savingsGoalItem.aggregate({
      where: { event_id: eventId },
      _max: { sort_order: true },
    });
    const sortOrder = (maxSort._max.sort_order ?? -1) + 1;

    await this.prisma.savingsGoalItem.create({
      data: {
        event_id: eventId,
        name,
        target_amount_cents: targetAmountCents,
        target_date: targetDate,
        sort_order: sortOrder,
      },
    });

    return this.loadOwnedEvent(userId, eventId);
  }

  async updateSavingsGoalItem(
    userId: string,
    userEmail: string | undefined,
    itemId: string,
    input: UpdateSavingsGoalItemInput,
  ): Promise<SavingsGoalEventModel> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const item = await this.requireOwnedItem(userId, itemId);

    const data: Prisma.SavingsGoalItemUpdateInput = {};
    if (input.name !== undefined) {
      data.name = this.parseName(input.name);
    }
    if (input.targetAmountCents !== undefined) {
      data.target_amount_cents = this.parsePositiveCents(
        input.targetAmountCents,
        'targetAmountCents',
      );
    }
    if (input.targetDate !== undefined) {
      data.target_date = this.parseOptionalDate(input.targetDate, 'targetDate');
    }

    await this.prisma.savingsGoalItem.update({
      where: { id: itemId },
      data,
    });

    return this.loadOwnedEvent(userId, item.event_id);
  }

  async deleteSavingsGoalItem(
    userId: string,
    userEmail: string | undefined,
    itemId: string,
  ): Promise<SavingsGoalEventModel> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const item = await this.requireOwnedItem(userId, itemId);

    await this.prisma.savingsGoalItem.delete({
      where: { id: itemId },
    });

    return this.loadOwnedEvent(userId, item.event_id);
  }

  async addSavingsGoalContribution(
    userId: string,
    userEmail: string | undefined,
    itemId: string,
    input: AddSavingsGoalContributionInput,
  ): Promise<SavingsGoalEventModel> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const item = await this.requireOwnedItem(userId, itemId);

    const amountCents = this.parsePositiveCents(
      input.amountCents,
      'amountCents',
    );
    const occurredOn = this.parseRequiredDate(input.occurredOn, 'occurredOn');
    const note = this.parseOptionalNote(input.note);

    await this.prisma.savingsGoalContribution.create({
      data: {
        item_id: itemId,
        amount_cents: amountCents,
        occurred_on: occurredOn,
        note,
      },
    });

    return this.loadOwnedEvent(userId, item.event_id);
  }

  async deleteSavingsGoalContribution(
    userId: string,
    userEmail: string | undefined,
    contributionId: string,
  ): Promise<SavingsGoalEventModel> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);
    const contribution = await this.requireOwnedContribution(
      userId,
      contributionId,
    );

    await this.prisma.savingsGoalContribution.delete({
      where: { id: contributionId },
    });

    return this.loadOwnedEvent(userId, contribution.item.event_id);
  }

  private async resolveDefaultCurrency(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { summary_currency: true },
    });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return this.parseCurrency(user.summary_currency);
  }

  private async loadOwnedEvent(
    userId: string,
    eventId: string,
  ): Promise<SavingsGoalEventModel> {
    const row = await this.requireOwnedEvent(userId, eventId);
    return toSavingsGoalEventModel(row);
  }

  private async requireOwnedEvent(
    userId: string,
    eventId: string,
  ): Promise<SavingsGoalEventRecord> {
    const event = await this.prisma.savingsGoalEvent.findUnique({
      where: { id: eventId },
      include: eventWithTreeInclude,
    });
    if (!event || event.user_id !== userId) {
      throw new NotFoundException('Savings goal event not found');
    }

    return event;
  }

  private async requireOwnedItem(
    userId: string,
    itemId: string,
  ): Promise<{ id: string; event_id: string }> {
    const item = await this.prisma.savingsGoalItem.findUnique({
      where: { id: itemId },
      include: { event: { select: { user_id: true } } },
    });
    if (!item || item.event.user_id !== userId) {
      throw new NotFoundException('Savings goal item not found');
    }

    return item;
  }

  private async requireOwnedContribution(
    userId: string,
    contributionId: string,
  ): Promise<{ id: string; item: { event_id: string } }> {
    const contribution = await this.prisma.savingsGoalContribution.findUnique({
      where: { id: contributionId },
      include: {
        item: {
          select: {
            event_id: true,
            event: { select: { user_id: true } },
          },
        },
      },
    });
    if (!contribution || contribution.item.event.user_id !== userId) {
      throw new NotFoundException('Savings goal contribution not found');
    }

    return contribution;
  }

  private parseName(value: string): string {
    const name = value.trim();
    if (name.length === 0) {
      throw new BadRequestException('Name is required');
    }
    if (name.length > NAME_MAX_LENGTH) {
      throw new BadRequestException(
        `Name must be at most ${NAME_MAX_LENGTH} characters`,
      );
    }
    return name;
  }

  private parseCurrency(value: string): string {
    const currency = value.trim().toUpperCase();
    if (
      !SUPPORTED_SAVINGS_GOAL_CURRENCIES.includes(
        currency as (typeof SUPPORTED_SAVINGS_GOAL_CURRENCIES)[number],
      )
    ) {
      throw new BadRequestException(
        `Unsupported currency. Use one of: ${SUPPORTED_SAVINGS_GOAL_CURRENCIES.join(', ')}`,
      );
    }
    return currency;
  }

  private parsePositiveCents(value: number, field: string): number {
    if (!Number.isInteger(value) || value <= 0) {
      throw new BadRequestException(
        `${field} must be a positive integer in cents`,
      );
    }
    return value;
  }

  private parseRequiredDate(value: Date, field: string): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return value;
  }

  private parseOptionalDate(
    value: Date | null | undefined,
    field: string,
  ): Date | null {
    if (value == null) {
      return null;
    }
    return this.parseRequiredDate(value, field);
  }

  private parseOptionalNote(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }
    const note = value.trim();
    if (note.length === 0) {
      return null;
    }
    if (note.length > NOTE_MAX_LENGTH) {
      throw new BadRequestException(
        `Note must be at most ${NOTE_MAX_LENGTH} characters`,
      );
    }
    return note;
  }
}
