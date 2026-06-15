import { buildExpensesListHtml } from './expenses-list.builder';

describe('buildExpensesListHtml', () => {
  it('renders category headers, subcategories, and total row', () => {
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
    );

    expect(html).toContain('Żywność i dom');
    expect(html).toContain('Zakupy spożywcze');
    expect(html).toContain('border-top:2px solid #10b981');
    expect(html).toContain('Razem wydatki');
    expect(html).toContain('2 126,50 zł');
    expect(html).not.toContain('<li>');
  });
});
