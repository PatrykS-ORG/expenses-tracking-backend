import {
  CANONICAL_CATEGORY_KEYS,
  isValidCategoryKey,
  normalizeCategoryName,
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
});
