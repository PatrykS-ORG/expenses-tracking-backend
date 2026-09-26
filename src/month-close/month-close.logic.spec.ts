import { evaluateMonthClosure, sumAllocationCents } from './month-close.logic';

describe('month-close.logic', () => {
  const base = {
    currentPeriod: '2026-10',
    previousPeriod: '2026-09',
    expenseOpenPeriod: '2026-09',
    currency: 'PLN',
  };

  it('requires closure only for a positive leftover that is not yet closed', () => {
    expect(
      evaluateMonthClosure({
        ...base,
        alreadyClosed: false,
        salaryCents: 500_000,
        totalExpensesCents: 200_000,
      }).needsClosure,
    ).toBe(true);

    expect(
      evaluateMonthClosure({
        ...base,
        alreadyClosed: true,
        salaryCents: 500_000,
        totalExpensesCents: 200_000,
      }).needsClosure,
    ).toBe(false);
  });

  it('does not block a zero or negative leftover', () => {
    expect(
      evaluateMonthClosure({
        ...base,
        alreadyClosed: false,
        salaryCents: 200_000,
        totalExpensesCents: 200_000,
      }).needsClosure,
    ).toBe(false);

    expect(
      evaluateMonthClosure({
        ...base,
        alreadyClosed: false,
        salaryCents: 100_000,
        totalExpensesCents: 150_000,
      }).needsClosure,
    ).toBe(false);
  });

  it('does not require closure while the expense file is still the current month', () => {
    expect(
      evaluateMonthClosure({
        ...base,
        expenseOpenPeriod: '2026-10',
        alreadyClosed: false,
        salaryCents: 500_000,
        totalExpensesCents: 0,
      }).needsClosure,
    ).toBe(false);
  });

  it('treats a missing salary as zero income', () => {
    const status = evaluateMonthClosure({
      ...base,
      alreadyClosed: false,
      salaryCents: 0,
      totalExpensesCents: 80_000,
    });
    expect(status.freeSavingsCents).toBe(-80_000);
    expect(status.needsClosure).toBe(false);
  });

  it('still requires December closure after the year rolls over', () => {
    expect(
      evaluateMonthClosure({
        currentPeriod: '2027-01',
        previousPeriod: '2026-12',
        expenseOpenPeriod: '2026-12',
        alreadyClosed: false,
        salaryCents: 500_000,
        totalExpensesCents: 200_000,
        currency: 'PLN',
      }).needsClosure,
    ).toBe(true);
  });

  it('sums allocation cents', () => {
    expect(
      sumAllocationCents([{ amountCents: 10_000 }, { amountCents: 25_000 }]),
    ).toBe(35_000);
  });
});
