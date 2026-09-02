import { buildCanonicalCategoriesFromExpenses } from './summary-analytics-canonical.mapper';
import { CanonicalExpense } from '../ai/expense-file.parser';

describe('buildCanonicalCategoriesFromExpenses', () => {
  const expenses: CanonicalExpense[] = [
    { id: 1, name: 'Kebab', amountCents: 9400 },
    { id: 2, name: 'Paliwo', amountCents: 36600 },
    { id: 3, name: 'Czynsz', amountCents: 38700 },
  ];

  it('groups AI assignments under canonical keys', () => {
    const result = buildCanonicalCategoriesFromExpenses(expenses, [
      { name: 'DiningOut', itemIds: [1] },
      { name: 'Transport', itemIds: [2] },
      { name: 'Bills', itemIds: [3] },
    ]);

    expect(result).toEqual([
      {
        name: 'Bills',
        totalCents: 38700,
        items: [{ name: 'Czynsz', amountCents: 38700 }],
      },
      {
        name: 'DiningOut',
        totalCents: 9400,
        items: [{ name: 'Kebab', amountCents: 9400 }],
      },
      {
        name: 'Transport',
        totalCents: 36600,
        items: [{ name: 'Paliwo', amountCents: 36600 }],
      },
    ]);
  });

  it('maps unknown AI labels to Other and merges unassigned expenses', () => {
    const result = buildCanonicalCategoriesFromExpenses(expenses, [
      { name: 'Okazje', itemIds: [1] },
      { name: 'Transport', itemIds: [2, 99] },
    ]);

    expect(result.map((category) => category.name)).toEqual([
      'Transport',
      'Other',
    ]);
    expect(result[1].items.map((item) => item.name)).toEqual([
      'Kebab',
      'Czynsz',
    ]);
  });

  it('maps legacy AI labels via aliases', () => {
    const result = buildCanonicalCategoriesFromExpenses(expenses, [
      { name: 'Food', itemIds: [1] },
      { name: 'Housing', itemIds: [3] },
      { name: 'Transport', itemIds: [2] },
    ]);

    expect(result.map((category) => category.name)).toEqual([
      'Bills',
      'Groceries',
      'Transport',
    ]);
  });

  it('groups deterministic categoryKey expenses without sending them to AI', () => {
    const withPrefix: CanonicalExpense[] = [
      {
        id: 1,
        name: 'ETF VWCE',
        amountCents: 100_000,
        categoryKey: 'Investments',
      },
      { id: 2, name: 'Paliwo', amountCents: 36600 },
    ];

    const result = buildCanonicalCategoriesFromExpenses(withPrefix, [
      { name: 'Transport', itemIds: [2] },
    ]);

    expect(result).toEqual([
      {
        name: 'Transport',
        totalCents: 36600,
        items: [{ name: 'Paliwo', amountCents: 36600 }],
      },
      {
        name: 'Investments',
        totalCents: 100_000,
        items: [{ name: 'ETF VWCE', amountCents: 100_000 }],
      },
    ]);
  });
});
