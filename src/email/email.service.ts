import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

interface BrevoEmailPayload {
  sender: {
    name: string;
    email: string;
  };
  to: Array<{ email: string }>;
  subject: string;
  htmlContent: string;
}

interface SendHtmlEmailPayload {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendHtmlEmail(payload: SendHtmlEmailPayload): Promise<void> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    const senderEmail = this.configService.get<string>('MAIL_SENDER');
    const senderName =
      this.configService.get<string>('MAIL_SENDER_NAME') ?? 'ExpenseAI';
    const baseUrl =
      this.configService.get<string>('BREVO_BASE_URL') ??
      'https://api.brevo.com/v3';

    if (!apiKey || !senderEmail) {
      throw new ServiceUnavailableException(
        'Brevo API is not configured. Please set BREVO_API_KEY and MAIL_SENDER.',
      );
    }

    const requestPayload: BrevoEmailPayload = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: payload.html,
    };

    try {
      await axios.post(`${baseUrl}/smtp/email`, requestPayload, {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      this.logger.log(`Email sent successfully to ${payload.to}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorDetails = axiosError.response?.data ?? axiosError.message;

      this.logger.error(
        `Failed to send email to ${payload.to}: ${JSON.stringify(errorDetails)}`,
        axiosError.stack,
      );

      throw new ServiceUnavailableException(
        `Failed to send email via Brevo: ${JSON.stringify(errorDetails)}`,
      );
    }
  }
}
