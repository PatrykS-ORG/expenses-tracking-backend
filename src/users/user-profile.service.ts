import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { DataSourceType } from '../generated/prisma/client';
import { parseFileUploadConfig } from '../data-sources/data-source.types';
import {
  AI_MONTHLY_CREDIT_LIMIT_ENV,
  DEFAULT_MONTHLY_AI_CREDIT_LIMIT,
} from '../ai-usage/ai-usage.constants';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async ensureUserProfile(userId: string, email?: string): Promise<void> {
    const resolvedEmail = email?.trim() || `${userId}@users.expenseai.local`;

    await this.prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: resolvedEmail,
        ai_credit_limit: this.getDefaultMonthlyCreditLimit(),
      },
      update: email ? { email: resolvedEmail } : {},
    });
  }

  private getDefaultMonthlyCreditLimit(): number {
    const raw = this.configService
      .get<string>(AI_MONTHLY_CREDIT_LIMIT_ENV)
      ?.trim();
    if (!raw) {
      return DEFAULT_MONTHLY_AI_CREDIT_LIMIT;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_MONTHLY_AI_CREDIT_LIMIT;
    }

    return parsed;
  }

  async deleteAccount(userId: string): Promise<boolean> {
    const supabaseUrl = this.configService
      .get<string>('SUPABASE_URL')
      ?.trim()
      .replace(/\/$/, '');
    const serviceRoleKey = this.configService
      .get<string>('SUPABASE_SERVICE_ROLE_KEY')
      ?.trim();

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ServiceUnavailableException(
        'Account deletion is not configured',
      );
    }

    const authHeaders = {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    };

    // Best-effort storage cleanup: a missing object must not block deletion.
    await this.deleteUploadedExpenseFile(userId, supabaseUrl, authHeaders);

    // Delete the auth identity first so the user can no longer sign in.
    // A 404 means the identity is already gone, which makes retries idempotent.
    try {
      await axios.delete(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        headers: authHeaders,
      });
    } catch (error) {
      if (this.extractStatus(error) !== 404) {
        this.logger.error(
          `Failed to delete Supabase auth user ${userId}: ${this.describeError(error)}`,
        );
        throw new InternalServerErrorException('Failed to delete account');
      }
    }

    try {
      await this.prisma.user.deleteMany({ where: { id: userId } });
    } catch (error) {
      this.logger.error(
        `Deleted Supabase auth user ${userId} but failed to remove local profile: ${this.describeError(error)}`,
      );
      throw new InternalServerErrorException('Failed to delete account');
    }

    return true;
  }

  private async deleteUploadedExpenseFile(
    userId: string,
    supabaseUrl: string,
    authHeaders: Record<string, string>,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { data_source_type: true, data_source_config: true },
    });

    if (
      user?.data_source_type !== DataSourceType.FILE_UPLOAD ||
      !user.data_source_config
    ) {
      return;
    }

    const config = parseFileUploadConfig(user.data_source_config);
    if (!config) {
      return;
    }

    const encodedPath = config.filePath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    try {
      await axios.delete(
        `${supabaseUrl}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodedPath}`,
        { headers: authHeaders },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to delete uploaded expense file for user ${userId}: ${this.describeError(error)}`,
      );
    }
  }

  private extractStatus(error: unknown): number | undefined {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { status?: number } }).response;
      return response?.status;
    }
    return undefined;
  }

  private describeError(error: unknown): string {
    const status = this.extractStatus(error);
    if (status !== undefined) {
      return `HTTP ${status}`;
    }
    return error instanceof Error ? error.message : 'unknown error';
  }
}
