import { SummaryAnalyticsSource } from '../generated/prisma/client';
import { compareSummaryPeriods } from '../summary/summary-schedule.util';
import { MONTH_CLOSE_ERRORS } from './month-close.errors';

export interface MonthClosureSnapshot {
  needsClosure: boolean;
  period: string;
  currentPeriod: string;
  freeSavingsCents: number;
  salaryCents: number;
  totalExpensesCents: number;
  currency: string;
}

export function evaluateMonthClosure(input: {
  currentPeriod: string;
  previousPeriod: string;
  expenseOpenPeriod: string;
  alreadyClosed: boolean;
  salaryCents: number;
  totalExpensesCents: number;
  currency: string;
}): MonthClosureSnapshot {
  const freeSavingsCents = input.salaryCents - input.totalExpensesCents;
  const monthHasRolled =
    compareSummaryPeriods(input.expenseOpenPeriod, input.currentPeriod) < 0;
  return {
    needsClosure:
      monthHasRolled && !input.alreadyClosed && freeSavingsCents > 0,
    period: input.previousPeriod,
    currentPeriod: input.currentPeriod,
    freeSavingsCents,
    salaryCents: input.salaryCents,
    totalExpensesCents: input.totalExpensesCents,
    currency: input.currency,
  };
}

export function sumAllocationCents(
  allocations: Array<{ amountCents: number }>,
): number {
  return allocations.reduce(
    (sum, allocation) => sum + allocation.amountCents,
    0,
  );
}

export function monthCloseContributionNote(period: string): string {
  return `Domknięcie ${period}`;
}

export function monthCloseAnalyticsSource(): SummaryAnalyticsSource {
  return SummaryAnalyticsSource.MANUAL;
}

export { MONTH_CLOSE_ERRORS };
