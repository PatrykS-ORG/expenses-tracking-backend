import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { GenerateTemplateInput } from './dto/generate-template.input';
import { CreateTemplateInput } from './dto/create-template.input';
import { UpdateTemplateInput } from './dto/update-template.input';
import {
  applyTemplateValues,
  getExampleTemplateValues,
} from './template-renderer';

type TemplateEntity = Awaited<ReturnType<PrismaService['template']['create']>>;
type UserEntity = Awaited<ReturnType<PrismaService['user']['upsert']>>;
type TemplateSettingsEntity = Pick<
  UserEntity,
  'active_template_id' | 'nextcloud_file_path'
>;

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
  ): Promise<TemplateSettingsEntity> {
    await this.ensureUserExists(userId, userEmail);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        active_template_id: true,
        nextcloud_file_path: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return user;
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

    await this.prisma.$transaction(async (tx) => {
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

  async updateNextcloudFilePath(
    userId: string,
    userEmail: string | undefined,
    nextcloudFilePath: string,
  ): Promise<boolean> {
    await this.ensureUserExists(userId, userEmail);
    const path = nextcloudFilePath.trim();

    await this.prisma.user.update({
      where: { id: userId },
      data: { nextcloud_file_path: path.length > 0 ? path : null },
    });

    return true;
  }

  async sendTestEmail(
    userId: string,
    userEmail: string | undefined,
    recipientEmail: string,
  ): Promise<boolean> {
    const normalizedRecipient = recipientEmail.trim().toLowerCase();
    if (!normalizedRecipient) {
      throw new BadRequestException('Recipient email cannot be empty');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedRecipient)) {
      throw new BadRequestException('Recipient email is invalid');
    }

    await this.ensureUserExists(userId, userEmail);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        active_template_id: true,
      },
    });

    if (!user?.active_template_id) {
      throw new BadRequestException(
        'Set an active template before sending a test email',
      );
    }

    const template = await this.prisma.template.findUnique({
      where: { id: user.active_template_id },
    });

    if (!template || template.user_id !== userId) {
      throw new NotFoundException('Active template not found');
    }

    const renderedHtml = applyTemplateValues(
      template.content,
      getExampleTemplateValues(user.email),
    );

    const currentMonth = new Intl.DateTimeFormat('pl-PL', {
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    await this.emailService.sendHtmlEmail({
      to: normalizedRecipient,
      subject: `Test podsumowania wydatkow - ${currentMonth}`,
      html: renderedHtml,
    });

    return true;
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
