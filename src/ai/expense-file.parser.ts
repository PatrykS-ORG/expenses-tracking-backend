import { parseAmountToNumber } from '../email/expenses-list.builder';
import { amountToCents } from './expense-amount.formatter';

export interface ParsedExpenseLine {
  name: string;
  amountCents: number;
}

export interface CanonicalExpense {
  id: number;
  name: string;
  amountCents: number;
}

export interface ParsedExpenseFile {
  salaryCents: number;
  expenses: CanonicalExpense[];
}

const SALARY_NAME_PATTERN =
  /^(wyp[lł]ata|salary|pensja|wynagrodzenie|income|przych[oó]d)\b/i;

const AMOUNT_AT_END_PATTERN =
  /(-?\d{1,3}(?:[ \u00a0]?\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?)\s*(?:z[lł]|pln|eur|usd|gbp)?\s*$/i;

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

function parseLine(line: string): ParsedExpenseLine | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const withoutBullet = trimmed.replace(/^[-•*]\s*/, '');
  const namePart = stripTrailingAmount(withoutBullet);
  if (!namePart) {
    return null;
  }

  const amountMatch = AMOUNT_AT_END_PATTERN.exec(withoutBullet);
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
  };
}

function isSalaryName(name: string): boolean {
  return SALARY_NAME_PATTERN.test(normalizeExpenseName(name));
}

/**
 * Parses free-form expense file text into salary + merged expense rows.
 * Duplicate names (case/whitespace-insensitive) are summed into one row.
 */
export function parseExpenseFile(rawContent: string): ParsedExpenseFile {
  let salaryCents = 0;
  const merged = new Map<
    string,
    { name: string; amountCents: number; order: number }
  >();
  let order = 0;

  for (const rawLine of rawContent.split(/\r?\n/)) {
    const parsed = parseLine(rawLine);
    if (!parsed) {
      continue;
    }

    if (isSalaryName(parsed.name)) {
      salaryCents += parsed.amountCents;
      continue;
    }

    const key = normalizeExpenseName(parsed.name);
    const existing = merged.get(key);
    if (existing) {
      existing.amountCents += parsed.amountCents;
      continue;
    }

    merged.set(key, {
      name: parsed.name,
      amountCents: parsed.amountCents,
      order: order++,
    });
  }

  const expenses = [...merged.values()]
    .sort((a, b) => a.order - b.order)
    .map((entry, index) => ({
      id: index + 1,
      name: entry.name,
      amountCents: entry.amountCents,
    }));

  return { salaryCents, expenses };
}
