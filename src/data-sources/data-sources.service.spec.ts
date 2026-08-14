import { BadRequestException } from '@nestjs/common';
import { DataSourcesService } from './data-sources.service';

describe('DataSourcesService current-month expenses', () => {
  const storageService = {
    uploadExpenseFile: jest.fn(),
    overwriteExpenseFile: jest.fn(),
    readTextFile: jest.fn(),
    readTextFileOrEmpty: jest.fn(),
  };
  const templatesService = {
    setFileUploadSource: jest.fn(),
    getFileUploadSourceConfig: jest.fn(),
    tryGetFileUploadSourceConfig: jest.fn(),
  };
  const aiService = {
    categorizeExpenses: jest.fn(),
  };

  const service = new DataSourcesService(
    storageService as never,
    templatesService as never,
    aiService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty breakdown when no file is configured', async () => {
    templatesService.tryGetFileUploadSourceConfig.mockResolvedValue(null);

    await expect(
      service.getCurrentMonthExpenses('user-1', 'a@b.c'),
    ).resolves.toEqual({
      categories: [],
      unassigned: [],
    });
  });

  it('parses categorized and unassigned lines from storage', async () => {
    templatesService.tryGetFileUploadSourceConfig.mockResolvedValue({
      bucket: 'expenses',
      filePath: 'user-1/2026-08.txt',
      uploadedAt: '2026-08-01T00:00:00.000Z',
    });
    storageService.readTextFileOrEmpty.mockResolvedValue(`
Groceries | Biedronka 45.20
Netflix 59.00
`);

    await expect(
      service.getCurrentMonthExpenses('user-1', 'a@b.c'),
    ).resolves.toEqual({
      categories: [
        {
          key: 'Groceries',
          items: [{ name: 'Biedronka', amount: '45.20' }],
        },
      ],
      unassigned: [{ name: 'Netflix', amount: '59.00' }],
    });
  });

  it('serializes and overwrites the expense file on save', async () => {
    templatesService.tryGetFileUploadSourceConfig.mockResolvedValue({
      bucket: 'expenses',
      filePath: 'user-1/2026-08.txt',
      uploadedAt: '2026-08-01T00:00:00.000Z',
    });
    storageService.overwriteExpenseFile.mockResolvedValue(undefined);
    templatesService.setFileUploadSource.mockResolvedValue(undefined);

    const result = await service.saveCurrentMonthExpenses('user-1', 'a@b.c', {
      categories: [
        {
          key: 'Transport',
          items: [{ name: 'Orlen', amount: '120.00' }],
        },
      ],
      unassigned: [{ name: 'Netflix', amount: '59' }],
    });

    expect(storageService.overwriteExpenseFile).toHaveBeenCalledWith(
      'expenses',
      'user-1/2026-08.txt',
      Buffer.from('Transport | Orlen 120.00\nNetflix 59.00\n', 'utf-8'),
    );
    expect(result).toEqual({
      categories: [
        {
          key: 'Transport',
          items: [{ name: 'Orlen', amount: '120.00' }],
        },
      ],
      unassigned: [{ name: 'Netflix', amount: '59.00' }],
    });
  });

  it('rejects invalid category keys on save', async () => {
    await expect(
      service.saveCurrentMonthExpenses('user-1', 'a@b.c', {
        categories: [
          {
            key: 'NotARealCategory',
            items: [{ name: 'X', amount: '1.00' }],
          },
        ],
        unassigned: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('suggests categories only for unassigned items', async () => {
    templatesService.tryGetFileUploadSourceConfig.mockResolvedValue({
      bucket: 'expenses',
      filePath: 'user-1/2026-08.txt',
      uploadedAt: '2026-08-01T00:00:00.000Z',
    });
    storageService.readTextFileOrEmpty.mockResolvedValue(`
Groceries | Biedronka 45.20
Orlen 120.00
`);
    aiService.categorizeExpenses.mockResolvedValue([
      { name: 'Transport', itemIds: [1] },
    ]);

    await expect(
      service.suggestExpenseCategories('user-1', 'a@b.c'),
    ).resolves.toEqual({
      suggestions: [
        { name: 'Orlen', amount: '120.00', categoryKey: 'Transport' },
      ],
    });

    expect(aiService.categorizeExpenses).toHaveBeenCalledWith(
      'user-1',
      [{ id: 1, name: 'Orlen', amountCents: 12_000 }],
      'MANUAL',
    );
  });

  it('returns empty suggestions when nothing is unassigned', async () => {
    templatesService.tryGetFileUploadSourceConfig.mockResolvedValue({
      bucket: 'expenses',
      filePath: 'user-1/2026-08.txt',
      uploadedAt: '2026-08-01T00:00:00.000Z',
    });
    storageService.readTextFileOrEmpty.mockResolvedValue(
      'Groceries | Biedronka 45.20\n',
    );

    await expect(
      service.suggestExpenseCategories('user-1', 'a@b.c'),
    ).resolves.toEqual({ suggestions: [] });
    expect(aiService.categorizeExpenses).not.toHaveBeenCalled();
  });
});
