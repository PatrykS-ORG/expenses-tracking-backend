import {
  computeNextSummaryAt,
  getSummaryPeriod,
  getZonedDateParts,
  normalizeTimezone,
} from './summary-schedule.util';

describe('summary-schedule.util', () => {
  it('computes the next occurrence after the reference date', () => {
    const from = new Date('2026-06-14T10:00:00.000Z');
    const next = computeNextSummaryAt({
      day: 1,
      hour: 8,
      timezone: 'Europe/Warsaw',
      from,
    });

    expect(next.getTime()).toBeGreaterThan(from.getTime());
    expect(getZonedDateParts(next, 'Europe/Warsaw').day).toBe(1);
    expect(getZonedDateParts(next, 'Europe/Warsaw').hour).toBe(8);
  });

  it('returns the previous calendar month as summary period', () => {
    const period = getSummaryPeriod(
      'Europe/Warsaw',
      new Date('2026-06-14T10:00:00.000Z'),
    );

    expect(period).toBe('2026-05');
  });

  it('falls back to the default timezone for invalid values', () => {
    expect(normalizeTimezone('Invalid/Zone')).toBe('Europe/Warsaw');
  });
});
