import {
  formatSummaryMonth,
  getExpensesTotalLabel,
  getSummaryEmailSubject,
  getSummaryLanguageInstructions,
  normalizeSummaryEmailLanguage,
} from './summary-email-language.util';
import { SummaryEmailLanguage } from '../generated/prisma/client';

describe('summary-email-language.util', () => {
  it('returns Polish subject by default', () => {
    expect(
      getSummaryEmailSubject(SummaryEmailLanguage.PL, 'maj 2026', '2026-05'),
    ).toContain('Podsumowanie wydatków');
  });

  it('formats a summary period as localized previous-month label', () => {
    expect(formatSummaryMonth(SummaryEmailLanguage.PL, '2026-07')).toBe(
      'lipiec 2026',
    );
    expect(formatSummaryMonth(SummaryEmailLanguage.EN, '2026-07')).toBe(
      'July 2026',
    );
  });

  it('returns English instructions for EN', () => {
    const instructions = getSummaryLanguageInstructions(
      SummaryEmailLanguage.EN,
    );
    expect(instructions).toContain('English');
    expect(instructions).toContain('Ignore the language of raw expense lines');
    expect(instructions).not.toContain('currentMonth');
  });

  it('normalizes invalid values to PL', () => {
    expect(normalizeSummaryEmailLanguage('FR')).toBe(SummaryEmailLanguage.PL);
    expect(normalizeSummaryEmailLanguage('EN')).toBe(SummaryEmailLanguage.EN);
  });

  it('returns localized total label', () => {
    expect(getExpensesTotalLabel(SummaryEmailLanguage.PL)).toBe('Razem');
    expect(getExpensesTotalLabel(SummaryEmailLanguage.EN)).toBe('Total');
  });
});
