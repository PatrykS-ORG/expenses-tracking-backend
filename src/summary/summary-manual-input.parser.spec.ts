import { BadRequestException } from '@nestjs/common';
import { parseManualSummaryPayload } from './summary-manual-input.parser';

describe('parseManualSummaryPayload', () => {
  it('parses salary and category totals into cents', () => {
    const result = parseManualSummaryPayload({
      period: '2026-01',
      salaryAmount: '5 000,00',
      categories: [
        {
          name: 'Groceries',
          total: '500,00',
          items: [{ name: 'Biedronka', amount: '500,00' }],
        },
        { name: 'Transport', total: '200,00' },
      ],
      savingsMessage: 'Saved a bit.',
    });

    expect(result.salaryCents).toBe(500_000);
    expect(result.totalExpensesCents).toBe(70_000);
    expect(result.savingsCents).toBe(430_000);
    expect(result.categories[0].name).toBe('Groceries');
  });

  it('rejects invalid category keys', () => {
    expect(() =>
      parseManualSummaryPayload({
        period: '2026-01',
        salaryAmount: '1000',
        categories: [{ name: 'MysteryBucket', total: '100' }],
      }),
    ).toThrow(BadRequestException);
  });
});
