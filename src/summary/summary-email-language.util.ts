import { SummaryEmailLanguage } from '../generated/prisma/client';

export function normalizeSummaryEmailLanguage(
  value?: string | null,
): SummaryEmailLanguage {
  return value === SummaryEmailLanguage.EN
    ? SummaryEmailLanguage.EN
    : SummaryEmailLanguage.PL;
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
  return language === SummaryEmailLanguage.EN
    ? 'Total expenses'
    : 'Razem wydatki';
}

export function getSummaryLanguageInstructions(
  language: SummaryEmailLanguage,
): string {
  if (language === SummaryEmailLanguage.EN) {
    return [
      'Output language: English (EN).',
      'Write ALL text fields in English: currentMonth, category names, subcategory names, savingsMessage.',
      'Use English month names (e.g. "May 2026").',
      'Format PLN amounts as "1,240.00 PLN" unless another currency is clearly present in the file.',
      'Ignore the language of raw expense lines — always output in English.',
    ].join(' ');
  }

  return [
    'Output language: Polish (PL).',
    'Write ALL text fields in Polish: currentMonth, category names, subcategory names, savingsMessage.',
    'Use Polish month names (e.g. "maj 2026").',
    'Format PLN amounts as "1 240,00 zł" unless another currency is clearly present in the file.',
    'Ignore the language of raw expense lines — always output in Polish.',
  ].join(' ');
}
