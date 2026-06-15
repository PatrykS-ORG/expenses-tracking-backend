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
