import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { GenerateTemplateInput } from './dto/generate-template.input';
import { CreateTemplateInput } from './dto/create-template.input';
import { UpdateTemplateInput } from './dto/update-template.input';
import { DataSourceType, Prisma } from '../generated/prisma/client';
import {
  FileUploadDataSourceConfig,
  parseFileUploadConfig,
  parseNextcloudConfig,
  toPrismaJsonValue,
} from '../data-sources/data-source.types';
import { EmailService } from '../email/email.service';
import {
  applyTemplateValues,
  getExampleTemplateValues,
} from '../email/template-renderer';
import { DataSourceTypeEnum } from './models/data-source-type.enum';
import { MAX_TEMPLATES_PER_USER } from './templates.constants';

type TemplateEntity = Awaited<ReturnType<PrismaService['template']['create']>>;

interface TemplateSettingsPayload {
  active_template_id: string | null;
  data_source_type: DataSourceTypeEnum;
  nextcloud_file_path: string | null;
  uploaded_file_path: string | null;
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private emailService: EmailService,
  ) {}

  async findAllByUser(userId: string): Promise<TemplateEntity[]> {
    return this.prisma.template.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async getTemplateSettingsByUser(
    userId: string,
    userEmail?: string,
  ): Promise<TemplateSettingsPayload> {
    await this.ensureUserExists(userId, userEmail);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        active_template_id: true,
        data_source_type: true,
        data_source_config: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const nextcloudConfig = parseNextcloudConfig(user.data_source_config);
    const fileUploadConfig = parseFileUploadConfig(user.data_source_config);

    return {
      active_template_id: user.active_template_id,
      data_source_type: user.data_source_type as DataSourceTypeEnum,
      nextcloud_file_path: nextcloudConfig?.filePath || null,
      uploaded_file_path: fileUploadConfig?.filePath || null,
    };
  }

  async generateAndSaveTemplate(
    userId: string,
    userEmail: string | undefined,
    input: GenerateTemplateInput,
  ): Promise<TemplateEntity> {
    this.logger.log(
      `Generating template for user ${userId} with input: ${JSON.stringify(input)}`,
    );

    await this.ensureUserExists(userId, userEmail);
    await this.ensureTemplateLimitNotReached(userId);

    const generatedHtml = await this.aiService.generateTemplate(
      input.tone,
      input.detailLevel,
      input.focus,
      input.visualStyle,
    );

    const templateName = `Szablon - ${new Date().toISOString().split('T')[0]} (${input.visualStyle}, ${input.tone})`;

    const template = await this.prisma.template.create({
      data: {
        user_id: userId,
        name: templateName,
        content: generatedHtml,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { active_template_id: template.id },
    });

    return template;
  }

  async createTemplate(
    userId: string,
    userEmail: string | undefined,
    input: CreateTemplateInput,
  ): Promise<TemplateEntity> {
    await this.ensureUserExists(userId, userEmail);
    await this.ensureTemplateLimitNotReached(userId);
    const payload = this.validateTemplatePayload(input.name, input.content);

    return this.prisma.template.create({
      data: {
        user_id: userId,
        name: payload.name,
        content: payload.content,
      },
    });
  }

  async updateTemplate(
    userId: string,
    input: UpdateTemplateInput,
  ): Promise<TemplateEntity> {
    await this.ensureTemplateOwnership(userId, input.templateId);
    const payload = this.validateTemplatePayload(input.name, input.content);

    return this.prisma.template.update({
      where: { id: input.templateId },
      data: {
        name: payload.name,
        content: payload.content,
      },
    });
  }

  async deleteTemplate(userId: string, templateId: string): Promise<boolean> {
    await this.ensureTemplateOwnership(userId, templateId);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { active_template_id: true },
      });

      if (user?.active_template_id === templateId) {
        await tx.user.update({
          where: { id: userId },
          data: { active_template_id: null },
        });
      }

      await tx.template.delete({ where: { id: templateId } });
    });

    return true;
  }

  async setActiveTemplate(
    userId: string,
    templateId: string,
  ): Promise<boolean> {
    await this.ensureTemplateOwnership(userId, templateId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { active_template_id: templateId },
    });

    return true;
  }

  async updateDataSource(
    userId: string,
    userEmail: string | undefined,
    dataSourceType: DataSourceType,
    nextcloudFilePath?: string,
  ): Promise<boolean> {
    await this.ensureUserExists(userId, userEmail);

    if (dataSourceType === DataSourceType.NEXTCLOUD) {
      const path = nextcloudFilePath?.trim() || '';
      if (!path) {
        throw new BadRequestException('Nextcloud file path cannot be empty');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          data_source_type: DataSourceType.NEXTCLOUD,
          data_source_config: toPrismaJsonValue({ filePath: path }),
        },
      });
      return true;
    }

    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        data_source_type: true,
        data_source_config: true,
      },
    });
    const existingUploadConfig = parseFileUploadConfig(
      current?.data_source_config || null,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        data_source_type: DataSourceType.FILE_UPLOAD,
        data_source_config: existingUploadConfig
          ? toPrismaJsonValue(existingUploadConfig)
          : Prisma.JsonNull,
      },
    });

    return true;
  }

  async setFileUploadSource(
    userId: string,
    userEmail: string | undefined,
    config: FileUploadDataSourceConfig,
  ): Promise<void> {
    await this.ensureUserExists(userId, userEmail);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        data_source_type: DataSourceType.FILE_UPLOAD,
        data_source_config: toPrismaJsonValue(config),
      },
    });
  }

  async getFileUploadSourceConfig(
    userId: string,
    userEmail?: string,
  ): Promise<FileUploadDataSourceConfig> {
    await this.ensureUserExists(userId, userEmail);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { data_source_config: true },
    });

    const fileUploadConfig = parseFileUploadConfig(
      user?.data_source_config ?? null,
    );
    if (!fileUploadConfig) {
      throw new NotFoundException(
        'Upload an expense file before opening file preview',
      );
    }

    return fileUploadConfig;
  }

  async sendTestEmail(
    userId: string,
    userEmail: string | undefined,
    recipientEmail: string,
  ): Promise<boolean> {
    await this.ensureUserExists(userId, userEmail);
    const recipient = recipientEmail.trim();
    if (!recipient) {
      throw new BadRequestException('Recipient email cannot be empty');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        activeTemplate: true,
      },
    });

    if (!user?.activeTemplate) {
      throw new NotFoundException(
        'Set an active template before sending a test email',
      );
    }

    const values = getExampleTemplateValues(user.email);
    const html = applyTemplateValues(user.activeTemplate.content, values);
    const subject = `Test podsumowania — ${values.currentMonth}`;

    await this.emailService.sendEmail(recipient, subject, html);

    return true;
  }

  private async ensureTemplateLimitNotReached(userId: string): Promise<void> {
    const templateCount = await this.prisma.template.count({
      where: { user_id: userId },
    });

    if (templateCount >= MAX_TEMPLATES_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_TEMPLATES_PER_USER} templates. Delete an existing template before adding a new one.`,
      );
    }
  }

  private validateTemplatePayload(name: string, content: string) {
    const trimmedName = name.trim();
    const trimmedContent = content.trim();

    if (!trimmedName) {
      throw new BadRequestException('Template name cannot be empty');
    }

    if (!trimmedContent) {
      throw new BadRequestException('Template content cannot be empty');
    }

    return { name: trimmedName, content: trimmedContent };
  }

  private async ensureTemplateOwnership(
    userId: string,
    templateId: string,
  ): Promise<TemplateEntity> {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template || template.user_id !== userId) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  private async ensureUserExists(
    userId: string,
    email?: string,
  ): Promise<void> {
    const resolvedEmail = email?.trim() || `${userId}@users.expenseai.local`;

    await this.prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, email: resolvedEmail },
      update: email ? { email: resolvedEmail } : {},
    });
  }
}
