const TEMPLATE_PLACEHOLDER_KEYS = [
  'userName',
  'currentMonth',
  'salaryAmount',
  'totalExpenses',
  'savingsAmount',
  'savingsMessage',
  'expensesList',
] as const;

type TemplatePlaceholderKey = (typeof TEMPLATE_PLACEHOLDER_KEYS)[number];

const EXAMPLE_SALARY_PLN = 6500;
const EXAMPLE_EXPENSE_AMOUNTS_PLN = [1240, 300, 100, 486.5] as const;
const EXAMPLE_TOTAL_EXPENSES_PLN = EXAMPLE_EXPENSE_AMOUNTS_PLN.reduce(
  (sum, amount) => sum + amount,
  0,
);
const EXAMPLE_REMAINING_PLN = EXAMPLE_SALARY_PLN - EXAMPLE_TOTAL_EXPENSES_PLN;

const EXAMPLE_EXPENSES_LIST_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;">
  <tr>
    <td style="padding:10px 6px 8px 0;font-weight:700;color:#14532d;border-top:1px solid #10b981;">Zywnosc i dom</td>
    <td align="right" style="padding:10px 0 8px;font-weight:700;color:#14532d;border-top:1px solid #10b981;white-space:nowrap;">1 240,00 zl</td>
  </tr>
  <tr>
    <td style="padding:4px 6px 4px 14px;color:#4d7c0f;">Rozrywka</td>
    <td align="right" style="padding:4px 0;color:#166534;white-space:nowrap;">300,00 zl</td>
  </tr>
  <tr>
    <td style="padding:4px 6px 4px 14px;color:#4d7c0f;">Prezenty i okazje</td>
    <td align="right" style="padding:4px 0;color:#166534;white-space:nowrap;">100,00 zl</td>
  </tr>
  <tr>
    <td style="padding:4px 6px 10px 14px;color:#4d7c0f;">Transport</td>
    <td align="right" style="padding:4px 0 10px 0;color:#166534;white-space:nowrap;">486,50 zl</td>
  </tr>
  <tr>
    <td style="padding:12px 6px 6px 0;font-weight:800;color:#14532d;border-top:1px dashed #10b981;">Razem wydatki</td>
    <td align="right" style="padding:12px 0 6px;font-weight:800;color:#14532d;border-top:1px dashed #10b981;white-space:nowrap;">${formatPlnAmount(EXAMPLE_TOTAL_EXPENSES_PLN)}</td>
  </tr>
</table>
`.trim();

function formatPlnAmount(amount: number): string {
  const [integerPart, fractionalPart] = amount.toFixed(2).split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${groupedInteger},${fractionalPart} zl`;
}

function displayNameFromEmail(email: string | null | undefined): string {
  if (!email) {
    return 'Anna Kowalska';
  }

  const localPart = email.split('@')[0]?.trim();
  if (!localPart) {
    return 'Anna Kowalska';
  }

  const words = localPart
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'Anna Kowalska';
  }

  return words
    .map(
      (word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join(' ');
}

export function getExampleTemplateValues(
  userEmail?: string | null,
): Record<TemplatePlaceholderKey, string> {
  const totalExpensesFormatted = formatPlnAmount(EXAMPLE_TOTAL_EXPENSES_PLN);
  const salaryFormatted = formatPlnAmount(EXAMPLE_SALARY_PLN);
  const remainingFormatted = formatPlnAmount(EXAMPLE_REMAINING_PLN);
  const currentMonth = new Intl.DateTimeFormat('pl-PL', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return {
    userName: displayNameFromEmail(userEmail),
    currentMonth,
    salaryAmount: salaryFormatted,
    totalExpenses: totalExpensesFormatted,
    savingsAmount: `+ ${remainingFormatted}`,
    savingsMessage: `Wyplata wyniosla ${salaryFormatted}, wydatki ${totalExpensesFormatted} - po miesiacu zostalo ${remainingFormatted}.`,
    expensesList: EXAMPLE_EXPENSES_LIST_HTML,
  };
}

export function applyTemplateValues(
  html: string,
  values: Record<TemplatePlaceholderKey, string>,
): string {
  let result = html;

  for (const key of TEMPLATE_PLACEHOLDER_KEYS) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(pattern, values[key]);
  }

  return result;
}
