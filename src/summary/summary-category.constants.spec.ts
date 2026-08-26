import {
  CANONICAL_CATEGORY_KEYS,
  isSavingsLikeCategory,
  isValidCategoryKey,
  normalizeCategoryName,
  SAVINGS_LIKE_CATEGORY_KEYS,
  sumInvestedCents,
} from './summary-category.constants';

describe('summary-category.constants', () => {
  it('exposes the closed category vocabulary', () => {
    expect(CANONICAL_CATEGORY_KEYS).toEqual([
      'Bills',
      'Groceries',
      'DiningOut',
      'Transport',
      'Education',
      'Entertainment',
      'Investments',
      'Car',
      'Clothing',
      'Snacks',
      'Health',
      'Travel',
      'Gifts',
      'Other',
    ]);
  });

  it('validates canonical keys', () => {
    expect(isValidCategoryKey('Groceries')).toBe(true);
    expect(isValidCategoryKey('Food')).toBe(false);
  });

  it('maps aliases, legacy keys, and unknown labels', () => {
    expect(normalizeCategoryName('Groceries')).toBe('Groceries');
    expect(normalizeCategoryName('zakupy spożywcze')).toBe('Groceries');
    expect(normalizeCategoryName('Food')).toBe('Groceries');
    expect(normalizeCategoryName('Housing')).toBe('Bills');
    expect(normalizeCategoryName('rachunki i opłaty stałe')).toBe('Bills');
    expect(normalizeCategoryName('Inwestycje')).toBe('Investments');
    expect(normalizeCategoryName('Inne wydatki')).toBe('Other');
    expect(normalizeCategoryName('Mystery')).toBe('Other');
  });

  it('treats only Investments as savings-like', () => {
    expect(SAVINGS_LIKE_CATEGORY_KEYS).toEqual(['Investments']);
    expect(isSavingsLikeCategory('Investments')).toBe(true);
    expect(isSavingsLikeCategory('Groceries')).toBe(false);
    expect(isSavingsLikeCategory('Other')).toBe(false);
  });

  it('sums invested cents from savings-like categories', () => {
    expect(
      sumInvestedCents([
        { name: 'Groceries', totalCents: 10_000 },
        { name: 'Investments', totalCents: 50_000 },
        { name: 'Investments', totalCents: 5_000 },
      ]),
    ).toBe(55_000);
    expect(sumInvestedCents([{ name: 'Bills', totalCents: 1_000 }])).toBe(0);
  });
});
