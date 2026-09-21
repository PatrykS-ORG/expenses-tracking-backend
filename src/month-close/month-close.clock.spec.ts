import {
  parseTestNow,
  resolveMonthCloseNow,
  runWithMonthCloseNow,
} from './month-close.clock';

describe('month-close.clock', () => {
  const fallback = new Date('2026-09-10T12:00:00.000Z');

  it('parses ISO timestamps and rejects invalid values', () => {
    expect(parseTestNow('2026-10-01T08:00:00.000Z')?.toISOString()).toBe(
      '2026-10-01T08:00:00.000Z',
    );
    expect(parseTestNow('not-a-date')).toBeNull();
    expect(parseTestNow(null)).toBeNull();
  });

  it('ignores overrides in production', () => {
    const now = resolveMonthCloseNow({
      explicit: '2026-10-01T08:00:00.000Z',
      envNow: '2026-11-01T08:00:00.000Z',
      nodeEnv: 'production',
      fallback,
    });
    expect(now.toISOString()).toBe(fallback.toISOString());
  });

  it('prefers an explicit override, then ALS, then TEST_NOW_ISO', () => {
    const explicit = resolveMonthCloseNow({
      explicit: '2026-10-01T08:00:00.000Z',
      envNow: '2026-11-01T08:00:00.000Z',
      nodeEnv: 'test',
      fallback,
    });
    expect(explicit.toISOString()).toBe('2026-10-01T08:00:00.000Z');

    const fromEnv = resolveMonthCloseNow({
      envNow: '2026-11-01T08:00:00.000Z',
      nodeEnv: 'development',
      fallback,
    });
    expect(fromEnv.toISOString()).toBe('2026-11-01T08:00:00.000Z');

    const fromAls = runWithMonthCloseNow(
      new Date('2026-12-01T08:00:00.000Z'),
      () =>
        resolveMonthCloseNow({
          envNow: '2026-11-01T08:00:00.000Z',
          nodeEnv: 'test',
          fallback,
        }),
    );
    expect(fromAls.toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });
});
