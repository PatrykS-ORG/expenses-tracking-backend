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
): TemplateRenderValues {
  const userName = (userEmail || 'Użytkowniku').split('@')[0] || 'Użytkowniku';
  const now = new Date();
  const currentMonth = now.toLocaleString('pl-PL', {
    month: 'long',
    year: 'numeric',
  });

  return {
    userName,
    currentMonth,
    salaryAmount: '6 500 PLN',
    totalExpenses: '4 250 PLN',
    savingsAmount: '2 250 PLN',
    savingsMessage: 'Świetny wynik! Udało Ci się zostawić ponad 30% wypłaty.',
    expensesList:
      '<li>Jedzenie: 1 350 PLN</li><li>Mieszkanie: 1 900 PLN</li><li>Transport: 420 PLN</li><li>Rozrywka: 580 PLN</li>',
  };
}
