import { SummaryEmailLanguage } from '../generated/prisma/client';
import { amountToCents, formatMoneyAmount } from './expense-amount.formatter';
import { parseExpenseFile } from './expense-file.parser';

describe('expense-amount.formatter', () => {
  it('formats Polish PLN with zł suffix', () => {
    expect(formatMoneyAmount(627_925, SummaryEmailLanguage.PL, 'PLN')).toBe(
      '6 279,25 zł',
    );
  });

  it('formats English PLN with currency code', () => {
    expect(formatMoneyAmount(627_925, SummaryEmailLanguage.EN, 'PLN')).toBe(
      '6,279.25 PLN',
    );
  });

  it('formats negative savings', () => {
    expect(formatMoneyAmount(-1_250, SummaryEmailLanguage.PL, 'PLN')).toBe(
      '-12,50 zł',
    );
  });

  it('converts amount to cents safely', () => {
    expect(amountToCents(93.5)).toBe(9350);
    expect(amountToCents(24.5)).toBe(2450);
  });
});

describe('parseExpenseFile', () => {
  it('parses salary, merges duplicates, and keeps distinct names separate', () => {
    const parsed = parseExpenseFile(`
Wypłata: 6700zł
- kebab 28zł
- kebab 41zł
- McDonald 15zł
- mcdonald 16zł
- Biedronka - zakupy spozywcze 49,20zł
- Biedronka - Zakupy spozywcze 18,95zł
- Biedronka 10,41zł
`);

    expect(parsed.salaryCents).toBe(670_000);
    expect(parsed.expenses).toEqual([
      { id: 1, name: 'kebab', amountCents: 6900 },
      { id: 2, name: 'McDonald', amountCents: 3100 },
      {
        id: 3,
        name: 'Biedronka - zakupy spozywcze',
        amountCents: 6815,
      },
      { id: 4, name: 'Biedronka', amountCents: 1041 },
    ]);
  });

  it('supports mixed separators and currency suffixes', () => {
    const parsed = parseExpenseFile(`
pensja 6500
Internet 24,50zł
Prąd 93.5zl
HBO 14.95
`);

    expect(parsed.salaryCents).toBe(650_000);
    expect(parsed.expenses.map((e) => e.amountCents)).toEqual([
      2450, 9350, 1495,
    ]);
  });
});
