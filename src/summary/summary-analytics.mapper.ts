import { SummaryAnalytics } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import {
  StoredSummaryCategory,
  StoredSummaryCategoryItem,
  SummaryCategoryKey,
  normalizeCategoryName,
} from './summary-category.constants';
import { SummaryAnalyticsModel } from './models/summary-analytics.model';
import { SummaryAnalyticsSourceEnum } from './models/summary-analytics-source.enum';

export interface SummaryAnalyticsRecord {
  id: string;
  period: string;
  source: SummaryAnalytics['source'];
  currency: string;
  salaryCents: number;
  totalExpensesCents: number;
  savingsCents: number;
  savingsMessage: string | null;
  categories: StoredSummaryCategory[];
  createdAt: Date;
  updatedAt: Date;
}

function parseStoredCategoryItem(
  value: unknown,
): StoredSummaryCategoryItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as { name?: unknown; amountCents?: unknown };
  if (typeof item.name !== 'string' || !item.name.trim()) {
    return null;
  }
  if (
    typeof item.amountCents !== 'number' ||
    !Number.isInteger(item.amountCents)
  ) {
    return null;
  }

  return {
    name: item.name.trim(),
    amountCents: item.amountCents,
  };
}

export function parseStoredCategories(value: unknown): StoredSummaryCategory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const grouped = new Map<SummaryCategoryKey, StoredSummaryCategory>();

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const category = entry as {
      name?: unknown;
      totalCents?: unknown;
      items?: unknown;
    };

    if (typeof category.name !== 'string' || !category.name.trim()) {
      continue;
    }
    if (
      typeof category.totalCents !== 'number' ||
      !Number.isInteger(category.totalCents)
    ) {
      continue;
    }

    const key = normalizeCategoryName(category.name);
    const items = Array.isArray(category.items)
      ? category.items
          .map(parseStoredCategoryItem)
          .filter((item): item is StoredSummaryCategoryItem => item !== null)
      : [];

    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        name: key,
        totalCents: category.totalCents,
        items: [...items],
      });
      continue;
    }

    existing.items.push(...items);
    existing.totalCents += category.totalCents;
  }

  return [...grouped.values()];
}

export function categoriesToPrismaJson(
  categories: StoredSummaryCategory[],
): Prisma.InputJsonValue {
  return categories as unknown as Prisma.InputJsonValue;
}

export function toSummaryAnalyticsModel(
  record: SummaryAnalyticsRecord,
): SummaryAnalyticsModel {
  return {
    id: record.id,
    period: record.period,
    source: record.source as SummaryAnalyticsSourceEnum,
    currency: record.currency,
    salaryCents: record.salaryCents,
    totalExpensesCents: record.totalExpensesCents,
    savingsCents: record.savingsCents,
    savingsMessage: record.savingsMessage,
    categories: record.categories.map((category) => ({
      name: category.name,
      totalCents: category.totalCents,
      items: category.items.map((item) => ({
        name: item.name,
        amountCents: item.amountCents,
      })),
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toSummaryAnalyticsRecord(
  row: SummaryAnalytics,
): SummaryAnalyticsRecord {
  return {
    id: row.id,
    period: row.period,
    source: row.source,
    currency: row.currency,
    salaryCents: row.salary_cents,
    totalExpensesCents: row.total_expenses_cents,
    savingsCents: row.savings_cents,
    savingsMessage: row.savings_message,
    categories: parseStoredCategories(row.categories),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
