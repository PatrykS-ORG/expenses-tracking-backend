import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an expert HTML email designer and financial assistant.
Create a personalized monthly expense summary email template in clean, responsive HTML.
Do not wrap your response in markdown blocks like \`\`\`html, just output the raw HTML.
The HTML should contain placeholders for dynamic data injected later.
Use these placeholders exactly as written:
{{ userName }}, {{ currentMonth }}, {{ totalExpenses }}, {{ savingsAmount }}, {{ savingsMessage }}, {{ expensesList }}

Ensure the design is responsive and looks good on mobile devices.
The output MUST be only raw HTML code starting with <!DOCTYPE html>.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private configService: ConfigService) {}

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
}
