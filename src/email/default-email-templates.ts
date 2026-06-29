import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SummaryEmailLanguage } from '../generated/prisma/client';

const TEMPLATES_DIR = join(__dirname, 'templates');

function readTemplateFile(filename: string): string {
  return readFileSync(join(TEMPLATES_DIR, filename), 'utf8');
}

export const EXPENSE_SUMMARY_TEMPLATE_PL = readTemplateFile(
  'expense-summary.pl.html',
);

export const EXPENSE_SUMMARY_TEMPLATE_EN = readTemplateFile(
  'expense-summary.en.html',
);

export function getDefaultExpenseSummaryTemplate(
  language: SummaryEmailLanguage = SummaryEmailLanguage.PL,
): string {
  return language === SummaryEmailLanguage.EN
    ? EXPENSE_SUMMARY_TEMPLATE_EN
    : EXPENSE_SUMMARY_TEMPLATE_PL;
}
