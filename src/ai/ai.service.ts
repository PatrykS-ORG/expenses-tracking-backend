import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ReceiptOcrService } from '../receipts/receipt-ocr.service';

const SYSTEM_PROMPT = `You are an expert HTML email designer and financial assistant.
Create a personalized monthly expense summary email template in clean, responsive HTML.
Do not wrap your response in markdown blocks like \`\`\`html, just output the raw HTML.
The HTML should contain placeholders for dynamic data injected later.
Use these placeholders exactly as written:
{{ userName }}, {{ currentMonth }}, {{ totalExpenses }}, {{ savingsAmount }}, {{ savingsMessage }}, {{ expensesList }}

Ensure the design is responsive and looks good on mobile devices.
The output MUST be only raw HTML code starting with <!DOCTYPE html>.`;

const EXPENSE_ANALYSIS_PROMPT = `You are a financial assistant that summarizes monthly expenses.
Analyze the raw expense text and return strictly valid JSON with these keys:
- userName (string)
- currentMonth (string)
- salaryAmount (string)
- totalExpenses (string)
- savingsAmount (string)
- savingsMessage (string)
- expensesList (string, HTML list items only, e.g. "<li>Food: 120 PLN</li>")

Rules:
1) Always return JSON only (no markdown, no commentary).
2) If salary is missing, infer savings against 0 and explain briefly in savingsMessage.
3) Keep currency exactly as found when possible, otherwise use PLN.
4) expensesList must contain at least 3 <li> items when enough data exists.`;

const RECEIPT_SCAN_PROMPT = `You are a financial assistant that extracts expenses from receipt OCR text.
Read the OCR text and return ONLY plain text lines in this format:
<item or category>: <amount and currency>

Rules:
1) Do not return JSON, markdown, code blocks, bullets, or explanations.
2) Return one expense per line.
3) Keep original currency symbols/codes when visible.
4) If you cannot read an amount confidently, skip that line.
5) If no expenses can be extracted, return exactly: NO_EXPENSES_FOUND`;

interface ExpenseSummary {
  userName: string;
  currentMonth: string;
  salaryAmount: string;
  totalExpenses: string;
  savingsAmount: string;
  savingsMessage: string;
  expensesList: string;
}

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

  async analyzeExpenses(rawExpenseContent: string): Promise<ExpenseSummary> {
    const openai = this.createClient();

    try {
      const response = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: EXPENSE_ANALYSIS_PROMPT },
          {
            role: 'user',
            content: `Raw expense file content:\n${rawExpenseContent}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 2048,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new ServiceUnavailableException('AI returned an empty summary');
      }

      const parsed = this.parseExpenseSummary(choice.message.content);
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

  private parseExpenseSummary(rawContent: string): ExpenseSummary | null {
    const trimmed = rawContent.trim();
    const unwrapped = trimmed.startsWith('```json')
      ? trimmed
          .replace(/^```json\s*/, '')
          .replace(/```$/, '')
          .trim()
      : trimmed;

    try {
      const parsed = JSON.parse(unwrapped) as Partial<ExpenseSummary>;
      if (
        typeof parsed.userName !== 'string' ||
        typeof parsed.currentMonth !== 'string' ||
        typeof parsed.salaryAmount !== 'string' ||
        typeof parsed.totalExpenses !== 'string' ||
        typeof parsed.savingsAmount !== 'string' ||
        typeof parsed.savingsMessage !== 'string' ||
        typeof parsed.expensesList !== 'string'
      ) {
        return null;
      }

      return parsed as ExpenseSummary;
    } catch {
      return null;
    }
  }
}
