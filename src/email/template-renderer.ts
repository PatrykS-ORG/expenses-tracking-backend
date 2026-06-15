import { buildExpensesListHtml } from './expenses-list.builder';
import { SummaryEmailLanguage } from '../generated/prisma/client';
import {
  getExpensesTotalLabel,
  normalizeSummaryEmailLanguage,
} from '../summary/summary-email-language.util';

export interface TemplateRenderValues {
  userName: string;
  currentMonth: string;
  salaryAmount: string;
  totalExpenses: string;
  savingsAmount: string;
  savingsMessage: string;
  expensesList: string;
}

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function applyTemplateValues(
  html: string,
  values: TemplateRenderValues,
): string {
  return html.replace(
    PLACEHOLDER_REGEX,
    (_, key: keyof TemplateRenderValues) => {
      const rawValue = values[key];
      return rawValue ?? '';
    },
  );
}

export function getExampleTemplateValues(
  userEmail?: string,
  language: SummaryEmailLanguage = SummaryEmailLanguage.PL,
): TemplateRenderValues {
  const resolvedLanguage = normalizeSummaryEmailLanguage(language);
  const userName = (userEmail || 'Użytkowniku').split('@')[0] || 'Użytkowniku';
  const now = new Date();
  const locale =
    resolvedLanguage === SummaryEmailLanguage.EN ? 'en-US' : 'pl-PL';
  const currentMonth = now.toLocaleString(locale, {
    month: 'long',
    year: 'numeric',
  });

  if (resolvedLanguage === SummaryEmailLanguage.EN) {
    return {
      userName,
      currentMonth,
      salaryAmount: '6,500.00 PLN',
      totalExpenses: '2,126.50 PLN',
      savingsAmount: '4,373.50 PLN',
      savingsMessage:
        'Salary was 6,500.00 PLN and expenses 2,126.50 PLN — 4,373.50 PLN remained for the month.',
      expensesList: buildExpensesListHtml(
        [
          {
            name: 'Food & home',
            total: '1,240.00 PLN',
            items: [
              { name: 'Groceries', amount: '890.00 PLN' },
              { name: 'Household supplies', amount: '350.00 PLN' },
            ],
          },
          {
            name: 'Entertainment',
            total: '300.00 PLN',
            items: [
              { name: 'Squash', amount: '50.00 PLN' },
              { name: 'Bowling', amount: '150.00 PLN' },
              { name: 'Ballroom dance', amount: '100.00 PLN' },
            ],
          },
          {
            name: 'Transport',
            total: '586.50 PLN',
            items: [{ name: 'Fuel & commute', amount: '586.50 PLN' }],
          },
        ],
        '2,126.50 PLN',
        getExpensesTotalLabel(resolvedLanguage),
      ),
    };
  }

  return {
    userName,
    currentMonth,
    salaryAmount: '6 500,00 zł',
    totalExpenses: '2 126,50 zł',
    savingsAmount: '4 373,50 zł',
    savingsMessage:
      'Wypłata wyniosła 6 500,00 zł, wydatki 2 126,50 zł — na koniec miesiąca zostało 4 373,50 zł.',
    expensesList: buildExpensesListHtml(
      [
        {
          name: 'Żywność i dom',
          total: '1 240,00 zł',
          items: [
            { name: 'Zakupy spożywcze', amount: '890,00 zł' },
            { name: 'Chemia i drogeria', amount: '350,00 zł' },
          ],
        },
        {
          name: 'Rozrywka',
          total: '300,00 zł',
          items: [
            { name: 'Squash', amount: '50,00 zł' },
            { name: 'Kręgle', amount: '150,00 zł' },
            { name: 'Taniec towarzyski', amount: '100,00 zł' },
          ],
        },
        {
          name: 'Transport',
          total: '586,50 zł',
          items: [{ name: 'Paliwo i komunikacja', amount: '586,50 zł' }],
        },
      ],
      '2 126,50 zł',
      getExpensesTotalLabel(resolvedLanguage),
    ),
  };
}

export function getExampleTestEmailSubject(
  language: SummaryEmailLanguage,
  currentMonth: string,
): string {
  const resolvedLanguage = normalizeSummaryEmailLanguage(language);
  const prefix =
    resolvedLanguage === SummaryEmailLanguage.EN
      ? 'Test summary'
      : 'Test podsumowania';
  return `${prefix} — ${currentMonth}`;
}
