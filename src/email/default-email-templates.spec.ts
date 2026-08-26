import { SummaryEmailLanguage } from '../generated/prisma/client';
import {
  applyTemplateValues,
  getExampleTemplateValues,
} from './template-renderer';
import { getDefaultExpenseSummaryTemplate } from './default-email-templates';

describe('default expense summary templates', () => {
  it('renders Polish template with example values', () => {
    const html = applyTemplateValues(
      getDefaultExpenseSummaryTemplate(SummaryEmailLanguage.PL),
      getExampleTemplateValues('patryk@example.com', SummaryEmailLanguage.PL),
    );

    expect(html).toContain('Podsumowanie wydatków');
    expect(html).toContain('8 500,00 zł');
    expect(html).toContain('6 230,45 zł');
    expect(html).toContain('2 269,55 zł');
    expect(html).toContain('Zainwestowano');
    expect(html).toContain('Wolne oszczędności');
    expect(html).toContain('5 430,45 zł');
    expect(html).toContain('800,00 zł');
    expect(html).not.toContain('{{ userName }}');
    expect(html).not.toContain('{{ spendingAmount }}');
  });

  it('renders English template with example values', () => {
    const html = applyTemplateValues(
      getDefaultExpenseSummaryTemplate(SummaryEmailLanguage.EN),
      getExampleTemplateValues('patryk@example.com', SummaryEmailLanguage.EN),
    );

    expect(html).toContain('Expense Summary');
    expect(html).toContain('8,500.00 PLN');
    expect(html).toContain('Invested');
    expect(html).toContain('Free savings');
    expect(html).toContain('5,430.45 PLN');
    expect(html).toContain('800.00 PLN');
    expect(html).not.toContain('{{ userName }}');
    expect(html).not.toContain('{{ investedAmount }}');
  });
});
