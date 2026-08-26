import { SummaryAnalyticsSourceEnum } from './models/summary-analytics-source.enum';
import {
  toSummaryAnalyticsModel,
  type SummaryAnalyticsRecord,
} from './summary-analytics.mapper';

function record(
  overrides: Partial<SummaryAnalyticsRecord> = {},
): SummaryAnalyticsRecord {
  return {
    id: 'row-1',
    period: '2026-03',
    source: 'MANUAL',
    currency: 'PLN',
    salaryCents: 800_000,
    totalExpensesCents: 500_000,
    savingsCents: 300_000,
    savingsMessage: null,
    categories: [],
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('toSummaryAnalyticsModel', () => {
  it('derives invested and consumption spend from categories', () => {
    const model = toSummaryAnalyticsModel(
      record({
        totalExpensesCents: 500_000,
        savingsCents: 300_000,
        categories: [
          {
            name: 'Groceries',
            totalCents: 200_000,
            items: [{ name: 'Biedronka', amountCents: 200_000 }],
          },
          {
            name: 'Investments',
            totalCents: 300_000,
            items: [{ name: 'ETF', amountCents: 300_000 }],
          },
        ],
      }),
    );

    expect(model.investedCents).toBe(300_000);
    expect(model.consumptionSpentCents).toBe(200_000);
    expect(model.totalExpensesCents).toBe(500_000);
    expect(model.savingsCents).toBe(300_000);
    expect(model.source).toBe(SummaryAnalyticsSourceEnum.MANUAL);
  });

  it('returns zero invested when the Investments category is missing', () => {
    const model = toSummaryAnalyticsModel(
      record({
        totalExpensesCents: 10_000,
        savingsCents: 790_000,
        categories: [
          {
            name: 'Groceries',
            totalCents: 10_000,
            items: [{ name: 'Kebab', amountCents: 10_000 }],
          },
        ],
      }),
    );

    expect(model.investedCents).toBe(0);
    expect(model.consumptionSpentCents).toBe(10_000);
  });
});
