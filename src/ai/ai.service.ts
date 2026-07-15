import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ReceiptOcrService } from '../receipts/receipt-ocr.service';
import { ExpenseSummary } from './expense-summary.types';
import {
  ExpenseAnalysisResult,
  ExpenseCategory,
} from './expense-analysis.types';
import { buildExpensesListHtml } from '../email/expenses-list.builder';
import { SummaryEmailLanguage } from '../generated/prisma/client';
import {
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

const EXPENSE_ANALYSIS_PROMPT = `You are a financial assistant that summarizes monthly expenses for a personalized email report.

Analyze the raw expense text and return strictly valid JSON with these keys:
- userName (string)
- currentMonth (string, localized month + year in the requested output language)
- salaryAmount (string, formatted amount with the requested output currency; use zero in that currency if missing)
- totalExpenses (string, formatted amount — must equal the sum of all category totals)
- savingsAmount (string, salary minus total expenses when salary exists)
- savingsMessage (string, 3-5 sentences of analytical insight in the requested output language — see savingsMessage rules below)
- categories (array of category objects)

Each category object must contain:
- name (string, parent category label in the requested output language)
- total (string, formatted sum for the whole category)
- items (array of { name, amount } subcategory rows that belong under this category)

Categorization rules (critical):
1) NEVER output one row per raw merchant/product line in the final structure.
2) Group related expenses into 3-8 meaningful parent categories.
3) Put individual expenses under items[] as subcategories (group related lines under readable subcategory names).
4) Each category.items must contain at least 1 subcategory; subcategory amounts must sum to category.total.
5) Prefer human-readable budget categories over literal copy-paste of source lines.

savingsMessage rules (critical — do NOT just restate numbers):
1) Name the category that consumed the largest share of salary, with its percentage.
2) Name the single most expensive item (subcategory) with its amount.
3) Identify the category where cost reduction is most realistic and give a brief, actionable recommendation.
4) Optionally compare to typical household benchmarks or mention a positive trend if visible.
5) Keep the tone friendly and motivating — no lecturing. 3-5 sentences max.
6) Do NOT simply repeat "salary was X, expenses were Y, Z remained" — the reader already sees those numbers in the email.

Formatting rules:
1) Return JSON only — no markdown, no HTML, no commentary.
2) Use ONLY the output language specified in the user message for all text fields — ignore the language of raw expense lines.
3) Detect salary/wypłata from the file when present; otherwise explain in savingsMessage that savings are vs 0.

Example shape:
{
  "userName": "Anna",
  "currentMonth": "maj 2026",
  "salaryAmount": "6 500,00 zł",
  "totalExpenses": "2 126,50 zł",
  "savingsAmount": "4 373,50 zł",
  "savingsMessage": "Największą część wypłaty pochłonęła kategoria Żywność i dom (19,1%). Najdroższy pojedynczy wydatek to zakupy spożywcze — 890,00 zł. Warto przyjrzeć się kategorii Transport (486,50 zł) — rozważ carpooling lub komunikację miejską, żeby obniżyć tę kwotę w kolejnym miesiącu.",
  "categories": [
    {
      "name": "Żywność i dom",
      "total": "1 240,00 zł",
      "items": [
        { "name": "Zakupy spożywcze", "amount": "890,00 zł" },
        { "name": "Chemia i drogeria", "amount": "350,00 zł" }
      ]
    },
    {
      "name": "Transport",
      "total": "486,50 zł",
      "items": [{ "name": "Paliwo i komunikacja", "amount": "486,50 zł" }]
    }
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
  ): Promise<ExpenseSummary> {
    const openai = this.createClient();
    const resolvedLanguage = normalizeSummaryEmailLanguage(language);
    const languageInstructions =
      getSummaryLanguageInstructions(resolvedLanguage);

    try {
      const response = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: EXPENSE_ANALYSIS_PROMPT },
          {
            role: 'user',
            content: `${languageInstructions}

Output currency: ${currency}. Format every salary, expense, category, item, total, and savings amount in ${currency}. If source amounts use other currencies, preserve their numeric values and label the final report consistently as ${currency}; do not invent exchange rates.

Raw expense file content:
${rawExpenseContent}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 8192,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new ServiceUnavailableException('AI returned an empty summary');
      }

      const parsed = this.parseExpenseSummary(
        choice.message.content,
        resolvedLanguage,
      );
      if (!parsed) {
        throw new ServiceUnavailableException(
          'AI returned malformed summary JSON',
        );
      }

      return parsed;
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

  private parseExpenseSummary(
    rawContent: string,
    language: SummaryEmailLanguage,
  ): ExpenseSummary | null {
    const trimmed = rawContent.trim();
    const unwrapped = trimmed.startsWith('```json')
      ? trimmed
          .replace(/^```json\s*/, '')
          .replace(/```$/, '')
          .trim()
      : trimmed;

    try {
      const parsed = JSON.parse(unwrapped) as Partial<ExpenseAnalysisResult> & {
        expensesList?: string;
      };

      if (
        typeof parsed.userName !== 'string' ||
        typeof parsed.currentMonth !== 'string' ||
        typeof parsed.salaryAmount !== 'string' ||
        typeof parsed.totalExpenses !== 'string' ||
        typeof parsed.savingsAmount !== 'string' ||
        typeof parsed.savingsMessage !== 'string'
      ) {
        return null;
      }

      const categories = this.normalizeCategories(parsed.categories);
      if (!categories || categories.length === 0) {
        return null;
      }

      const totalLabel = getExpensesTotalLabel(language);
      const listLanguage = language === SummaryEmailLanguage.EN ? 'en' : 'pl';
      const expensesList = buildExpensesListHtml(
        categories,
        parsed.totalExpenses,
        totalLabel,
        parsed.salaryAmount,
        listLanguage,
      );

      return {
        userName: parsed.userName,
        currentMonth: parsed.currentMonth,
        salaryAmount: parsed.salaryAmount,
        totalExpenses: parsed.totalExpenses,
        savingsAmount: parsed.savingsAmount,
        savingsMessage: parsed.savingsMessage,
        expensesList,
      };
    } catch {
      return null;
    }
  }

  private normalizeCategories(value: unknown): ExpenseCategory[] | null {
    if (!Array.isArray(value) || value.length === 0) {
      return null;
    }

    const categories: ExpenseCategory[] = [];

    for (const entry of value) {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const category = entry as Partial<ExpenseCategory>;
      if (
        typeof category.name !== 'string' ||
        typeof category.total !== 'string'
      ) {
        return null;
      }

      if (!Array.isArray(category.items) || category.items.length === 0) {
        return null;
      }

      const items = category.items.map((item) => {
        if (
          !item ||
          typeof item !== 'object' ||
          typeof (item as { name?: unknown }).name !== 'string' ||
          typeof (item as { amount?: unknown }).amount !== 'string'
        ) {
          return null;
        }

        return {
          name: (item as { name: string }).name.trim(),
          amount: (item as { amount: string }).amount.trim(),
        };
      });

      if (items.some((item) => item === null)) {
        return null;
      }

      categories.push({
        name: category.name.trim(),
        total: category.total.trim(),
        items: items as ExpenseCategory['items'],
      });
    }

    return categories;
  }
}
