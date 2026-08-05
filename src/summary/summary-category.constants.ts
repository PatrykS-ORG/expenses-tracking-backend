export const CANONICAL_CATEGORY_KEYS = [
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
] as const;

export type SummaryCategoryKey = (typeof CANONICAL_CATEGORY_KEYS)[number];

const CATEGORY_KEY_SET = new Set<string>(CANONICAL_CATEGORY_KEYS);

/**
 * Lowercased aliases → canonical key.
 * Includes Polish expense headings, English labels, and legacy Food/Housing keys.
 */
const CATEGORY_ALIASES: Record<string, SummaryCategoryKey> = {
  // Bills
  bills: 'Bills',
  'bills & fees': 'Bills',
  rachunki: 'Bills',
  'rachunki i opłaty': 'Bills',
  'rachunki i oplaty': 'Bills',
  'rachunki i opłaty stałe': 'Bills',
  'rachunki i oplaty stale': 'Bills',
  czynsz: 'Bills',
  housing: 'Bills',
  home: 'Bills',
  subscriptions: 'Bills',
  subscription: 'Bills',
  subskrypcje: 'Bills',

  // Groceries
  groceries: 'Groceries',
  food: 'Groceries',
  jedzenie: 'Groceries',
  żywność: 'Groceries',
  zywnosc: 'Groceries',
  'zakupy spożywcze': 'Groceries',
  'zakupy spozywcze': 'Groceries',

  // Dining out
  diningout: 'DiningOut',
  'dining out': 'DiningOut',
  'jedzenie na mieście': 'DiningOut',
  'jedzenie na miescie': 'DiningOut',
  'jedzenie na mieście / fast food': 'DiningOut',
  'jedzenie na miescie / fast food': 'DiningOut',
  'fast food': 'DiningOut',

  // Transport
  transport: 'Transport',
  transportu: 'Transport',
  paliwo: 'Transport',
  fuel: 'Transport',

  // Education
  education: 'Education',
  nauka: 'Education',
  learning: 'Education',

  // Entertainment
  entertainment: 'Entertainment',
  'entertainment & sport': 'Entertainment',
  rozrywka: 'Entertainment',
  'rozrywka i sport': 'Entertainment',
  sport: 'Entertainment',

  // Investments
  investments: 'Investments',
  'investments & savings': 'Investments',
  inwestycje: 'Investments',
  'inwestycje i oszczędności': 'Investments',
  'inwestycje i oszczednosci': 'Investments',
  oszczędności: 'Investments',
  oszczednosci: 'Investments',
  savings: 'Investments',

  // Car
  car: 'Car',
  samochód: 'Car',
  samochod: 'Car',
  'samochód (eksploatacja i części)': 'Car',
  'samochod (eksploatacja i czesci)': 'Car',
  eksploatacja: 'Car',

  // Clothing
  clothing: 'Clothing',
  odzież: 'Clothing',
  odziez: 'Clothing',
  shopping: 'Clothing',
  zakupy: 'Clothing',

  // Snacks
  snacks: 'Snacks',
  'snacks & small spends': 'Snacks',
  'drobne wydatki': 'Snacks',
  'drobne wydatki / przekąski': 'Snacks',
  'drobne wydatki / przekaski': 'Snacks',
  przekąski: 'Snacks',
  przekaski: 'Snacks',

  // Health
  health: 'Health',
  'health & hygiene': 'Health',
  zdrowie: 'Health',
  'zdrowie i higiena': 'Health',
  higiena: 'Health',
  medical: 'Health',

  // Travel
  travel: 'Travel',
  podróże: 'Travel',
  podroze: 'Travel',
  trips: 'Travel',

  // Gifts
  gifts: 'Gifts',
  prezenty: 'Gifts',
  gift: 'Gifts',

  // Other / legacy
  other: 'Other',
  inne: 'Other',
  'inne wydatki': 'Other',
  'other expenses': 'Other',
  okazje: 'Other',
};

export function isValidCategoryKey(value: string): value is SummaryCategoryKey {
  return CATEGORY_KEY_SET.has(value);
}

export function normalizeCategoryName(value: string): SummaryCategoryKey {
  const trimmed = value.trim();
  if (isValidCategoryKey(trimmed)) {
    return trimmed;
  }

  const alias = CATEGORY_ALIASES[trimmed.toLowerCase()];
  if (alias) {
    return alias;
  }

  return 'Other';
}

export interface StoredSummaryCategoryItem {
  name: string;
  amountCents: number;
}

export interface StoredSummaryCategory {
  name: SummaryCategoryKey;
  totalCents: number;
  items: StoredSummaryCategoryItem[];
}
