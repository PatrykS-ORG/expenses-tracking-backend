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
import { buildCanonicalCategoriesFromExpenses } from '../summary/summary-analytics-canonical.mapper';
import { CANONICAL_CATEGORY_KEYS } from '../summary/summary-category.constants';
import { SummaryAnalyticsSnapshot } from '../summary/summary-analytics.types';
import { formatMoneyAmount } from './expense-amount.formatter';
import { CanonicalExpense, parseExpenseFile } from './expense-file.parser';
import { buildExpensesListHtml } from '../email/expenses-list.builder';
import {
  AiActionType,
  AiUsageTrigger,
  SummaryEmailLanguage,
} from '../generated/prisma/client';
import {
  formatSummaryMonth,
  getExpensesTotalLabel,
  getSummaryLanguageInstructions,
  normalizeSummaryEmailLanguage,
} from '../summary/summary-email-language.util';
import { AiUsageService } from '../ai-usage/ai-usage.service';

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
1) Group expenses into parent categories using ONLY these exact English category names:
   ${CANONICAL_CATEGORY_KEYS.join(', ')}
2) Every expense ID from the canonical list MUST appear in exactly one category.itemIds.
3) Do not invent IDs. Do not omit IDs. Do not duplicate IDs across categories.
4) Do not invent expenses that are not in the canonical list.
5) Each category.itemIds must contain at least 1 ID.
6) Use the English category names exactly as listed above (not translated labels).

savingsMessage rules (critical — do NOT just restate totals):
1) Name the category that consumed the largest share of salary, with its percentage (use the provided totals).
2) Name the single most expensive individual expense with its exact amount from the canonical list.
3) Identify the category where cost reduction is most realistic and give a brief, actionable recommendation.
4) Optionally mention a positive trend if visible.
5) Keep the tone friendly and motivating — no lecturing. 3-5 sentences max.
6) Use ONLY amounts provided in the user message — never invent or round them.

Formatting rules:
1) Return JSON only — no markdown, no HTML, no commentary.
2) Use ONLY the output language specified in the user message for savingsMessage (category names stay English as listed above).

Example shape:
{
  "userName": "Anna",
  "savingsMessage": "Największą część wypłaty pochłonęła kategoria Groceries (14,6%). Najdroższy pojedynczy wydatek to Biedronka — zakupy spożywcze — 890,00 zł. Warto przyjrzeć się kategorii Transport — rozważ carpooling lub komunikację miejską w kolejnym miesiącu.",
  "categories": [
    { "name": "Groceries", "itemIds": [1, 2, 3] },
    { "name": "Transport", "itemIds": [4, 5] }
  ]
}
`;

export interface AnalyzeExpensesResult {
  summary: ExpenseSummary;
  snapshot: SummaryAnalyticsSnapshot;
}

const RECEIPT_SCAN_PROMPT = `You are a financial assistant that extracts purchased-item expenses from noisy OCR text of a store receipt.
Read the OCR text and return ONLY plain text lines in this format:
<item name>: <amount and currency>

How receipt lines are structured (mainly Polish grocery receipts):
1) Each purchased item usually spans two consecutive OCR lines:
   - a name line, often ending with a single loose tax-category letter (e.g. A, B, C, F, X) that is NOT part of the name;
   - a price line directly below/after it, shaped like "<qty> x<unit_price> <line_total>" (e.g. "2 x1,49 2,98") or just a single number when qty is 1.
2) A line starting with "OPUST" (or similar discount wording) immediately follows the item it discounts. Its number is the discount amount to SUBTRACT from that item's price. Merge it into ONE output line for the item using the net (post-discount) price — never output the OPUST line separately.
3) OCR sometimes fuses a stray tax-category letter onto a number's last digit (e.g. "5,194" instead of "5,19", "0,741" instead of "0,74"). If a number's last character is a letter (A/B/C/F/X) or an implausible trailing digit that breaks an otherwise clean two-decimal amount, strip it before using the number.
4) When a "qty x unit_price total" line is present, sanity-check that qty × unit_price ≈ total (small rounding is fine). If they clearly disagree because one digit looks misread, prefer qty × unit_price as the amount — unit price and quantity are printed larger/cleaner than the fused total column.
5) Ignore entirely: store name/address/NIP/register metadata, barcodes, VAT summary rows (e.g. "SPRZEDAŻ OPODATKOWANA", "PTU", "SUMA PTU"), subtotal/grand-total/payment rows (e.g. "Podsuma", "SUMA PLN", "DO ZAPŁATY", "ROZLICZENIE PŁATNOŚCI", "KARTA"), and transaction/date/receipt-number footers. NEVER use a number from one of these rows as an item's price, even if a nearby item price looks unclear — skip that item instead (see rule 8).
6) Deposit/bag lines tied to an actual purchase (e.g. "Kaucja", "Reklamówka") ARE real expenses and should be kept as their own line. Refund/return summary rows (e.g. "OPAKOWANIA ZWROTNE SUMA") are not — skip those.
7) Fix obvious OCR misspellings of common Polish grocery/product words using context (e.g. garbled letters in an otherwise recognizable product name) instead of copying garbage characters verbatim, but never invent a product that isn't there.
8) If you cannot confidently pair an item with a specific price that appears directly next to it in the text, skip that item entirely rather than guessing or borrowing a number from elsewhere.

Output rules:
1) Do not return JSON, markdown, code blocks, bullets, or explanations.
2) Return exactly one expense per line, using the item's real product name (not the raw fused OCR text) and its final net price.
3) Keep the original currency symbol/code when one is visible in the text. If no currency symbol appears anywhere (typical for Polish receipts, where amounts are plain numbers with a comma decimal separator), infer the currency from context (store address, language, VAT wording) and append it — default to PLN for Polish-language receipts rather than leaving amounts unitless.
4) If no expenses can be extracted, return exactly: NO_EXPENSES_FOUND`;

type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private configService: ConfigService,
    private receiptOcrService: ReceiptOcrService,
    private aiUsageService: AiUsageService,
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

  private extractUsage(
    usage: OpenAI.Completions.CompletionUsage | undefined,
  ): TokenUsage {
    return {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    };
  }

  private async recordCallUsage(params: {
    userId: string;
    action: AiActionType;
    trigger: AiUsageTrigger;
    model: string;
    usage: TokenUsage;
    success: boolean;
    errorMessage?: string | null;
  }): Promise<void> {
    try {
      await this.aiUsageService.recordUsage({
        userId: params.userId,
        action: params.action,
        trigger: params.trigger,
        model: params.model,
        promptTokens: params.usage.promptTokens,
        completionTokens: params.usage.completionTokens,
        totalTokens: params.usage.totalTokens,
        success: params.success,
        errorMessage: params.errorMessage,
      });
    } catch (error) {
      this.logger.error(
        `Failed to record AI usage for user ${params.userId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async generateTemplate(
    userId: string,
    tone: string,
    detailLevel: string,
    focus: string,
    visualStyle: string,
  ): Promise<string> {
    await this.aiUsageService.ensureWithinLimit(userId);

    const userPrompt = `User Preferences:
- Tone of the message: ${tone}
- Detail level: ${detailLevel} (if 'podsumowanie' focus on total numbers, if 'wyliczenie' make sure the {{ expensesList }} takes a prominent place with items breakdown)
- Main focus: ${focus}
- Visual style: ${visualStyle}`;

    const openai = this.createClient();
    const model = 'deepseek-chat';
    let usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    let recorded = false;

    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 8192,
      });

      usage = this.extractUsage(response.usage);

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        this.logger.error(
          'DeepSeek returned an empty completion',
          JSON.stringify(response),
        );
        await this.recordCallUsage({
          userId,
          action: AiActionType.TEMPLATE_GENERATION,
          trigger: AiUsageTrigger.MANUAL,
          model,
          usage,
          success: false,
          errorMessage: 'AI returned an empty template',
        });
        recorded = true;
        throw new ServiceUnavailableException('AI returned an empty template');
      }

      let content = choice.message.content;
      if (content.startsWith('```html')) {
        content = content.replace(/```html\n/g, '').replace(/```/g, '');
      }

      await this.recordCallUsage({
        userId,
        action: AiActionType.TEMPLATE_GENERATION,
        trigger: AiUsageTrigger.MANUAL,
        model,
        usage,
        success: true,
      });
      recorded = true;

      return content.trim();
    } catch (error) {
      if (!recorded && (usage.totalTokens > 0 || usage.promptTokens > 0)) {
        await this.recordCallUsage({
          userId,
          action: AiActionType.TEMPLATE_GENERATION,
          trigger: AiUsageTrigger.MANUAL,
          model,
          usage,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        });
      }

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
        `Failed to generate template from DeepSeek API: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException(
        'Could not generate template from AI service',
      );
    }
  }

  async analyzeExpenses(
    userId: string,
    rawExpenseContent: string,
    language: SummaryEmailLanguage = SummaryEmailLanguage.PL,
    currency = 'PLN',
    period?: string,
    trigger: AiUsageTrigger = AiUsageTrigger.MANUAL,
  ): Promise<AnalyzeExpensesResult> {
    await this.aiUsageService.ensureWithinLimit(userId);

    const resolvedLanguage = normalizeSummaryEmailLanguage(language);
    const parsedFile = parseExpenseFile(rawExpenseContent);

    if (parsedFile.expenses.length === 0) {
      throw new BadRequestException(
        'No expenses could be parsed from the expense file',
      );
    }

    const openai = this.createClient();
    const model = 'deepseek-chat';
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

    let usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    let recorded = false;

    try {
      const response = await openai.chat.completions.create({
        model,
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

      usage = this.extractUsage(response.usage);

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        await this.recordCallUsage({
          userId,
          action: AiActionType.EXPENSE_SUMMARY,
          trigger,
          model,
          usage,
          success: false,
          errorMessage: 'AI returned an empty summary',
        });
        recorded = true;
        throw new ServiceUnavailableException('AI returned an empty summary');
      }

      const aiResult = this.parseAiCategorization(choice.message.content);
      if (!aiResult) {
        await this.recordCallUsage({
          userId,
          action: AiActionType.EXPENSE_SUMMARY,
          trigger,
          model,
          usage,
          success: false,
          errorMessage: 'AI returned malformed summary JSON',
        });
        recorded = true;
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
        await this.recordCallUsage({
          userId,
          action: AiActionType.EXPENSE_SUMMARY,
          trigger,
          model,
          usage,
          success: false,
          errorMessage: 'AI returned no usable expense categories',
        });
        recorded = true;
        throw new ServiceUnavailableException(
          'AI returned no usable expense categories',
        );
      }

      const totalLabel = getExpensesTotalLabel(resolvedLanguage);
      const listLanguage =
        resolvedLanguage === SummaryEmailLanguage.EN ? 'en' : 'pl';

      await this.recordCallUsage({
        userId,
        action: AiActionType.EXPENSE_SUMMARY,
        trigger,
        model,
        usage,
        success: true,
      });
      recorded = true;

      return {
        summary: {
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
        },
        snapshot: {
          currency: currency.trim().toUpperCase() || 'PLN',
          salaryCents: reconciled.salaryCents,
          totalExpensesCents: reconciled.totalExpensesCents,
          savingsCents: reconciled.savingsCents,
          savingsMessage: aiResult.savingsMessage,
          categories: buildCanonicalCategoriesFromExpenses(
            parsedFile.expenses,
            aiResult.categories,
          ),
        },
      };
    } catch (error) {
      if (!recorded && (usage.totalTokens > 0 || usage.promptTokens > 0)) {
        await this.recordCallUsage({
          userId,
          action: AiActionType.EXPENSE_SUMMARY,
          trigger,
          model,
          usage,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        });
      }

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
    userId: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    await this.aiUsageService.ensureWithinLimit(userId);

    const openai = this.createClient();
    const model =
      this.configService.get<string>('DEEPSEEK_VISION_MODEL')?.trim() ||
      'deepseek-chat';

    let usage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    let recorded = false;

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

      usage = this.extractUsage(response.usage);

      const choice = response.choices[0];
      const rawContent = choice?.message?.content;
      if (!rawContent) {
        await this.recordCallUsage({
          userId,
          action: AiActionType.RECEIPT_SCAN,
          trigger: AiUsageTrigger.MANUAL,
          model,
          usage,
          success: false,
          errorMessage: 'AI returned empty receipt extraction',
        });
        recorded = true;
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
        await this.recordCallUsage({
          userId,
          action: AiActionType.RECEIPT_SCAN,
          trigger: AiUsageTrigger.MANUAL,
          model,
          usage,
          success: false,
          errorMessage: 'AI returned blank receipt text',
        });
        recorded = true;
        throw new ServiceUnavailableException('AI returned blank receipt text');
      }

      await this.recordCallUsage({
        userId,
        action: AiActionType.RECEIPT_SCAN,
        trigger: AiUsageTrigger.MANUAL,
        model,
        usage,
        success: true,
      });
      recorded = true;

      return content;
    } catch (error) {
      if (!recorded && (usage.totalTokens > 0 || usage.promptTokens > 0)) {
        await this.recordCallUsage({
          userId,
          action: AiActionType.RECEIPT_SCAN,
          trigger: AiUsageTrigger.MANUAL,
          model,
          usage,
          success: false,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        });
      }

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
