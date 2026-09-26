export interface SummaryScheduleInput {
  day: number;
  hour: number;
  timezone: string;
  from?: Date;
}

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

const DEFAULT_TIMEZONE = 'Europe/Warsaw';

export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function getZonedDateParts(
  date: Date,
  timeZone: string,
): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value ?? '0';
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour') % 24,
  };
}

export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, 0, 0, 0);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedDateParts(new Date(guess), timeZone);
    const targetMs = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
    const actualMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      0,
      0,
      0,
    );
    const delta = targetMs - actualMs;
    if (delta === 0) {
      break;
    }
    guess += delta;
  }

  return new Date(guess);
}

export function clampScheduleDay(day: number): number {
  if (!Number.isFinite(day)) {
    return 1;
  }
  return Math.min(28, Math.max(1, Math.trunc(day)));
}

export function clampScheduleHour(hour: number): number {
  if (!Number.isFinite(hour)) {
    return 8;
  }
  return Math.min(23, Math.max(0, Math.trunc(hour)));
}

export function normalizeTimezone(timezone: string | undefined): string {
  const trimmed = timezone?.trim();
  if (trimmed && isValidTimezone(trimmed)) {
    return trimmed;
  }
  return DEFAULT_TIMEZONE;
}

export function computeNextSummaryAt(input: SummaryScheduleInput): Date {
  const day = clampScheduleDay(input.day);
  const hour = clampScheduleHour(input.hour);
  const timezone = normalizeTimezone(input.timezone);
  const from = input.from ?? new Date();
  const fromParts = getZonedDateParts(from, timezone);

  let year = fromParts.year;
  let month = fromParts.month;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = zonedTimeToUtc(year, month, day, hour, timezone);
    if (candidate.getTime() > from.getTime()) {
      return candidate;
    }

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return zonedTimeToUtc(year, month, day, hour, timezone);
}

export function getSummaryPeriod(
  timezone: string,
  at: Date = new Date(),
): string {
  const parts = getZonedDateParts(at, timezone);
  let year = parts.year;
  let month = parts.month - 1;

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getCurrentCalendarPeriod(
  timezone: string,
  at: Date = new Date(),
): string {
  const parts = getZonedDateParts(at, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

export function previousCalendarPeriod(period: string): string {
  const [yearStr, monthStr] = period.split('-');
  let year = Number(yearStr);
  let month = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return period;
  }
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Earliest YYYY-MM accepted for analytics view / create / update. */
export const EARLIEST_SUMMARY_PERIOD = '2025-01';
export const EARLIEST_CALENDAR_YEAR = 2025;
export const LATEST_CALENDAR_YEAR = 2056;
export const LATEST_SUMMARY_PERIOD = '2056-12';

export const CALENDAR_YEAR_ERRORS = {
  PAST_YEAR_READ_ONLY: 'PAST_YEAR_READ_ONLY',
  YEAR_OUT_OF_RANGE: 'YEAR_OUT_OF_RANGE',
} as const;

export type CalendarYearErrorCode =
  (typeof CALENDAR_YEAR_ERRORS)[keyof typeof CALENDAR_YEAR_ERRORS];

export function isValidSummaryPeriod(period: string): boolean {
  return PERIOD_PATTERN.test(period.trim());
}

export function compareSummaryPeriods(left: string, right: string): number {
  return left.localeCompare(right);
}

export function isOnOrAfterEarliestSummaryPeriod(period: string): boolean {
  return compareSummaryPeriods(period, EARLIEST_SUMMARY_PERIOD) >= 0;
}

export function isOnOrBeforeLatestSummaryPeriod(period: string): boolean {
  return compareSummaryPeriods(period, LATEST_SUMMARY_PERIOD) <= 0;
}

export function extractYearFromPeriod(period: string): number | null {
  if (!isValidSummaryPeriod(period)) return null;
  return Number(period.trim().slice(0, 4));
}

export function isCalendarYearInRange(year: number): boolean {
  return (
    Number.isInteger(year) &&
    year >= EARLIEST_CALENDAR_YEAR &&
    year <= LATEST_CALENDAR_YEAR
  );
}

export function yearPeriodBounds(year: number): { from: string; to: string } {
  const padded = String(year).padStart(4, '0');
  return { from: `${padded}-01`, to: `${padded}-12` };
}

export function getCurrentCalendarYear(
  timezone: string,
  at: Date = new Date(),
): number {
  return getZonedDateParts(at, timezone).year;
}

/**
 * Past calendar years are archived. Years outside 2025–2056 are rejected.
 * Current and future months stay under the ended-month rules.
 */
export function manualSummaryYearBlock(
  period: string,
  timezone: string,
  at: Date = new Date(),
): CalendarYearErrorCode | null {
  const year = extractYearFromPeriod(period);
  if (year == null || !isCalendarYearInRange(year)) {
    return CALENDAR_YEAR_ERRORS.YEAR_OUT_OF_RANGE;
  }
  if (year < getCurrentCalendarYear(timezone, at)) {
    return CALENDAR_YEAR_ERRORS.PAST_YEAR_READ_ONLY;
  }
  return null;
}

export function isEndedSummaryPeriod(
  period: string,
  timezone: string,
  at: Date = new Date(),
): boolean {
  return (
    isOnOrAfterEarliestSummaryPeriod(period) &&
    compareSummaryPeriods(period, getCurrentCalendarPeriod(timezone, at)) < 0
  );
}

/**
 * Manual create is allowed for an ended month in the user's current calendar
 * year. Past years are read-only, and cron never overwrites an existing
 * SummaryAnalytics row for the same period.
 */
export function isCreatableSummaryPeriod(
  period: string,
  timezone: string,
  at: Date = new Date(),
): boolean {
  return isEndedSummaryPeriod(period, timezone, at);
}
