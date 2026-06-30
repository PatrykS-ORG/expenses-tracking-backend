import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { GenerateTemplateInput } from './dto/generate-template.input';
import { EmailService } from '../email/email.service';
import { MAX_TEMPLATES_PER_USER } from './templates.constants';
import { UserProfileService } from '../users/user-profile.service';

describe('TemplatesService', () => {
  let service: TemplatesService;

  const prismaMock = {
    template: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  };

  const aiServiceMock = {
    generateTemplate: jest.fn(),
  };

  const emailServiceMock = {
    sendEmail: jest.fn(),
  };

  const userProfileServiceMock = {
    ensureUserProfile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AiService, useValue: aiServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: UserProfileService, useValue: userProfileServiceMock },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
  });

  it('returns templates ordered by created date', async () => {
    const userId = 'user-1';
    const templates = [
      {
        id: 'template-1',
        user_id: userId,
        name: 'Template',
        content: '<html></html>',
        created_at: new Date(),
      },
    ];
    prismaMock.template.findMany.mockResolvedValue(templates);

    const result = await service.findAllByUser(userId);

    expect(prismaMock.template.findMany).toHaveBeenCalledWith({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
    expect(result).toEqual(templates);
  });

  it('generates html template, saves it and sets active template', async () => {
    const userId = 'user-42';
    const input: GenerateTemplateInput = {
      tone: 'formalny',
      detailLevel: 'podsumowanie',
      focus: 'zrownowazony',
      visualStyle: 'minimalistyczny',
    };
    const generatedHtml = '<!DOCTYPE html><html><body>Test</body></html>';
    const createdTemplate = {
      id: 'template-99',
      user_id: userId,
      name: 'Szablon test',
      content: generatedHtml,
      created_at: new Date(),
    };

    aiServiceMock.generateTemplate.mockResolvedValue(generatedHtml);
    userProfileServiceMock.ensureUserProfile.mockResolvedValue(undefined);
    prismaMock.template.count.mockResolvedValue(0);
    prismaMock.template.create.mockResolvedValue(createdTemplate);
    prismaMock.user.update.mockResolvedValue({ id: userId });

    const result = await service.generateAndSaveTemplate(
      userId,
      'u@test.com',
      input,
    );

    expect(userProfileServiceMock.ensureUserProfile).toHaveBeenCalledWith(
      userId,
      'u@test.com',
    );
    expect(aiServiceMock.generateTemplate).toHaveBeenCalledWith(
      input.tone,
      input.detailLevel,
      input.focus,
      input.visualStyle,
    );
    const [[createCallArg]] = prismaMock.template.create.mock.calls as [
      [{ data: { user_id: string; name: string; content: string } }],
    ];
    expect(createCallArg.data.user_id).toBe(userId);
    expect(createCallArg.data.content).toBe(generatedHtml);
    expect(createCallArg.data.name.startsWith('Szablon - ')).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { active_template_id: createdTemplate.id },
    });
    expect(result).toEqual(createdTemplate);
  });

  it('rejects template generation when user reached template limit', async () => {
    const userId = 'user-42';
    const input: GenerateTemplateInput = {
      tone: 'formalny',
      detailLevel: 'podsumowanie',
      focus: 'zrownowazony',
      visualStyle: 'minimalistyczny',
    };

    userProfileServiceMock.ensureUserProfile.mockResolvedValue(undefined);
    prismaMock.template.count.mockResolvedValue(MAX_TEMPLATES_PER_USER);

    await expect(
      service.generateAndSaveTemplate(userId, 'u@test.com', input),
    ).rejects.toThrow(BadRequestException);

    expect(aiServiceMock.generateTemplate).not.toHaveBeenCalled();
    expect(prismaMock.template.create).not.toHaveBeenCalled();
  });

  it('rejects manual template creation when user reached template limit', async () => {
    const userId = 'user-42';

    userProfileServiceMock.ensureUserProfile.mockResolvedValue(undefined);
    prismaMock.template.count.mockResolvedValue(MAX_TEMPLATES_PER_USER);

    await expect(
      service.createTemplate(userId, 'u@test.com', {
        name: 'New template',
        content: '<html></html>',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.template.create).not.toHaveBeenCalled();
  });
});
