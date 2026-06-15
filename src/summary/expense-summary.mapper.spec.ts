import { expenseSummaryToTemplateValues } from './expense-summary.mapper';

describe('expenseSummaryToTemplateValues', () => {
  it('maps AI summary fields to template placeholders', () => {
    const values = expenseSummaryToTemplateValues(
      {
        userName: 'Patryk',
        currentMonth: 'maj 2026',
        salaryAmount: '6500 PLN',
        totalExpenses: '4200 PLN',
        savingsAmount: '2300 PLN',
        savingsMessage: 'Dobra robota',
        expensesList: '<li>Jedzenie: 1200 PLN</li>',
      },
      'patryk@example.com',
    );

    expect(values.userName).toBe('Patryk');
    expect(values.currentMonth).toBe('maj 2026');
    expect(values.salaryAmount).toBe('6500 PLN');
    expect(values.expensesList).toContain('Jedzenie');
  });

  it('uses email fallback for missing userName', () => {
    const values = expenseSummaryToTemplateValues(
      {
        userName: '',
        currentMonth: '',
        salaryAmount: '',
        totalExpenses: '',
        savingsAmount: '',
        savingsMessage: '',
        expensesList: '',
      },
      'patryk@example.com',
    );

    expect(values.userName).toBe('patryk');
  });
});
