import { CanonicalExpense } from '../ai/expense-file.parser';
import {
  AiCategoryAssignment,
  splitExpensesByAssignment,
} from '../ai/expense-category-assignment';
import {
  CANONICAL_CATEGORY_KEYS,
  StoredSummaryCategory,
  StoredSummaryCategoryItem,
  SummaryCategoryKey,
  normalizeCategoryName,
} from './summary-category.constants';

export type { AiCategoryAssignment };

function mergeCategoryItems(
  target: Map<SummaryCategoryKey, StoredSummaryCategory>,
  key: SummaryCategoryKey,
  items: StoredSummaryCategoryItem[],
): void {
  const existing = target.get(key);
  if (!existing) {
    target.set(key, {
      name: key,
      totalCents: items.reduce((sum, item) => sum + item.amountCents, 0),
      items: [...items],
    });
    return;
  }

  existing.items.push(...items);
  existing.totalCents = existing.items.reduce(
    (sum, item) => sum + item.amountCents,
    0,
  );
}

function toStoredItems(
  expenses: CanonicalExpense[],
): StoredSummaryCategoryItem[] {
  return expenses.map((expense) => ({
    name: expense.name,
    amountCents: expense.amountCents,
  }));
}

/**
 * Builds the canonical per-category snapshot used for stored `SummaryAnalytics`.
 * Deterministic `categoryKey` expenses (in-file prefixes) are grouped directly
 * under their canonical key; the rest follow the AI's itemId assignment.
 */
export function buildCanonicalCategoriesFromExpenses(
  expenses: CanonicalExpense[],
  aiCategories: AiCategoryAssignment[],
): StoredSummaryCategory[] {
  const { deterministic, aiAssigned, unassigned } = splitExpensesByAssignment(
    expenses,
    aiCategories,
  );

  const grouped = new Map<SummaryCategoryKey, StoredSummaryCategory>();

  for (const [categoryKey, items] of deterministic) {
    mergeCategoryItems(grouped, categoryKey, toStoredItems(items));
  }

  for (const group of aiAssigned) {
    const canonicalKey = normalizeCategoryName(group.name ?? '');
    mergeCategoryItems(grouped, canonicalKey, toStoredItems(group.expenses));
  }

  if (unassigned.length > 0) {
    mergeCategoryItems(grouped, 'Other', toStoredItems(unassigned));
  }

  return CANONICAL_CATEGORY_KEYS.filter((key) => grouped.has(key)).map(
    (key) => grouped.get(key)!,
  );
}
