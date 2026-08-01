import { SummaryEmailLanguage } from '../generated/prisma/client';
import { reconcileExpenseAnalysis } from './expense-analysis.reconciler';
import { CanonicalExpense } from './expense-file.parser';

describe('reconcileExpenseAnalysis', () => {
  const expenses: CanonicalExpense[] = [
    { id: 1, name: 'Kebab', amountCents: 9400 },
    { id: 2, name: 'Paliwo', amountCents: 36600 },
    { id: 3, name: 'Czynsz', amountCents: 38700 },
    { id: 4, name: 'Zaliczka na wesele', amountCents: 150_000 },
  ];

  it('rebuilds totals from canonical cents and ignores AI amounts', () => {
    const result = reconcileExpenseAnalysis(
      expenses,
      [
        { name: 'Jedzenie', itemIds: [1] },
        { name: 'Transport', itemIds: [2] },
        { name: 'Rachunki', itemIds: [3] },
        { name: 'Okazje', itemIds: [4] },
      ],
      670_000,
      SummaryEmailLanguage.PL,
      'PLN',
    );

    expect(result.totalExpensesCents).toBe(234_700);
    expect(result.savingsCents).toBe(435_300);
    expect(result.totalExpenses).toBe('2 347,00 zł');
    expect(result.savingsAmount).toBe('4 353,00 zł');
    expect(result.categories[0]).toEqual({
      name: 'Jedzenie',
      total: '94,00 zł',
      items: [{ name: 'Kebab', amount: '94,00 zł' }],
    });
  });

  it('puts unassigned expenses into Other and skips unknown/duplicate ids', () => {
    const result = reconcileExpenseAnalysis(
      expenses,
      [
        { name: 'Transport', itemIds: [2, 2, 99] },
        { name: 'Empty', itemIds: [99] },
      ],
      200_000,
      SummaryEmailLanguage.PL,
      'PLN',
    );

    expect(result.categories).toHaveLength(2);
    expect(result.categories[0].name).toBe('Transport');
    expect(result.categories[0].items).toEqual([
      { name: 'Paliwo', amount: '366,00 zł' },
    ]);
    expect(result.categories[1].name).toBe('Inne wydatki');
    expect(result.categories[1].items.map((item) => item.name)).toEqual([
      'Kebab',
      'Czynsz',
      'Zaliczka na wesele',
    ]);
    expect(result.savingsCents).toBe(200_000 - 234_700);
    expect(result.savingsAmount).toBe('-347,00 zł');
  });
});
