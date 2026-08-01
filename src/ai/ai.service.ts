import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ReceiptOcrService } from '../receipts/receipt-ocr.service';
import { ExpenseSummary } from './expense-summary.types';
import {
  AiCategoryAssignment,
  reconcileExpenseAnalysis,
} from './expense-analysis.reconciler';
import { formatMoneyAmount } from './expense-amount.formatter';
import { CanonicalExpense, parseExpenseFile } from './expense-file.parser';
import { buildExpensesListHtml } from '../email/expenses-list.builder';
import { SummaryEmailLanguage } from '../generated/prisma/client';
import {
  formatSummaryMonth,
  getExpensesTotalLabel,
  getSummaryLanguageInstructions,
  normalizeSummaryEmailLanguage,
} from '../summary/summary-email-language.util';

const SYSTEM_PROMPT = `You are an expert HTML email designer and financial assistant.
Create a personalized monthly expense summary email template in clean, responsive HTML.
Do not wrap your response in markdown blocks like \`\`\`html, just output the raw HTML.
The HTML should contain placeholders for dynamic data injected later.
Use these placeholders exactly as written:
{{ userName }}, {{ currentMonth }}, {{ salaryAmount }}, {{ totalExpenses }}, {{ savingsAmount }}, {{ savingsMessage }}, {{ expensesList }}

Ensure the design is responsive and looks good on mobile devices.
The output MUST be only raw HTML code starting with <!DOCTYPE html>.`;

const EXPENSE_ANALYSIS_PROMPT = `You are a financial assistant that categorizes monthly expenses for a personalized email report.

The application has ALREADY parsed, merged duplicate names, and calculated every amount.
Your job is ONLY to:
1) Assign each canonical expense ID to a parent category
2) Write a short analytical savingsMessage
3) Suggest a display userName when possible

Return strictly valid JSON with these keys:
- userName (string)
- savingsMessage (string, 3-5 sentences in the requested output language)
- categories (array of category objects)

Do NOT include currentMonth, salaryAmount, totalExpenses, savingsAmount, item amounts, or item names — the application computes and injects those.

Each category object must contain:
- name (string, parent category label in the requested output language)
- itemIds (array of integers — IDs from the provided canonical expense list)

Categorization rules (critical):
1) Group expenses into 3-8 meaningful parent categories (for example Food, Transport, Bills).
2) Every expense ID from the canonical list MUST appear in exactly one category.itemIds.
3) Do not invent IDs. Do not omit IDs. Do not duplicate IDs across categories.
4) Do not invent expenses that are not in the canonical list.
5) Each category.itemIds must contain at least 1 ID.

savingsMessage rules (critical — do NOT just restate totals):
1) Name the category that consumed the largest share of salary, with its percentage (use the provided totals).
2) Name the single most expensive individual expense with its exact amount from the canonical list.
3) Identify the category where cost reduction is most realistic and give a brief, actionable recommendation.
4) Optionally mention a positive trend if visible.
5) Keep the tone friendly and motivating — no lecturing. 3-5 sentences max.
6) Use ONLY amounts provided in the user message — never invent or round them.

Formatting rules:
1) Return JSON only — no markdown, no HTML, no commentary.
2) Use ONLY the output language specified in the user message for category names and savingsMessage.

Example shape:
{
  "userName": "Anna",
  "savingsMessage": "Największą część wypłaty pochłonęła kategoria Żywność i dom (14,6%). Najdroższy pojedynczy wydatek to Biedronka — zakupy spożywcze — 890,00 zł. Warto przyjrzeć się kategorii Transport — rozważ carpooling lub komunikację miejską w kolejnym miesiącu.",
  "categories": [
    { "name": "Żywność i dom", "itemIds": [1, 2, 3] },
    { "name": "Transport", "itemIds": [4, 5] }
  ]
}`;

const RECEIPT_SCAN_PROMPT = `You are a financial assistant that extracts expenses from receipt OCR text.
Read the OCR text and return ONLY plain text lines in this format:
<item or category>: <amount and currency>

Rules:
1) Do not return JSON, markdown, code blocks, bullets, or explanations.
2) Return one expense per line.
3) Keep original currency symbols/codes when visible.
4) If you cannot read an amount confidently, skip that line.
5) If no expenses can be extracted, return exactly: NO_EXPENSES_FOUND`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private configService: ConfigService,
    private receiptOcrService: ReceiptOcrService,
  ) {}

  private createClient(): OpenAI {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY')?.trim();

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI service is not configured (DEEPSEEK_API_KEY)',
      );
    }

    return new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });
  }

  async generateTemplate(
    tone: string,
    detailLevel: string,
    focus: string,
    visualStyle: string,
  ): Promise<string> {
    const userPrompt = `User Preferences:
- Tone of the message: ${tone}
- Detail level: ${detailLevel} (if 'podsumowanie' focus on total numbers, if 'wyliczenie' make sure the {{ expensesList }} takes a prominent place with items breakdown)
- Main focus: ${focus}
- Visual style: ${visualStyle}`;

    const openai = this.createClient();

    try {
      const response = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8192,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        this.logger.error(
          'DeepSeek returned an empty completion',
          JSON.stringify(response),
        );
        throw new ServiceUnavailableException('AI returned an empty template');
      }

      let content = choice.message.content;
      if (content.startsWith('```html')) {
        content = content.replace(/```html\n/g, '').replace(/```/g, '');
      }
      return content.trim();
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      const message =
        error instanceof OpenAI.APIError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      this.logger.error(
        `Failed to generate template from DeepSeek API: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException(
        'Could not generate template from AI service',
      );
    }
  }

  async analyzeExpenses(
    rawExpenseContent: string,
    language: SummaryEmailLanguage = SummaryEmailLanguage.PL,
    currency = 'PLN',
    period?: string,
  ): Promise<ExpenseSummary> {
    const resolvedLanguage = normalizeSummaryEmailLanguage(language);
    const parsedFile = parseExpenseFile(rawExpenseContent);

    if (parsedFile.expenses.length === 0) {
      throw new BadRequestException(
        'No expenses could be parsed from the expense file',
      );
    }

    const openai = this.createClient();
    const languageInstructions =
      getSummaryLanguageInstructions(resolvedLanguage);
    const totalsHint = this.buildTotalsHint(
      parsedFile.expenses,
      parsedFile.salaryCents,
      resolvedLanguage,
      currency,
    );
    const canonicalList = parsedFile.expenses
      .map(
        (expense) =>
          `${expense.id}. ${expense.name} — ${formatMoneyAmount(expense.amountCents, resolvedLanguage, currency)}`,
      )
      .join('\n');

    try {
      const response = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: EXPENSE_ANALYSIS_PROMPT },
          {
            role: 'user',
            content: `${languageInstructions}

${totalsHint}

Canonical expenses (assign every ID exactly once):
${canonicalList}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 8192,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new ServiceUnavailableException('AI returned an empty summary');
      }

      const aiResult = this.parseAiCategorization(choice.message.content);
      if (!aiResult) {
        throw new ServiceUnavailableException(
          'AI returned malformed summary JSON',
        );
      }

      const reconciled = reconcileExpenseAnalysis(
        parsedFile.expenses,
        aiResult.categories,
        parsedFile.salaryCents,
        resolvedLanguage,
        currency,
      );

      if (reconciled.categories.length === 0) {
        throw new ServiceUnavailableException(
          'AI returned no usable expense categories',
        );
      }

      const totalLabel = getExpensesTotalLabel(resolvedLanguage);
      const listLanguage =
        resolvedLanguage === SummaryEmailLanguage.EN ? 'en' : 'pl';

      return {
        userName: aiResult.userName,
        currentMonth: formatSummaryMonth(resolvedLanguage, period ?? ''),
        salaryAmount: reconciled.salaryAmount,
        totalExpenses: reconciled.totalExpenses,
        savingsAmount: reconciled.savingsAmount,
        savingsMessage: aiResult.savingsMessage,
        expensesList: buildExpensesListHtml(
          reconciled.categories,
          reconciled.totalExpenses,
          totalLabel,
          reconciled.salaryAmount,
          listLanguage,
        ),
      };
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const message =
        error instanceof OpenAI.APIError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      this.logger.error(
        `Failed to analyze expenses with DeepSeek API: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException(
        'Could not analyze expenses from AI service',
      );
    }
  }

  async extractExpensesFromImage(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const openai = this.createClient();
    const model =
      this.configService.get<string>('DEEPSEEK_VISION_MODEL')?.trim() ||
      'deepseek-chat';

    try {
      const ocrText = await this.receiptOcrService.extractText(
        imageBuffer,
        mimeType,
      );

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: RECEIPT_SCAN_PROMPT },
          {
            role: 'user',
            content: `Extract expense lines from this OCR receipt text:\n\n${ocrText}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      });

      const choice = response.choices[0];
      const rawContent = choice?.message?.content;
      if (!rawContent) {
        throw new ServiceUnavailableException(
          'AI returned empty receipt extraction',
        );
      }

      const content = rawContent
        .trim()
        .replace(/^```(?:text|plaintext)?\s*/i, '')
        .replace(/```$/i, '')
        .trim();

      if (!content) {
        throw new ServiceUnavailableException('AI returned blank receipt text');
      }

      return content;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      const message =
        error instanceof OpenAI.APIError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      this.logger.error(
        `Failed to extract expenses from receipt image: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException(
        'Could not extract expenses from receipt image',
      );
    }
  }

  private buildTotalsHint(
    expenses: CanonicalExpense[],
    salaryCents: number,
    language: SummaryEmailLanguage,
    currency: string,
  ): string {
    const totalExpensesCents = expenses.reduce(
      (sum, expense) => sum + expense.amountCents,
      0,
    );
    const savingsCents = salaryCents - totalExpensesCents;
    const largest = [...expenses].sort(
      (a, b) => b.amountCents - a.amountCents,
    )[0];

    return [
      `Computed totals (authoritative — use these exact figures in savingsMessage):`,
      `- salaryAmount: ${formatMoneyAmount(salaryCents, language, currency)}`,
      `- totalExpenses: ${formatMoneyAmount(totalExpensesCents, language, currency)}`,
      `- savingsAmount (salary - expenses, may be negative): ${formatMoneyAmount(savingsCents, language, currency)}`,
      largest
        ? `- largest single expense: ${largest.name} — ${formatMoneyAmount(largest.amountCents, language, currency)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private parseAiCategorization(rawContent: string): {
    userName: string;
    savingsMessage: string;
    categories: AiCategoryAssignment[];
  } | null {
    const trimmed = rawContent.trim();
    const unwrapped = trimmed.startsWith('```json')
      ? trimmed
          .replace(/^```json\s*/, '')
          .replace(/```$/, '')
          .trim()
      : trimmed;

    try {
      const parsed = JSON.parse(unwrapped) as {
        userName?: unknown;
        savingsMessage?: unknown;
        categories?: unknown;
      };

      if (
        typeof parsed.userName !== 'string' ||
        typeof parsed.savingsMessage !== 'string'
      ) {
        return null;
      }

      const categories = this.normalizeCategoryAssignments(parsed.categories);
      if (!categories || categories.length === 0) {
        return null;
      }

      return {
        userName: parsed.userName.trim() || 'Użytkownik',
        savingsMessage: parsed.savingsMessage.trim(),
        categories,
      };
    } catch {
      return null;
    }
  }

  private normalizeCategoryAssignments(
    value: unknown,
  ): AiCategoryAssignment[] | null {
    if (!Array.isArray(value) || value.length === 0) {
      return null;
    }

    const categories: AiCategoryAssignment[] = [];

    for (const entry of value) {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const category = entry as {
        name?: unknown;
        itemIds?: unknown;
      };

      if (typeof category.name !== 'string' || !category.name.trim()) {
        return null;
      }

      if (!Array.isArray(category.itemIds) || category.itemIds.length === 0) {
        return null;
      }

      const itemIds = category.itemIds.filter(
        (id): id is number => typeof id === 'number' && Number.isInteger(id),
      );

      if (itemIds.length === 0) {
        return null;
      }

      categories.push({
        name: category.name.trim(),
        itemIds,
      });
    }

    return categories;
  }
}
