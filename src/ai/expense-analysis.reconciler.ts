import { SummaryEmailLanguage } from '../generated/prisma/client';
import { ExpenseCategory } from './expense-analysis.types';
import { formatMoneyAmount } from './expense-amount.formatter';
import { CanonicalExpense } from './expense-file.parser';
import {
  isSavingsLikeCategory,
  normalizeCategoryName,
} from '../summary/summary-category.constants';
import {
  AiCategoryAssignment,
  splitExpensesByAssignment,
} from './expense-category-assignment';

export type { AiCategoryAssignment };

export interface ReconciledExpenseAnalysis {
  salaryAmount: string;
  totalExpenses: string;
  spendingAmount: string;
  investedAmount: string;
  savingsAmount: string;
  categories: ExpenseCategory[];
  totalExpensesCents: number;
  consumptionSpentCents: number;
  investedCents: number;
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
 * Expenses with a deterministic `categoryKey` (from an in-file `CategoryKey |`
 * prefix) are never re-assigned by AI — they are grouped directly. Unknown AI
 * IDs are ignored; everything left unassigned lands in "Other".
 */
export function reconcileExpenseAnalysis(
  expenses: CanonicalExpense[],
  aiCategories: AiCategoryAssignment[],
  salaryCents: number,
  language: SummaryEmailLanguage,
  currency: string,
): ReconciledExpenseAnalysis {
  const { deterministic, aiAssigned, unassigned } = splitExpensesByAssignment(
    expenses,
    aiCategories,
  );

  const grouped = new Map<string, CanonicalExpense[]>();
  const addToCategory = (name: string, items: CanonicalExpense[]): void => {
    if (items.length === 0) {
      return;
    }
    const bucket = grouped.get(name) ?? [];
    bucket.push(...items);
    grouped.set(name, bucket);
  };

  for (const [categoryKey, items] of deterministic) {
    const displayName =
      categoryKey === 'Other' ? getOtherCategoryName(language) : categoryKey;
    addToCategory(displayName, items);
  }

  for (const group of aiAssigned) {
    addToCategory(group.name, group.expenses);
  }

  addToCategory(getOtherCategoryName(language), unassigned);

  let investedCents = 0;
  const categories: ExpenseCategory[] = [];

  for (const [name, items] of grouped) {
    let totalCents = 0;
    const categoryItems = items.map((expense) => {
      totalCents += expense.amountCents;
      return {
        name: expense.name,
        amount: formatMoneyAmount(expense.amountCents, language, currency),
      };
    });

    if (isSavingsLikeCategory(normalizeCategoryName(name))) {
      investedCents += totalCents;
    }

    categories.push({
      name,
      total: formatMoneyAmount(totalCents, language, currency),
      items: categoryItems,
    });
  }

  const totalExpensesCents = expenses.reduce(
    (sum, expense) => sum + expense.amountCents,
    0,
  );
  const consumptionSpentCents = totalExpensesCents - investedCents;
  const savingsCents = salaryCents - totalExpensesCents;

  return {
    salaryAmount: formatMoneyAmount(salaryCents, language, currency),
    totalExpenses: formatMoneyAmount(totalExpensesCents, language, currency),
    spendingAmount: formatMoneyAmount(
      consumptionSpentCents,
      language,
      currency,
    ),
    investedAmount: formatMoneyAmount(investedCents, language, currency),
    savingsAmount: formatMoneyAmount(savingsCents, language, currency),
    categories,
    totalExpensesCents,
    consumptionSpentCents,
    investedCents,
    salaryCents,
    savingsCents,
  };
}
