import { ExpenseSummary } from '../ai/expense-summary.types';
import { TemplateRenderValues } from '../email/template-renderer';

export function expenseSummaryToTemplateValues(
  summary: ExpenseSummary,
  fallbackEmail?: string,
): TemplateRenderValues {
  const fallbackName =
    (fallbackEmail || 'Użytkowniku').split('@')[0] || 'Użytkowniku';

  return {
    userName: summary.userName?.trim() || fallbackName,
    currentMonth: summary.currentMonth?.trim() || '',
    salaryAmount: summary.salaryAmount?.trim() || '',
    totalExpenses: summary.totalExpenses?.trim() || '',
    spendingAmount: summary.spendingAmount?.trim() || '',
    investedAmount: summary.investedAmount?.trim() || '',
    savingsAmount: summary.savingsAmount?.trim() || '',
    savingsMessage: summary.savingsMessage?.trim() || '',
    expensesList: summary.expensesList?.trim() || '',
  };
}
