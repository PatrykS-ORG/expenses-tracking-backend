import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserProfileService } from '../users/user-profile.service';
import { isValidCategoryKey } from '../summary/summary-category.constants';
import {
  ExtraExpenseInput,
  SaveMonthlyBudgetInput,
} from './dto/save-monthly-budget.input';
import {
  budgetCategoriesToPrismaJson,
  extraExpenseToPrismaJson,
  MonthlyBudgetRecord,
  StoredBudgetCategory,
  StoredExtraExpense,
  StoredExtraExpenseCut,
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

const EXTRA_EXPENSE_NAME_MAX_LENGTH = 100;

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
      extra_expense: ReturnType<typeof extraExpenseToPrismaJson>;
    };
    update: {
      currency: string;
      categories: ReturnType<typeof budgetCategoriesToPrismaJson>;
      extra_expense: ReturnType<typeof extraExpenseToPrismaJson>;
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
    const extraExpense = this.parseExtraExpense(input.extraExpense);
    const extraExpenseJson = extraExpenseToPrismaJson(extraExpense);

    const row = await monthlyBudgetDelegate(this.prisma).upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        currency,
        categories: budgetCategoriesToPrismaJson(categories),
        extra_expense: extraExpenseJson,
      },
      update: {
        currency,
        categories: budgetCategoriesToPrismaJson(categories),
        extra_expense: extraExpenseJson,
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

  private parseExtraExpense(
    input: ExtraExpenseInput | null | undefined,
  ): StoredExtraExpense | null {
    if (input == null) {
      return null;
    }

    const name = input.name.trim();
    if (name.length === 0) {
      throw new BadRequestException('Extra expense name is required');
    }
    if (name.length > EXTRA_EXPENSE_NAME_MAX_LENGTH) {
      throw new BadRequestException(
        `Extra expense name must be at most ${EXTRA_EXPENSE_NAME_MAX_LENGTH} characters`,
      );
    }
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new BadRequestException(
        'Extra expense amount must be a positive integer in cents',
      );
    }

    const seenKeys = new Set<string>();
    const cuts: StoredExtraExpenseCut[] = [];

    for (const [index, cut] of input.cuts.entries()) {
      if (!isValidCategoryKey(cut.key)) {
        throw new BadRequestException(
          `Invalid extra expense cut key at position ${index + 1}`,
        );
      }
      if (seenKeys.has(cut.key)) {
        throw new BadRequestException(
          `Duplicate extra expense cut key: ${cut.key}`,
        );
      }
      if (
        !Number.isInteger(cut.cutPercent) ||
        cut.cutPercent < 1 ||
        cut.cutPercent > 100
      ) {
        throw new BadRequestException(
          `Invalid cut percent for ${cut.key}: must be an integer from 1 to 100`,
        );
      }

      seenKeys.add(cut.key);
      cuts.push({
        key: cut.key,
        cutPercent: cut.cutPercent,
      });
    }

    return {
      name,
      amountCents: input.amountCents,
      cuts,
    };
  }
}
