import { Prisma } from '../generated/prisma/client';
import {
  isValidCategoryKey,
  SummaryCategoryKey,
} from '../summary/summary-category.constants';
import {
  ExtraExpenseModel,
  MonthlyBudgetModel,
} from './models/monthly-budget.model';

export interface StoredBudgetCategory {
  key: SummaryCategoryKey;
  amountCents: number;
}

export interface StoredExtraExpenseCut {
  key: SummaryCategoryKey;
  cutPercent: number;
}

export interface StoredExtraExpense {
  name: string;
  amountCents: number;
  cuts: StoredExtraExpenseCut[];
}

export interface MonthlyBudgetRecord {
  id: string;
  user_id: string;
  currency: string;
  categories: unknown;
  extra_expense: unknown;
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

export function parseStoredExtraExpense(
  value: unknown,
): StoredExtraExpense | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const extra = value as {
    name?: unknown;
    amountCents?: unknown;
    cuts?: unknown;
  };

  if (typeof extra.name !== 'string') {
    return null;
  }
  const name = extra.name.trim();
  if (name.length === 0 || name.length > 100) {
    return null;
  }
  if (
    typeof extra.amountCents !== 'number' ||
    !Number.isInteger(extra.amountCents) ||
    extra.amountCents <= 0
  ) {
    return null;
  }
  if (!Array.isArray(extra.cuts)) {
    return null;
  }

  const cuts: StoredExtraExpenseCut[] = [];
  const seen = new Set<SummaryCategoryKey>();

  for (const entry of extra.cuts) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const cut = entry as { key?: unknown; cutPercent?: unknown };
    if (typeof cut.key !== 'string' || !isValidCategoryKey(cut.key)) {
      continue;
    }
    if (
      typeof cut.cutPercent !== 'number' ||
      !Number.isInteger(cut.cutPercent) ||
      cut.cutPercent < 1 ||
      cut.cutPercent > 100
    ) {
      continue;
    }
    if (seen.has(cut.key)) {
      continue;
    }

    seen.add(cut.key);
    cuts.push({
      key: cut.key,
      cutPercent: cut.cutPercent,
    });
  }

  return {
    name,
    amountCents: extra.amountCents,
    cuts,
  };
}

export function budgetCategoriesToPrismaJson(
  categories: StoredBudgetCategory[],
): Prisma.InputJsonValue {
  return categories as unknown as Prisma.InputJsonValue;
}

export function extraExpenseToPrismaJson(
  extraExpense: StoredExtraExpense | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!extraExpense) {
    return Prisma.DbNull;
  }
  return extraExpense as unknown as Prisma.InputJsonValue;
}

export function toExtraExpenseModel(
  extraExpense: StoredExtraExpense,
): ExtraExpenseModel {
  return {
    name: extraExpense.name,
    amountCents: extraExpense.amountCents,
    cuts: extraExpense.cuts,
  };
}

export function toMonthlyBudgetModel(
  row: MonthlyBudgetRecord,
): MonthlyBudgetModel {
  const extraExpense = parseStoredExtraExpense(row.extra_expense);

  return {
    id: row.id,
    currency: row.currency,
    categories: parseStoredBudgetCategories(row.categories),
    extraExpense: extraExpense ? toExtraExpenseModel(extraExpense) : null,
    updatedAt: row.updated_at,
  };
}
