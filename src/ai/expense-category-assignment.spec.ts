import { splitExpensesByAssignment } from './expense-category-assignment';
import { CanonicalExpense } from './expense-file.parser';

describe('splitExpensesByAssignment', () => {
  it('keeps deterministic categoryKey expenses out of the AI-assigned/unassigned buckets', () => {
    const expenses: CanonicalExpense[] = [
      {
        id: 1,
        name: 'ETF VWCE',
        amountCents: 100_000,
        categoryKey: 'Investments',
      },
      { id: 2, name: 'Biedronka', amountCents: 5000 },
      { id: 3, name: 'Netflix', amountCents: 5900 },
    ];

    const result = splitExpensesByAssignment(expenses, [
      { name: 'Groceries', itemIds: [2] },
    ]);

    expect(result.deterministic.get('Investments')).toEqual([expenses[0]]);
    expect(result.aiAssigned).toEqual([
      { name: 'Groceries', expenses: [expenses[1]] },
    ]);
    expect(result.unassigned).toEqual([expenses[2]]);
  });

  it('never lets an AI response re-claim an already deterministic id', () => {
    const expenses: CanonicalExpense[] = [
      {
        id: 1,
        name: 'ETF VWCE',
        amountCents: 100_000,
        categoryKey: 'Investments',
      },
    ];

    const result = splitExpensesByAssignment(expenses, [
      { name: 'Groceries', itemIds: [1] },
    ]);

    expect(result.deterministic.get('Investments')).toEqual([expenses[0]]);
    expect(result.aiAssigned).toEqual([]);
    expect(result.unassigned).toEqual([]);
  });

  it('returns everything as unassigned when the AI response is empty', () => {
    const expenses: CanonicalExpense[] = [
      { id: 1, name: 'Kebab', amountCents: 9400 },
    ];

    const result = splitExpensesByAssignment(expenses, []);

    expect(result.deterministic.size).toBe(0);
    expect(result.aiAssigned).toEqual([]);
    expect(result.unassigned).toEqual(expenses);
  });
});
