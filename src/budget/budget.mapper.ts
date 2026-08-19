import { Prisma } from '../generated/prisma/client';
import {
  isValidCategoryKey,
  SummaryCategoryKey,
} from '../summary/summary-category.constants';
import { MonthlyBudgetModel } from './models/monthly-budget.model';

export interface StoredBudgetCategory {
  key: SummaryCategoryKey;
  amountCents: number;
}

export interface MonthlyBudgetRecord {
  id: string;
  user_id: string;
  currency: string;
  categories: unknown;
  created_at: Date;
  updated_at: Date;
}

export function parseStoredBudgetCategories(
  value: unknown,
): StoredBudgetCategory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const categories: StoredBudgetCategory[] = [];
  const seen = new Set<SummaryCategoryKey>();

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const category = entry as { key?: unknown; amountCents?: unknown };
    if (typeof category.key !== 'string' || !isValidCategoryKey(category.key)) {
      continue;
    }
    if (
      typeof category.amountCents !== 'number' ||
      !Number.isInteger(category.amountCents) ||
      category.amountCents < 0
    ) {
      continue;
    }
    if (seen.has(category.key)) {
      continue;
    }

    seen.add(category.key);
    categories.push({
      key: category.key,
      amountCents: category.amountCents,
    });
  }

  return categories;
}

export function budgetCategoriesToPrismaJson(
  categories: StoredBudgetCategory[],
): Prisma.InputJsonValue {
  return categories as unknown as Prisma.InputJsonValue;
}

export function toMonthlyBudgetModel(
  row: MonthlyBudgetRecord,
): MonthlyBudgetModel {
  return {
    id: row.id,
    currency: row.currency,
    categories: parseStoredBudgetCategories(row.categories),
    updatedAt: row.updated_at,
  };
}
