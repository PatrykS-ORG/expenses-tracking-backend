import { BadRequestException, Injectable } from '@nestjs/common';
import { decodeUploadedFile } from '../common/decode-uploaded-file';
import { AiService } from '../ai/ai.service';
import { centsToAmount } from '../ai/expense-amount.formatter';
import {
  CanonicalExpense,
  CategorizedExpenseFile,
  parseCategorizedExpenseFile,
  serializeCategorizedExpenseFile,
} from '../ai/expense-file.parser';
import { AiUsageTrigger } from '../generated/prisma/client';
import { parseMoneyToCents } from '../summary/summary-manual-input.parser';
import {
  CANONICAL_CATEGORY_KEYS,
  isValidCategoryKey,
  normalizeCategoryName,
} from '../summary/summary-category.constants';
import { DATA_SOURCE_TYPES } from './data-source.types';
import { DataSourceTypeEnum } from '../templates/models/data-source-type.enum';
import { ExpenseFileUploadInput } from './dto/expense-file-upload.input';
import { SaveCurrentMonthExpensesInput } from './dto/save-current-month-expenses.input';
import {
  CurrentMonthExpenseItem,
  CurrentMonthExpenses,
} from './models/current-month-expenses.model';
import { SuggestExpenseCategoriesResult } from './models/suggest-expense-categories.model';
import {
  CurrentExpenseFile,
  UploadedExpenseFile,
} from './models/uploaded-expense-file.model';
import { SupabaseStorageService } from './supabase-storage.service';
import { TemplatesService } from '../templates/templates.service';

@Injectable()
export class DataSourcesService {
  constructor(
    private readonly storageService: SupabaseStorageService,
    private readonly templatesService: TemplatesService,
    private readonly aiService: AiService,
  ) {}

  async uploadExpenseFile(
    userId: string,
    userEmail: string | undefined,
    input: ExpenseFileUploadInput,
  ): Promise<UploadedExpenseFile> {
    const file = decodeUploadedFile(input);
    const uploadedFileConfig = await this.storageService.uploadExpenseFile(
      userId,
      file,
    );

    await this.templatesService.setFileUploadSource(
      userId,
      userEmail,
      uploadedFileConfig,
    );

    return this.toUploadedExpenseFile(uploadedFileConfig);
  }

  async getCurrentExpenseFile(
    userId: string,
    userEmail: string | undefined,
  ): Promise<CurrentExpenseFile> {
    const uploadedFileConfig =
      await this.templatesService.getFileUploadSourceConfig(userId, userEmail);
    const content = await this.storageService.readTextFile(
      uploadedFileConfig.bucket,
      uploadedFileConfig.filePath,
      uploadedFileConfig.uploadedAt,
    );

    return {
      ...this.toUploadedExpenseFile(uploadedFileConfig),
      content,
    };
  }

  async getCurrentMonthExpenses(
    userId: string,
    userEmail: string | undefined,
  ): Promise<CurrentMonthExpenses> {
    const content = await this.readExpenseFileContentOrEmpty(userId, userEmail);
    return this.toCurrentMonthExpenses(parseCategorizedExpenseFile(content));
  }

  async saveCurrentMonthExpenses(
    userId: string,
    userEmail: string | undefined,
    input: SaveCurrentMonthExpensesInput,
  ): Promise<CurrentMonthExpenses> {
    const categorized = this.parseSaveInput(input);
    const content = serializeCategorizedExpenseFile(categorized);
    await this.writeExpenseFileContent(userId, userEmail, content);
    return this.toCurrentMonthExpenses(categorized);
  }

  async suggestExpenseCategories(
    userId: string,
    userEmail: string | undefined,
  ): Promise<SuggestExpenseCategoriesResult> {
    const content = await this.readExpenseFileContentOrEmpty(userId, userEmail);
    const categorized = parseCategorizedExpenseFile(content);

    if (categorized.unassigned.length === 0) {
      return { suggestions: [] };
    }

    const expenses: CanonicalExpense[] = categorized.unassigned.map(
      (item, index) => ({
        id: index + 1,
        name: item.name,
        amountCents: item.amountCents,
      }),
    );

    const assignments = await this.aiService.categorizeExpenses(
      userId,
      expenses,
      AiUsageTrigger.MANUAL,
    );

    const byId = new Map(expenses.map((expense) => [expense.id, expense]));
    const suggestions: SuggestExpenseCategoriesResult['suggestions'] = [];
    const assignedIds = new Set<number>();

    for (const assignment of assignments) {
      const categoryKey = normalizeCategoryName(assignment.name);
      for (const itemId of assignment.itemIds) {
        if (assignedIds.has(itemId)) {
          continue;
        }
        const expense = byId.get(itemId);
        if (!expense) {
          continue;
        }
        assignedIds.add(itemId);
        suggestions.push({
          name: expense.name,
          amount: centsToAmount(expense.amountCents).toFixed(2),
          categoryKey,
        });
      }
    }

    for (const expense of expenses) {
      if (assignedIds.has(expense.id)) {
        continue;
      }
      suggestions.push({
        name: expense.name,
        amount: centsToAmount(expense.amountCents).toFixed(2),
        categoryKey: 'Other',
      });
    }

    return { suggestions };
  }

  async overwriteCurrentExpenseFile(
    userId: string,
    userEmail: string | undefined,
    input: ExpenseFileUploadInput,
  ): Promise<UploadedExpenseFile> {
    const file = decodeUploadedFile(input);
    const existingConfig =
      await this.templatesService.tryGetFileUploadSourceConfig(
        userId,
        userEmail,
      );

    if (!existingConfig) {
      const uploadedFileConfig = await this.storageService.uploadExpenseFile(
        userId,
        file,
      );
      await this.templatesService.setFileUploadSource(
        userId,
        userEmail,
        uploadedFileConfig,
      );
      return this.toUploadedExpenseFile(uploadedFileConfig);
    }

    await this.storageService.overwriteExpenseFile(
      existingConfig.bucket,
      existingConfig.filePath,
      file.buffer,
    );

    const updatedConfig = {
      ...existingConfig,
      uploadedAt: new Date().toISOString(),
    };
    await this.templatesService.setFileUploadSource(
      userId,
      userEmail,
      updatedConfig,
    );

    return this.toUploadedExpenseFile(updatedConfig);
  }

  async readExpenseFileContentOrEmpty(
    userId: string,
    userEmail: string | undefined,
  ): Promise<string> {
    const existingConfig =
      await this.templatesService.tryGetFileUploadSourceConfig(
        userId,
        userEmail,
      );
    if (!existingConfig) {
      return '';
    }

    return this.storageService.readTextFileOrEmpty(
      existingConfig.bucket,
      existingConfig.filePath,
      existingConfig.uploadedAt,
    );
  }

  private async writeExpenseFileContent(
    userId: string,
    userEmail: string | undefined,
    content: string,
  ): Promise<void> {
    const buffer = Buffer.from(content, 'utf-8');
    const existingConfig =
      await this.templatesService.tryGetFileUploadSourceConfig(
        userId,
        userEmail,
      );

    if (!existingConfig) {
      const uploadedFileConfig = await this.storageService.uploadExpenseFile(
        userId,
        {
          buffer,
          originalname: 'expenses.txt',
          mimetype: 'text/plain',
        },
      );
      await this.templatesService.setFileUploadSource(
        userId,
        userEmail,
        uploadedFileConfig,
      );
      return;
    }

    await this.storageService.overwriteExpenseFile(
      existingConfig.bucket,
      existingConfig.filePath,
      buffer,
    );

    await this.templatesService.setFileUploadSource(userId, userEmail, {
      ...existingConfig,
      uploadedAt: new Date().toISOString(),
    });
  }

  private parseSaveInput(
    input: SaveCurrentMonthExpensesInput,
  ): CategorizedExpenseFile {
    const seenKeys = new Set<string>();
    const categories: CategorizedExpenseFile['categories'] = [];

    for (const [index, category] of input.categories.entries()) {
      if (!isValidCategoryKey(category.key)) {
        throw new BadRequestException(
          `Invalid category key at position ${index + 1}`,
        );
      }
      if (seenKeys.has(category.key)) {
        throw new BadRequestException(
          `Duplicate category key: ${category.key}`,
        );
      }
      seenKeys.add(category.key);

      const items = category.items.map((item, itemIndex) => {
        const name = item.name.trim();
        if (!name) {
          throw new BadRequestException(
            `${category.key} item ${itemIndex + 1} name is required`,
          );
        }
        return {
          name,
          amountCents: parseMoneyToCents(
            item.amount,
            `${category.key} item ${itemIndex + 1}`,
          ),
        };
      });

      if (items.length > 0) {
        categories.push({ key: category.key, items });
      }
    }

    const unassigned = input.unassigned.map((item, itemIndex) => {
      const name = item.name.trim();
      if (!name) {
        throw new BadRequestException(
          `Unassigned item ${itemIndex + 1} name is required`,
        );
      }
      return {
        name,
        amountCents: parseMoneyToCents(
          item.amount,
          `Unassigned item ${itemIndex + 1}`,
        ),
      };
    });

    // Preserve canonical category order for stable serialization.
    categories.sort(
      (a, b) =>
        CANONICAL_CATEGORY_KEYS.indexOf(a.key) -
        CANONICAL_CATEGORY_KEYS.indexOf(b.key),
    );

    return { categories, unassigned };
  }

  private toCurrentMonthExpenses(
    categorized: CategorizedExpenseFile,
  ): CurrentMonthExpenses {
    return {
      categories: categorized.categories.map((category) => ({
        key: category.key,
        items: category.items.map((item) => this.toAmountItem(item)),
      })),
      unassigned: categorized.unassigned.map((item) => this.toAmountItem(item)),
    };
  }

  private toAmountItem(item: {
    name: string;
    amountCents: number;
  }): CurrentMonthExpenseItem {
    return {
      name: item.name,
      amount: centsToAmount(item.amountCents).toFixed(2),
    };
  }

  private toUploadedExpenseFile(config: {
    bucket: string;
    filePath: string;
    uploadedAt?: string;
    originalFileName?: string;
  }): UploadedExpenseFile {
    return {
      dataSourceType: DATA_SOURCE_TYPES.FILE_UPLOAD as DataSourceTypeEnum,
      uploadedFilePath: config.filePath,
      bucket: config.bucket,
      uploadedAt: config.uploadedAt,
      originalFileName: config.originalFileName,
    };
  }
}
