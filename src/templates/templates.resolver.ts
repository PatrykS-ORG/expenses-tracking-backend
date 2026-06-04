import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { UseGuards, UnauthorizedException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { Template } from './models/template.model';
import { GenerateTemplateInput } from './dto/generate-template.input';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUserGql } from '../auth/current-user.graphql.decorator';
import { TemplateSettings } from './models/template-settings.model';
import { CreateTemplateInput } from './dto/create-template.input';
import { UpdateTemplateInput } from './dto/update-template.input';
import { UpdateNextcloudFilePathInput } from './dto/update-nextcloud-file-path.input';

interface AuthenticatedUser {
  sub?: string;
  id?: string;
  email?: string;
}

@Resolver(() => Template)
export class TemplatesResolver {
  constructor(private readonly templatesService: TemplatesService) {}

  private extractUserId(user: AuthenticatedUser): string {
    const userId = user.sub ?? user.id;
    if (!userId) {
      throw new UnauthorizedException('Missing authenticated user identifier');
    }
    return userId;
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [Template])
  async myTemplates(@CurrentUserGql() user: AuthenticatedUser) {
    return this.templatesService.findAllByUser(this.extractUserId(user));
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => TemplateSettings)
  async myTemplateSettings(@CurrentUserGql() user: AuthenticatedUser) {
    return this.templatesService.getTemplateSettingsByUser(
      this.extractUserId(user),
      user.email,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Template)
  async generateTemplate(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: GenerateTemplateInput,
  ) {
    return this.templatesService.generateAndSaveTemplate(
      this.extractUserId(user),
      user.email,
      input,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Template)
  async createTemplate(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: CreateTemplateInput,
  ) {
    return this.templatesService.createTemplate(
      this.extractUserId(user),
      user.email,
      input,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Template)
  async updateTemplate(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: UpdateTemplateInput,
  ) {
    return this.templatesService.updateTemplate(this.extractUserId(user), input);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  async deleteTemplate(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('templateId') templateId: string,
  ) {
    return this.templatesService.deleteTemplate(this.extractUserId(user), templateId);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  async setActiveTemplate(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('templateId') templateId: string,
  ) {
    return this.templatesService.setActiveTemplate(
      this.extractUserId(user),
      templateId,
    );
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  async updateNextcloudFilePath(
    @CurrentUserGql() user: AuthenticatedUser,
    @Args('input') input: UpdateNextcloudFilePathInput,
  ) {
    return this.templatesService.updateNextcloudFilePath(
      this.extractUserId(user),
      user.email,
      input.nextcloudFilePath,
    );
  }
}
