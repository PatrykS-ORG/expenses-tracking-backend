import { parseAmountToNumber } from '../email/expenses-list.builder';
import {
  CANONICAL_CATEGORY_KEYS,
  SummaryCategoryKey,
  isValidCategoryKey,
} from '../summary/summary-category.constants';
import { amountToCents, centsToAmount } from './expense-amount.formatter';

export interface ParsedExpenseLine {
  name: string;
  amountCents: number;
  categoryKey?: SummaryCategoryKey;
}

export interface CanonicalExpense {
  id: number;
  name: string;
  amountCents: number;
  categoryKey?: SummaryCategoryKey;
}

export interface ParsedExpenseFile {
  expenses: CanonicalExpense[];
}

export interface CategorizedExpenseItem {
  name: string;
  amountCents: number;
}

export interface CategorizedExpenseCategory {
  key: SummaryCategoryKey;
  items: CategorizedExpenseItem[];
}

export interface CategorizedExpenseFile {
  categories: CategorizedExpenseCategory[];
  unassigned: CategorizedExpenseItem[];
}

const AMOUNT_AT_END_PATTERN =
  /(-?\d{1,3}(?:[ \u00a0]?\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?)\s*(?:z[lł]|pln|eur|usd|gbp)?\s*$/i;

const CATEGORY_PREFIX_PATTERN = new RegExp(
  `^(${CANONICAL_CATEGORY_KEYS.join('|')})\\s*\\|\\s*(.+)$`,
  'i',
);

export function normalizeExpenseName(name: string): string {
  return name
    .trim()
    .replace(/^[-•*]\s*/, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pl-PL');
}

function stripTrailingAmount(line: string): string | null {
  const match = AMOUNT_AT_END_PATTERN.exec(line);
  if (!match || match.index === undefined) {
    return null;
  }

  return line
    .slice(0, match.index)
    .trim()
    .replace(/[:\-–—]\s*$/, '')
    .trim();
}

function splitCategoryPrefix(line: string): {
  categoryKey?: SummaryCategoryKey;
  remainder: string;
} {
  const match = CATEGORY_PREFIX_PATTERN.exec(line);
  if (!match) {
    return { remainder: line };
  }

  const rawKey = match[1];
  const remainder = match[2]?.trim() ?? '';
  if (!remainder) {
    return { remainder: line };
  }

  const normalizedKey = CANONICAL_CATEGORY_KEYS.find(
    (key) => key.toLowerCase() === rawKey.toLowerCase(),
  );
  if (!normalizedKey || !isValidCategoryKey(normalizedKey)) {
    return { remainder: line };
  }

  return { categoryKey: normalizedKey, remainder };
}

function parseLine(line: string): ParsedExpenseLine | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const withoutBullet = trimmed.replace(/^[-•*]\s*/, '');
  const { categoryKey, remainder } = splitCategoryPrefix(withoutBullet);

  const namePart = stripTrailingAmount(remainder);
  if (!namePart) {
    return null;
  }

  const amountMatch = AMOUNT_AT_END_PATTERN.exec(remainder);
  if (!amountMatch) {
    return null;
  }

  const amount = parseAmountToNumber(amountMatch[1]);
  if (amount === null) {
    return null;
  }

  return {
    name: namePart.replace(/^[-•*]\s*/, '').trim(),
    amountCents: amountToCents(amount),
    ...(categoryKey ? { categoryKey } : {}),
  };
}

function mergeKey(name: string, categoryKey?: SummaryCategoryKey): string {
  return `${categoryKey ?? ''}::${normalizeExpenseName(name)}`;
}

/**
 * Parses free-form expense file text into merged canonical expense rows.
 * Optional `CategoryKey |` prefixes are preserved on each row (not stripped)
 * so cron/manual analysis can skip AI re-categorization for lines the user
 * already assigned. Duplicate names are only merged when they share the same
 * category (or are both unassigned) — the same name in different categories
 * stays separate, matching `parseCategorizedExpenseFile`.
 * Salary is not parsed from the file — it comes from the user profile.
 */
export function parseExpenseFile(rawContent: string): ParsedExpenseFile {
  const merged = new Map<
    string,
    {
      name: string;
      amountCents: number;
      categoryKey?: SummaryCategoryKey;
      order: number;
    }
  >();
  let order = 0;

  for (const rawLine of rawContent.split(/\r?\n/)) {
    const parsed = parseLine(rawLine);
    if (!parsed) {
      continue;
    }

    const key = mergeKey(parsed.name, parsed.categoryKey);
    const existing = merged.get(key);
    if (existing) {
      existing.amountCents += parsed.amountCents;
      continue;
    }

    merged.set(key, {
      name: parsed.name,
      amountCents: parsed.amountCents,
      categoryKey: parsed.categoryKey,
      order: order++,
    });
  }

  const expenses = [...merged.values()]
    .sort((a, b) => a.order - b.order)
    .map((entry, index) => ({
      id: index + 1,
      name: entry.name,
      amountCents: entry.amountCents,
      ...(entry.categoryKey ? { categoryKey: entry.categoryKey } : {}),
    }));

  return { expenses };
}

/**
 * Parses expense file text while preserving optional category prefixes.
 * Items with the same name under the same category (or both unassigned)
 * are merged; the same name in different categories stays separate.
 */
export function parseCategorizedExpenseFile(
  rawContent: string,
): CategorizedExpenseFile {
  const merged = new Map<
    string,
    {
      name: string;
      amountCents: number;
      categoryKey?: SummaryCategoryKey;
      order: number;
    }
  >();
  let order = 0;

  for (const rawLine of rawContent.split(/\r?\n/)) {
    const parsed = parseLine(rawLine);
    if (!parsed) {
      continue;
    }

    const key = mergeKey(parsed.name, parsed.categoryKey);
    const existing = merged.get(key);
    if (existing) {
      existing.amountCents += parsed.amountCents;
      continue;
    }

    merged.set(key, {
      name: parsed.name,
      amountCents: parsed.amountCents,
      categoryKey: parsed.categoryKey,
      order: order++,
    });
  }

  const ordered = [...merged.values()].sort((a, b) => a.order - b.order);
  const byCategory = new Map<SummaryCategoryKey, CategorizedExpenseItem[]>();
  const unassigned: CategorizedExpenseItem[] = [];

  for (const entry of ordered) {
    const item = { name: entry.name, amountCents: entry.amountCents };
    if (entry.categoryKey) {
      const list = byCategory.get(entry.categoryKey) ?? [];
      list.push(item);
      byCategory.set(entry.categoryKey, list);
    } else {
      unassigned.push(item);
    }
  }

  const categories = CANONICAL_CATEGORY_KEYS.filter((key) =>
    byCategory.has(key),
  ).map((key) => ({
    key,
    items: byCategory.get(key)!,
  }));

  return { categories, unassigned };
}

function formatAmountForFile(amountCents: number): string {
  const amount = centsToAmount(amountCents);
  return amount.toFixed(2);
}

/**
 * Writes categorized + unassigned expense items back to storage text.
 * Categorized lines use `CategoryKey | name amount`; unassigned omit the prefix.
 */
export function serializeCategorizedExpenseFile(
  input: CategorizedExpenseFile,
): string {
  const lines: string[] = [];

  for (const key of CANONICAL_CATEGORY_KEYS) {
    const category = input.categories.find((entry) => entry.key === key);
    if (!category) {
      continue;
    }

    for (const item of category.items) {
      const name = item.name.trim();
      if (!name || !Number.isFinite(item.amountCents)) {
        continue;
      }
      lines.push(`${key} | ${name} ${formatAmountForFile(item.amountCents)}`);
    }
  }

  for (const item of input.unassigned) {
    const name = item.name.trim();
    if (!name || !Number.isFinite(item.amountCents)) {
      continue;
    }
    lines.push(`${name} ${formatAmountForFile(item.amountCents)}`);
  }

  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}
