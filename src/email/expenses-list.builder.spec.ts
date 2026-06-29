import {
  buildExpensesListHtml,
  calculateSalaryPercentage,
  formatSalaryPercentage,
  parseAmountToNumber,
} from './expenses-list.builder';

describe('parseAmountToNumber', () => {
  it('parses Polish PLN format', () => {
    expect(parseAmountToNumber('8 500,00 zł')).toBe(8500);
    expect(parseAmountToNumber('1 240,00 zł')).toBe(1240);
  });

  it('parses English PLN format', () => {
    expect(parseAmountToNumber('6,500.00 PLN')).toBe(6500);
  });
});

describe('calculateSalaryPercentage', () => {
  it('returns percentage relative to salary', () => {
    expect(calculateSalaryPercentage(1240, 6500)).toBe(19.1);
  });

  it('returns 0 when salary is missing or zero', () => {
    expect(calculateSalaryPercentage(100, 0)).toBe(0);
  });
});

describe('formatSalaryPercentage', () => {
  it('formats Polish decimal separator', () => {
    expect(formatSalaryPercentage(19.1, 'pl')).toBe('19,1%');
  });

  it('formats English decimal separator', () => {
    expect(formatSalaryPercentage(19.1, 'en')).toBe('19.1%');
  });
});

describe('buildExpensesListHtml', () => {
  it('renders category headers, subcategories, progress bars, and total row', () => {
    const html = buildExpensesListHtml(
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
          name: 'Transport',
          total: '486,50 zł',
          items: [{ name: 'Paliwo i komunikacja', amount: '486,50 zł' }],
        },
      ],
      '2 126,50 zł',
      'Razem',
      '6 500,00 zł',
      'pl',
    );

    expect(html).toContain('Żywność i dom');
    expect(html).toContain('Zakupy spożywcze');
    expect(html).toContain('19,1% wypłaty');
    expect(html).toContain('background-color:#2D6A4F');
    expect(html).toContain('Razem');
    expect(html).toContain('2 126,50 zł');
    expect(html).not.toContain('<li>');
  });

  it('renders English salary share label', () => {
    const html = buildExpensesListHtml(
      [
        {
          name: 'Food & home',
          total: '1,240.00 PLN',
          items: [{ name: 'Groceries', amount: '890.00 PLN' }],
        },
      ],
      '1,240.00 PLN',
      'Total',
      '6,500.00 PLN',
      'en',
    );

    expect(html).toContain('19.1% of salary');
    expect(html).toContain('Total');
  });

  it('shows percentages when salary is zero but total expenses exist', () => {
    const html = buildExpensesListHtml(
      [
        {
          name: 'Transport',
          total: '500,00 zł',
          items: [{ name: 'Paliwo', amount: '500,00 zł' }],
        },
      ],
      '500,00 zł',
      'Razem',
      '0 zł',
      'pl',
    );

    expect(html).toContain('100,0% wypłaty');
  });
});
