import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly mailSender: string;
  private readonly senderName: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BREVO_API_KEY') ?? '';
    this.mailSender = this.configService.get<string>('MAIL_SENDER') ?? '';
    this.senderName =
      this.configService.get<string>('MAIL_SENDER_NAME') || 'ExpenseAI';
    this.baseUrl =
      this.configService.get<string>('BREVO_BASE_URL') ||
      'https://api.brevo.com/v3';

    if (!this.apiKey || !this.mailSender) {
      throw new Error(
        'Missing required email configuration: BREVO_API_KEY or MAIL_SENDER',
      );
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlContent: string,
  ): Promise<void> {
    const payload: BrevoEmailPayload = {
      sender: {
        name: this.senderName,
        email: this.mailSender,
      },
      to: [{ email: to }],
      subject,
      htmlContent,
    };

    const headers = {
      'api-key': this.apiKey,
      'Content-Type': 'application/json',
    };

    try {
      await axios.post(`${this.baseUrl}/smtp/email`, payload, {
        headers,
      });
      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorDetails = axiosError.response?.data || axiosError.message;
      const errorDetailsText =
        typeof errorDetails === 'string'
          ? errorDetails
          : JSON.stringify(errorDetails);

      this.logger.error(
        `Failed to send email to ${to}: ${errorDetailsText}`,
        axiosError.stack,
      );

      throw new Error(`Failed to send email: ${errorDetailsText}`);
    }
  }
}
