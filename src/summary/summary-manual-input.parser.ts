import { BadRequestException } from '@nestjs/common';
import { parseAmountToNumber } from '../email/expenses-list.builder';
import { amountToCents } from '../ai/expense-amount.formatter';
import {
  StoredSummaryCategory,
  StoredSummaryCategoryItem,
  isValidCategoryKey,
} from './summary-category.constants';
import {
  CreateManualSummaryInput,
  ManualSummaryCategoryInput,
} from './models/summary-analytics.model';

function parseMoneyToCents(value: string, fieldName: string): number {
  const parsed = parseAmountToNumber(value);
  if (parsed === null) {
    throw new BadRequestException(`Invalid amount for ${fieldName}`);
  }

  return amountToCents(parsed);
}

function parseManualCategoryItems(
  items: ManualSummaryCategoryInput['items'],
  categoryName: string,
): StoredSummaryCategoryItem[] {
  if (!items?.length) {
    return [];
  }

  return items.map((item, index) => ({
    name: item.name.trim(),
    amountCents: parseMoneyToCents(
      item.amount,
      `${categoryName} item ${index + 1}`,
    ),
  }));
}

export function parseManualSummaryPayload(input: CreateManualSummaryInput): {
  salaryCents: number;
  totalExpensesCents: number;
  savingsCents: number;
  categories: StoredSummaryCategory[];
  savingsMessage: string | null;
} {
  if (!input.categories.length) {
    throw new BadRequestException('At least one category is required');
  }

  const salaryCents = parseMoneyToCents(input.salaryAmount, 'salaryAmount');
  const categories: StoredSummaryCategory[] = input.categories.map(
    (category, index) => {
      if (!isValidCategoryKey(category.name)) {
        throw new BadRequestException(
          `Invalid category key at position ${index + 1}`,
        );
      }

      const totalCents = parseMoneyToCents(
        category.total,
        `${category.name} total`,
      );
      const items = parseManualCategoryItems(category.items, category.name);

      return {
        name: category.name,
        totalCents,
        items,
      };
    },
  );

  const totalExpensesCents = categories.reduce(
    (sum, category) => sum + category.totalCents,
    0,
  );

  return {
    salaryCents,
    totalExpensesCents,
    savingsCents: salaryCents - totalExpensesCents,
    categories,
    savingsMessage: input.savingsMessage?.trim() || null,
  };
}
