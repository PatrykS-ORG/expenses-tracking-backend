import {
  CALENDAR_YEAR_ERRORS,
  computeNextSummaryAt,
  getCurrentCalendarPeriod,
  getCurrentCalendarYear,
  getSummaryPeriod,
  previousCalendarPeriod,
  getZonedDateParts,
  isCalendarYearInRange,
  isCreatableSummaryPeriod,
  isEndedSummaryPeriod,
  manualSummaryYearBlock,
  normalizeTimezone,
  yearPeriodBounds,
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
    expect(isEndedSummaryPeriod('2025-12', timezone, at)).toBe(true);
    expect(isEndedSummaryPeriod('2024-12', timezone, at)).toBe(false);
    expect(isCreatableSummaryPeriod('2026-02', timezone, at)).toBe(true);
    expect(isCreatableSummaryPeriod('2026-01', timezone, at)).toBe(true);
    expect(isCreatableSummaryPeriod('2025-12', timezone, at)).toBe(true);
    expect(isCreatableSummaryPeriod('2024-12', timezone, at)).toBe(false);
    // Previous month is creatable once the new month has started.
    expect(isCreatableSummaryPeriod('2026-03', timezone, at)).toBe(true);
    expect(isCreatableSummaryPeriod('2026-04', timezone, at)).toBe(false);
  });

  it('bounds selectable years and blocks archived manual edits', () => {
    const newYear = new Date('2026-12-31T23:30:00.000Z');
    expect(getCurrentCalendarYear('Europe/Warsaw', newYear)).toBe(2027);
    expect(getSummaryPeriod('Europe/Warsaw', newYear)).toBe('2026-12');
    expect(isCalendarYearInRange(2025)).toBe(true);
    expect(isCalendarYearInRange(2026)).toBe(true);
    expect(isCalendarYearInRange(2056)).toBe(true);
    expect(isCalendarYearInRange(2024)).toBe(false);
    expect(isCalendarYearInRange(2057)).toBe(false);
    expect(yearPeriodBounds(2026)).toEqual({
      from: '2026-01',
      to: '2026-12',
    });
    expect(manualSummaryYearBlock('2026-12', 'Europe/Warsaw', newYear)).toBe(
      CALENDAR_YEAR_ERRORS.PAST_YEAR_READ_ONLY,
    );
    expect(
      manualSummaryYearBlock(
        '2027-01',
        'Europe/Warsaw',
        new Date('2027-02-02T10:00:00.000Z'),
      ),
    ).toBeNull();
    expect(manualSummaryYearBlock('2057-01', 'Europe/Warsaw', newYear)).toBe(
      CALENDAR_YEAR_ERRORS.YEAR_OUT_OF_RANGE,
    );
  });

  it('shifts a YYYY-MM period back one calendar month', () => {
    expect(previousCalendarPeriod('2026-10')).toBe('2026-09');
    expect(previousCalendarPeriod('2026-01')).toBe('2025-12');
  });
});
