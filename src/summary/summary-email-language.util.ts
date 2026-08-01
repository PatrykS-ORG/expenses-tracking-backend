import { SummaryEmailLanguage } from '../generated/prisma/client';

export function normalizeSummaryEmailLanguage(
  value?: string | null,
): SummaryEmailLanguage {
  return value === SummaryEmailLanguage.EN
    ? SummaryEmailLanguage.EN
    : SummaryEmailLanguage.PL;
}

/** Localized month + year for a summary period key (`YYYY-MM`). */
export function formatSummaryMonth(
  language: SummaryEmailLanguage,
  period: string,
): string {
  const locale = language === SummaryEmailLanguage.EN ? 'en-US' : 'pl-PL';
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, 1)
    : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

  return date.toLocaleString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

export function getSummaryEmailSubject(
  language: SummaryEmailLanguage,
  currentMonth: string,
  period: string,
): string {
  if (language === SummaryEmailLanguage.EN) {
    return `Expense summary — ${currentMonth || period}`;
  }

  return `Podsumowanie wydatków — ${currentMonth || period}`;
}

export function getExpensesTotalLabel(language: SummaryEmailLanguage): string {
  return language === SummaryEmailLanguage.EN ? 'Total' : 'Razem';
}

export function getSummaryLanguageInstructions(
  language: SummaryEmailLanguage,
): string {
  if (language === SummaryEmailLanguage.EN) {
    return [
      'Output language: English (EN).',
      'Write ALL text fields in English: category names and savingsMessage.',
      'When mentioning amounts in savingsMessage, copy them exactly from the provided canonical expense list / totals.',
      'Ignore the language of raw expense lines — always output in English.',
    ].join(' ');
  }

  return [
    'Output language: Polish (PL).',
    'Write ALL text fields in Polish: category names and savingsMessage.',
    'When mentioning amounts in savingsMessage, copy them exactly from the provided canonical expense list / totals.',
    'Ignore the language of raw expense lines — always output in Polish.',
  ].join(' ');
}
