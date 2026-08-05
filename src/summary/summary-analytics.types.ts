import { StoredSummaryCategory } from './summary-category.constants';

export interface SummaryAnalyticsSnapshot {
  currency: string;
  salaryCents: number;
  totalExpensesCents: number;
  savingsCents: number;
  savingsMessage: string | null;
  categories: StoredSummaryCategory[];
}
