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
    expect(html).toContain('Rachunki i subskrypcje');
    expect(html).toContain('17,1% wypłaty');
    expect(html).not.toContain('{{ userName }}');
  });

  it('renders English template with example values', () => {
    const html = applyTemplateValues(
      getDefaultExpenseSummaryTemplate(SummaryEmailLanguage.EN),
      getExampleTemplateValues('patryk@example.com', SummaryEmailLanguage.EN),
    );

    expect(html).toContain('Expense Summary');
    expect(html).toContain('8,500.00 PLN');
    expect(html).toContain('Bills &amp; subscriptions');
    expect(html).toContain('17.1% of salary');
    expect(html).not.toContain('{{ userName }}');
  });
});
