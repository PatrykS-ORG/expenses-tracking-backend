import { buildExpensesListHtml } from './expenses-list.builder';
import { SummaryEmailLanguage } from '../generated/prisma/client';
import {
  formatSummaryMonth,
  getExpensesTotalLabel,
  normalizeSummaryEmailLanguage,
} from '../summary/summary-email-language.util';
import { getSummaryPeriod } from '../summary/summary-schedule.util';

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
  const currentMonth = formatSummaryMonth(
    resolvedLanguage,
    getSummaryPeriod('Europe/Warsaw'),
  );

  if (resolvedLanguage === SummaryEmailLanguage.EN) {
    const salaryAmount = '8,500.00 PLN';
    const totalExpenses = '6,230.45 PLN';
    const savingsAmount = '2,269.55 PLN';

    return {
      userName,
      currentMonth,
      salaryAmount,
      totalExpenses,
      savingsAmount,
      savingsMessage:
        'The largest share of your salary went to Bills & subscriptions (22.0%), driven mainly by rent. Your single most expensive item was Rent & utilities at 1,450.00 PLN. For the quickest savings, look at Entertainment (420.00 PLN) — cutting one restaurant visit could free up 200+ PLN next month.',
      expensesList: buildExpensesListHtml(
        [
          {
            name: 'Food & home',
            total: '1,450.00 PLN',
            items: [
              { name: 'Groceries', amount: '890.00 PLN' },
              { name: 'Household supplies', amount: '350.00 PLN' },
              { name: 'Drugstore', amount: '210.00 PLN' },
            ],
          },
          {
            name: 'Transport',
            total: '986.50 PLN',
            items: [
              { name: 'Fuel', amount: '620.00 PLN' },
              { name: 'Public transport', amount: '186.50 PLN' },
              { name: 'Parking', amount: '180.00 PLN' },
            ],
          },
          {
            name: 'Entertainment',
            total: '420.00 PLN',
            items: [
              { name: 'Restaurants & cafes', amount: '220.00 PLN' },
              { name: 'Sports & hobbies', amount: '200.00 PLN' },
            ],
          },
          {
            name: 'Bills & subscriptions',
            total: '1,873.95 PLN',
            items: [
              { name: 'Rent & utilities', amount: '1,450.00 PLN' },
              { name: 'Phone & internet', amount: '223.95 PLN' },
              { name: 'Streaming services', amount: '200.00 PLN' },
            ],
          },
          {
            name: 'Health',
            total: '500.00 PLN',
            items: [{ name: 'Pharmacy & medical', amount: '500.00 PLN' }],
          },
        ],
        totalExpenses,
        getExpensesTotalLabel(resolvedLanguage),
        salaryAmount,
        'en',
      ),
    };
  }

  const salaryAmount = '8 500,00 zł';
  const totalExpenses = '6 230,45 zł';
  const savingsAmount = '2 269,55 zł';

  return {
    userName,
    currentMonth,
    salaryAmount,
    totalExpenses,
    savingsAmount,
    savingsMessage:
      'Największą część wypłaty pochłonęły Rachunki i subskrypcje (22,0%) — tu dominuje czynsz. Najdroższy pojedynczy wydatek to Czynsz i media — 1 450,00 zł. Najszybciej zaoszczędzisz w kategorii Rozrywka (420,00 zł) — rezygnacja z jednej wizyty w restauracji to ponad 200 zł mniej w następnym miesiącu.',
    expensesList: buildExpensesListHtml(
      [
        {
          name: 'Żywność i dom',
          total: '1 450,00 zł',
          items: [
            { name: 'Zakupy spożywcze', amount: '890,00 zł' },
            { name: 'Chemia i drogeria', amount: '350,00 zł' },
            { name: 'Artykuły gospodarstwa domowego', amount: '210,00 zł' },
          ],
        },
        {
          name: 'Transport',
          total: '986,50 zł',
          items: [
            { name: 'Paliwo', amount: '620,00 zł' },
            { name: 'Komunikacja miejska', amount: '186,50 zł' },
            { name: 'Parking', amount: '180,00 zł' },
          ],
        },
        {
          name: 'Rozrywka',
          total: '420,00 zł',
          items: [
            { name: 'Restauracje i kawiarnie', amount: '220,00 zł' },
            { name: 'Sport i hobby', amount: '200,00 zł' },
          ],
        },
        {
          name: 'Rachunki i subskrypcje',
          total: '1 873,95 zł',
          items: [
            { name: 'Czynsz i media', amount: '1 450,00 zł' },
            { name: 'Telefon i internet', amount: '223,95 zł' },
            { name: 'Subskrypcje streamingowe', amount: '200,00 zł' },
          ],
        },
        {
          name: 'Zdrowie',
          total: '500,00 zł',
          items: [{ name: 'Apteka i lekarz', amount: '500,00 zł' }],
        },
      ],
      totalExpenses,
      getExpensesTotalLabel(resolvedLanguage),
      salaryAmount,
      'pl',
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
