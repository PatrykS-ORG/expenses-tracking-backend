import { CanonicalExpense } from '../ai/expense-file.parser';
import { AiCategoryAssignment } from '../ai/expense-analysis.reconciler';
import {
  CANONICAL_CATEGORY_KEYS,
  StoredSummaryCategory,
  StoredSummaryCategoryItem,
  SummaryCategoryKey,
  normalizeCategoryName,
} from './summary-category.constants';

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

export function buildCanonicalCategoriesFromExpenses(
  expenses: CanonicalExpense[],
  aiCategories: AiCategoryAssignment[],
): StoredSummaryCategory[] {
  const byId = new Map(expenses.map((expense) => [expense.id, expense]));
  const assignedIds = new Set<number>();
  const grouped = new Map<SummaryCategoryKey, StoredSummaryCategory>();

  for (const aiCategory of aiCategories) {
    const canonicalKey = normalizeCategoryName(aiCategory.name ?? '');
    const items: StoredSummaryCategoryItem[] = [];

    for (const itemId of aiCategory.itemIds) {
      if (typeof itemId !== 'number' || !Number.isInteger(itemId)) {
        continue;
      }
      if (assignedIds.has(itemId)) {
        continue;
      }

      const expense = byId.get(itemId);
      if (!expense) {
        continue;
      }

      assignedIds.add(itemId);
      items.push({
        name: expense.name,
        amountCents: expense.amountCents,
      });
    }

    if (items.length > 0) {
      mergeCategoryItems(grouped, canonicalKey, items);
    }
  }

  const unassigned = expenses.filter((expense) => !assignedIds.has(expense.id));
  if (unassigned.length > 0) {
    mergeCategoryItems(
      grouped,
      'Other',
      unassigned.map((expense) => ({
        name: expense.name,
        amountCents: expense.amountCents,
      })),
    );
  }

  return CANONICAL_CATEGORY_KEYS.filter((key) => grouped.has(key)).map(
    (key) => grouped.get(key)!,
  );
}
