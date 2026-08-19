import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserProfileService } from '../users/user-profile.service';
import { isValidCategoryKey } from '../summary/summary-category.constants';
import { SaveMonthlyBudgetInput } from './dto/save-monthly-budget.input';
import {
  budgetCategoriesToPrismaJson,
  MonthlyBudgetRecord,
  StoredBudgetCategory,
  toMonthlyBudgetModel,
} from './budget.mapper';
import { MonthlyBudgetModel } from './models/monthly-budget.model';

const SUPPORTED_BUDGET_CURRENCIES = [
  'PLN',
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CZK',
  'UAH',
] as const;

type MonthlyBudgetDelegate = {
  findUnique: (args: {
    where: { user_id: string };
  }) => Promise<MonthlyBudgetRecord | null>;
  upsert: (args: {
    where: { user_id: string };
    create: {
      user_id: string;
      currency: string;
      categories: ReturnType<typeof budgetCategoriesToPrismaJson>;
    };
    update: {
      currency: string;
      categories: ReturnType<typeof budgetCategoriesToPrismaJson>;
    };
  }) => Promise<MonthlyBudgetRecord>;
};

function monthlyBudgetDelegate(prisma: PrismaService): MonthlyBudgetDelegate {
  return (prisma as unknown as { monthlyBudget: MonthlyBudgetDelegate })
    .monthlyBudget;
}

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userProfileService: UserProfileService,
  ) {}

  async getMyMonthlyBudget(
    userId: string,
    userEmail?: string,
  ): Promise<MonthlyBudgetModel | null> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);

    const row = await monthlyBudgetDelegate(this.prisma).findUnique({
      where: { user_id: userId },
    });

    return row ? toMonthlyBudgetModel(row) : null;
  }

  async saveMonthlyBudget(
    userId: string,
    userEmail: string | undefined,
    input: SaveMonthlyBudgetInput,
  ): Promise<MonthlyBudgetModel> {
    await this.userProfileService.ensureUserProfile(userId, userEmail);

    const currency = this.parseCurrency(input.currency);
    const categories = this.parseCategories(input.categories);

    const row = await monthlyBudgetDelegate(this.prisma).upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        currency,
        categories: budgetCategoriesToPrismaJson(categories),
      },
      update: {
        currency,
        categories: budgetCategoriesToPrismaJson(categories),
      },
    });

    return toMonthlyBudgetModel(row);
  }

  private parseCurrency(value: string): string {
    const currency = value.trim().toUpperCase();
    if (
      !SUPPORTED_BUDGET_CURRENCIES.includes(
        currency as (typeof SUPPORTED_BUDGET_CURRENCIES)[number],
      )
    ) {
      throw new BadRequestException(
        `Unsupported currency. Use one of: ${SUPPORTED_BUDGET_CURRENCIES.join(', ')}`,
      );
    }
    return currency;
  }

  private parseCategories(
    input: SaveMonthlyBudgetInput['categories'],
  ): StoredBudgetCategory[] {
    const seenKeys = new Set<string>();
    const categories: StoredBudgetCategory[] = [];

    for (const [index, category] of input.entries()) {
      if (!isValidCategoryKey(category.key)) {
        throw new BadRequestException(
          `Invalid category key at position ${index + 1}`,
        );
      }
      if (seenKeys.has(category.key)) {
        throw new BadRequestException(
          `Duplicate category key: ${category.key}`,
        );
      }
      if (!Number.isInteger(category.amountCents) || category.amountCents < 0) {
        throw new BadRequestException(
          `Invalid amount for ${category.key}: must be a non-negative integer in cents`,
        );
      }

      seenKeys.add(category.key);
      categories.push({
        key: category.key,
        amountCents: category.amountCents,
      });
    }

    return categories;
  }
}
