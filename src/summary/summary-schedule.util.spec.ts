import {
  computeNextSummaryAt,
  getCurrentCalendarPeriod,
  getSummaryPeriod,
  getZonedDateParts,
  isCreatableSummaryPeriod,
  isEndedSummaryPeriod,
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

  it('evaluates ended and creatable period gates in user timezone', () => {
    const at = new Date('2026-04-10T10:00:00.000Z');
    const timezone = 'Europe/Warsaw';

    expect(getCurrentCalendarPeriod(timezone, at)).toBe('2026-04');
    expect(getSummaryPeriod(timezone, at)).toBe('2026-03');
    expect(isEndedSummaryPeriod('2026-03', timezone, at)).toBe(true);
    expect(isEndedSummaryPeriod('2026-04', timezone, at)).toBe(false);
    expect(isEndedSummaryPeriod('2025-12', timezone, at)).toBe(false);
    expect(isCreatableSummaryPeriod('2026-02', timezone, at)).toBe(true);
    expect(isCreatableSummaryPeriod('2026-01', timezone, at)).toBe(true);
    expect(isCreatableSummaryPeriod('2025-12', timezone, at)).toBe(false);
    // Previous month is creatable once the new month has started.
    expect(isCreatableSummaryPeriod('2026-03', timezone, at)).toBe(true);
    expect(isCreatableSummaryPeriod('2026-04', timezone, at)).toBe(false);
  });
});
