import { CanonicalExpense } from './expense-file.parser';
import {
  SummaryCategoryKey,
  isValidCategoryKey,
} from '../summary/summary-category.constants';

export interface AiCategoryAssignment {
  name: string;
  itemIds: number[];
}

export interface AiAssignedGroup {
  name: string;
  expenses: CanonicalExpense[];
}

export interface ExpenseAssignmentSplit {
  /** Expenses whose category came from an in-file `CategoryKey |` prefix — never sent to AI. */
  deterministic: Map<SummaryCategoryKey, CanonicalExpense[]>;
  /** AI-assigned groups, in the order the AI returned them, for expenses without a prefix. */
  aiAssigned: AiAssignedGroup[];
  /** Neither pre-categorized nor claimed by the AI response. */
  unassigned: CanonicalExpense[];
}

/**
 * Merges deterministic `CategoryKey |` prefixes with the AI's itemId assignment
 * for the remaining lines. Pre-categorized expenses are authoritative and are
 * never re-assigned by AI, even if an AI response (incorrectly) references
 * their ID — the AI is never given those IDs in the first place.
 */
export function splitExpensesByAssignment(
  expenses: CanonicalExpense[],
  aiCategories: AiCategoryAssignment[],
): ExpenseAssignmentSplit {
  const byId = new Map(expenses.map((expense) => [expense.id, expense]));
  const assignedIds = new Set<number>();
  const deterministic = new Map<SummaryCategoryKey, CanonicalExpense[]>();

  for (const expense of expenses) {
    if (expense.categoryKey && isValidCategoryKey(expense.categoryKey)) {
      assignedIds.add(expense.id);
      const bucket = deterministic.get(expense.categoryKey) ?? [];
      bucket.push(expense);
      deterministic.set(expense.categoryKey, bucket);
    }
  }

  const aiAssigned: AiAssignedGroup[] = [];
  for (const aiCategory of aiCategories) {
    const name = aiCategory.name?.trim();
    if (!name || !Array.isArray(aiCategory.itemIds)) {
      continue;
    }

    const groupExpenses: CanonicalExpense[] = [];
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
      groupExpenses.push(expense);
    }

    if (groupExpenses.length > 0) {
      aiAssigned.push({ name, expenses: groupExpenses });
    }
  }

  const unassigned = expenses.filter((expense) => !assignedIds.has(expense.id));

  return { deterministic, aiAssigned, unassigned };
}
