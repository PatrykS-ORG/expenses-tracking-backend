import { SavingsGoalContributionModel } from './models/savings-goal-contribution.model';
import { SavingsGoalEventModel } from './models/savings-goal-event.model';
import { SavingsGoalItemModel } from './models/savings-goal-item.model';

export interface SavingsGoalContributionRecord {
  id: string;
  item_id: string;
  amount_cents: number;
  occurred_on: Date;
  note: string | null;
  created_at: Date;
}

export interface SavingsGoalItemRecord {
  id: string;
  event_id: string;
  name: string;
  target_amount_cents: number;
  target_date: Date | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  contributions?: SavingsGoalContributionRecord[];
}

export interface SavingsGoalEventRecord {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  target_date: Date | null;
  created_at: Date;
  updated_at: Date;
  items?: SavingsGoalItemRecord[];
}

export function progressPercent(
  savedCents: number,
  targetCents: number,
): number {
  if (targetCents <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((savedCents / targetCents) * 100));
}

export function remainingCents(
  targetCents: number,
  savedCents: number,
): number {
  return Math.max(0, targetCents - savedCents);
}

export function monthsUntil(
  targetDate: Date,
  now: Date = new Date(),
): number | null {
  if (targetDate.getTime() <= now.getTime()) {
    return null;
  }

  let total =
    (targetDate.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (targetDate.getUTCMonth() - now.getUTCMonth());

  if (targetDate.getUTCDate() < now.getUTCDate()) {
    total -= 1;
  }

  return Math.max(1, total);
}

export function monthlySuggestionCents(
  remaining: number,
  targetDate: Date | null,
  now: Date = new Date(),
): number | null {
  if (!targetDate) {
    return null;
  }

  const months = monthsUntil(targetDate, now);
  if (months === null) {
    return null;
  }
  if (remaining <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(remaining / months));
}

export function toSavingsGoalContributionModel(
  row: SavingsGoalContributionRecord,
): SavingsGoalContributionModel {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    occurredOn: row.occurred_on,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function toSavingsGoalItemModel(
  row: SavingsGoalItemRecord,
  now: Date = new Date(),
): SavingsGoalItemModel {
  const contributions = [...(row.contributions ?? [])].sort(
    (left, right) => left.occurred_on.getTime() - right.occurred_on.getTime(),
  );
  const savedCents = contributions.reduce(
    (sum, contribution) => sum + contribution.amount_cents,
    0,
  );
  const remaining = remainingCents(row.target_amount_cents, savedCents);

  return {
    id: row.id,
    name: row.name,
    targetAmountCents: row.target_amount_cents,
    targetDate: row.target_date,
    sortOrder: row.sort_order,
    savedCents,
    remainingCents: remaining,
    progressPercent: progressPercent(savedCents, row.target_amount_cents),
    monthlySuggestionCents: monthlySuggestionCents(
      remaining,
      row.target_date,
      now,
    ),
    contributions: contributions.map(toSavingsGoalContributionModel),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSavingsGoalEventModel(
  row: SavingsGoalEventRecord,
  now: Date = new Date(),
): SavingsGoalEventModel {
  const items = [...(row.items ?? [])]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((item) => toSavingsGoalItemModel(item, now));
  const totalTargetCents = items.reduce(
    (sum, item) => sum + item.targetAmountCents,
    0,
  );
  const totalSavedCents = items.reduce((sum, item) => sum + item.savedCents, 0);

  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    targetDate: row.target_date,
    totalTargetCents,
    totalSavedCents,
    progressPercent: progressPercent(totalSavedCents, totalTargetCents),
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
