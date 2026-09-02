import { SummaryEmailLanguage } from '../generated/prisma/client';
import { amountToCents, formatMoneyAmount } from './expense-amount.formatter';
import {
  parseCategorizedExpenseFile,
  parseExpenseFile,
  serializeCategorizedExpenseFile,
} from './expense-file.parser';

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
  it('merges duplicates and keeps distinct names separate', () => {
    const parsed = parseExpenseFile(`
- kebab 28zł
- kebab 41zł
- McDonald 15zł
- mcdonald 16zł
- Biedronka - zakupy spozywcze 49,20zł
- Biedronka - Zakupy spozywcze 18,95zł
- Biedronka 10,41zł
`);

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
Internet 24,50zł
Prąd 93.5zl
HBO 14.95
`);

    expect(parsed.expenses.map((e) => e.amountCents)).toEqual([
      2450, 9350, 1495,
    ]);
  });

  it('treats leftover salary-labeled lines as regular expenses', () => {
    const parsed = parseExpenseFile(`
Wypłata: 6700zł
Groceries 100zł
`);

    expect(parsed.expenses).toEqual([
      { id: 1, name: 'Wypłata', amountCents: 670_000 },
      { id: 2, name: 'Groceries', amountCents: 10_000 },
    ]);
  });

  it('preserves category prefixes so AI can skip already-assigned lines', () => {
    const parsed = parseExpenseFile(`
Groceries | Biedronka 45.20 PLN
Transport | Orlen 120.00
Biedronka 10.00
`);

    expect(parsed.expenses).toEqual([
      { id: 1, name: 'Biedronka', amountCents: 4520, categoryKey: 'Groceries' },
      { id: 2, name: 'Orlen', amountCents: 12_000, categoryKey: 'Transport' },
      { id: 3, name: 'Biedronka', amountCents: 1000 },
    ]);
  });

  it('merges same name within the same category but keeps different categories separate', () => {
    const parsed = parseExpenseFile(`
Groceries | Biedronka 10.00
Groceries | biedronka 5.00
DiningOut | Biedronka 20.00
`);

    expect(parsed.expenses).toEqual([
      { id: 1, name: 'Biedronka', amountCents: 1500, categoryKey: 'Groceries' },
      { id: 2, name: 'Biedronka', amountCents: 2000, categoryKey: 'DiningOut' },
    ]);
  });
});

describe('parseCategorizedExpenseFile', () => {
  it('groups prefixed lines and leaves plain lines unassigned', () => {
    const parsed = parseCategorizedExpenseFile(`
Groceries | Biedronka 45.20 PLN
Transport | Orlen 120.00
Netflix 59.00 PLN
`);

    expect(parsed.categories).toEqual([
      {
        key: 'Groceries',
        items: [{ name: 'Biedronka', amountCents: 4520 }],
      },
      {
        key: 'Transport',
        items: [{ name: 'Orlen', amountCents: 12_000 }],
      },
    ]);
    expect(parsed.unassigned).toEqual([{ name: 'Netflix', amountCents: 5900 }]);
  });

  it('merges same name within a category but not across categories', () => {
    const parsed = parseCategorizedExpenseFile(`
Groceries | Biedronka 10.00
Groceries | biedronka 5.00
DiningOut | Biedronka 20.00
`);

    expect(parsed.categories).toEqual([
      {
        key: 'Groceries',
        items: [{ name: 'Biedronka', amountCents: 1500 }],
      },
      {
        key: 'DiningOut',
        items: [{ name: 'Biedronka', amountCents: 2000 }],
      },
    ]);
    expect(parsed.unassigned).toEqual([]);
  });
});

describe('serializeCategorizedExpenseFile', () => {
  it('round-trips categorized and unassigned items', () => {
    const original = {
      categories: [
        {
          key: 'Groceries' as const,
          items: [{ name: 'Biedronka', amountCents: 4520 }],
        },
        {
          key: 'Transport' as const,
          items: [{ name: 'Orlen', amountCents: 12_000 }],
        },
      ],
      unassigned: [{ name: 'Netflix', amountCents: 5900 }],
    };

    const text = serializeCategorizedExpenseFile(original);
    expect(text).toBe(
      'Groceries | Biedronka 45.20\nTransport | Orlen 120.00\nNetflix 59.00\n',
    );

    expect(parseCategorizedExpenseFile(text)).toEqual(original);
  });
});
