import { SummaryEmailLanguage } from '../generated/prisma/client';
import { ExpenseCategory } from './expense-analysis.types';
import { formatMoneyAmount } from './expense-amount.formatter';
import { CanonicalExpense } from './expense-file.parser';

export interface AiCategoryAssignment {
  name: string;
  itemIds: number[];
}

export interface ReconciledExpenseAnalysis {
  salaryAmount: string;
  totalExpenses: string;
  savingsAmount: string;
  categories: ExpenseCategory[];
  totalExpensesCents: number;
  salaryCents: number;
  savingsCents: number;
}

function getOtherCategoryName(language: SummaryEmailLanguage): string {
  return language === SummaryEmailLanguage.EN
    ? 'Other expenses'
    : 'Inne wydatki';
}

/**
 * Builds category totals from canonical expenses + AI itemId assignments.
 * Unknown IDs are ignored; unassigned expenses land in "Other".
 */
export function reconcileExpenseAnalysis(
  expenses: CanonicalExpense[],
  aiCategories: AiCategoryAssignment[],
  salaryCents: number,
  language: SummaryEmailLanguage,
  currency: string,
): ReconciledExpenseAnalysis {
  const byId = new Map(expenses.map((expense) => [expense.id, expense]));
  const assignedIds = new Set<number>();
  const categories: ExpenseCategory[] = [];

  for (const aiCategory of aiCategories) {
    const categoryName = aiCategory.name?.trim();
    if (!categoryName || !Array.isArray(aiCategory.itemIds)) {
      continue;
    }

    const items: ExpenseCategory['items'] = [];
    let totalCents = 0;

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
      totalCents += expense.amountCents;
      items.push({
        name: expense.name,
        amount: formatMoneyAmount(expense.amountCents, language, currency),
      });
    }

    if (items.length === 0) {
      continue;
    }

    categories.push({
      name: categoryName,
      total: formatMoneyAmount(totalCents, language, currency),
      items,
    });
  }

  const unassigned = expenses.filter((expense) => !assignedIds.has(expense.id));
  if (unassigned.length > 0) {
    let totalCents = 0;
    const items = unassigned.map((expense) => {
      totalCents += expense.amountCents;
      return {
        name: expense.name,
        amount: formatMoneyAmount(expense.amountCents, language, currency),
      };
    });

    categories.push({
      name: getOtherCategoryName(language),
      total: formatMoneyAmount(totalCents, language, currency),
      items,
    });
  }

  const totalExpensesCents = expenses.reduce(
    (sum, expense) => sum + expense.amountCents,
    0,
  );
  const savingsCents = salaryCents - totalExpensesCents;

  return {
    salaryAmount: formatMoneyAmount(salaryCents, language, currency),
    totalExpenses: formatMoneyAmount(totalExpensesCents, language, currency),
    savingsAmount: formatMoneyAmount(savingsCents, language, currency),
    categories,
    totalExpensesCents,
    salaryCents,
    savingsCents,
  };
}
