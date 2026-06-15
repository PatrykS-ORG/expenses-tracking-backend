import { ExpenseCategory } from '../ai/expense-analysis.types';

const CATEGORY_CELL =
  'padding:14px 8px 4px 0;font-weight:700;color:#14532d;border-top:2px solid #10b981;font-size:14px;vertical-align:top;';
const CATEGORY_AMOUNT_CELL =
  'padding:14px 0 4px;font-weight:700;color:#14532d;border-top:2px solid #10b981;font-size:14px;white-space:nowrap;vertical-align:top;';
const ITEM_CELL = 'padding:3px 8px 3px 16px;color:#4d7c0f;vertical-align:top;';
const ITEM_AMOUNT_CELL =
  'padding:3px 0;color:#166534;white-space:nowrap;vertical-align:top;';
const LAST_ITEM_CELL =
  'padding:3px 8px 8px 16px;color:#4d7c0f;vertical-align:top;';
const LAST_ITEM_AMOUNT_CELL =
  'padding:3px 0 8px 0;color:#166534;white-space:nowrap;vertical-align:top;';
const TOTAL_CELL =
  'padding:16px 8px 4px 0;font-weight:800;color:#14532d;border-top:2px dashed #10b981;font-size:14px;vertical-align:top;';
const TOTAL_AMOUNT_CELL =
  'padding:16px 0 4px;font-weight:800;color:#14532d;border-top:2px dashed #10b981;font-size:14px;white-space:nowrap;vertical-align:top;';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildExpensesListHtml(
  categories: ExpenseCategory[],
  totalExpenses: string,
  totalLabel = 'Razem wydatki',
): string {
  const rows: string[] = [];

  for (const category of categories) {
    rows.push(`  <tr>
    <td style="${CATEGORY_CELL}">${escapeHtml(category.name)}</td>
    <td align="right" class="amount-cell num" style="${CATEGORY_AMOUNT_CELL}">${escapeHtml(category.total)}</td>
  </tr>`);

    category.items.forEach((item, index) => {
      const isLast = index === category.items.length - 1;
      rows.push(`  <tr>
    <td style="${isLast ? LAST_ITEM_CELL : ITEM_CELL}">${escapeHtml(item.name)}</td>
    <td align="right" class="amount-cell num" style="${isLast ? LAST_ITEM_AMOUNT_CELL : ITEM_AMOUNT_CELL}">${escapeHtml(item.amount)}</td>
  </tr>`);
    });
  }

  rows.push(`  <tr>
    <td style="${TOTAL_CELL}">${escapeHtml(totalLabel)}</td>
    <td align="right" class="amount-cell num" style="${TOTAL_AMOUNT_CELL}">${escapeHtml(totalExpenses)}</td>
  </tr>`);

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="expenses-table" style="border-collapse:collapse;width:100%;min-width:260px;font-size:13px;">
${rows.join('\n')}
</table>`;
}
