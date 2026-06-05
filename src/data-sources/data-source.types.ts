import { DataSourceType, Prisma } from '../generated/prisma/client';

export interface FileUploadDataSourceConfig {
  bucket: string;
  filePath: string;
  uploadedAt?: string;
  originalFileName?: string;
}

export interface NextcloudDataSourceConfig {
  filePath: string;
}

function isRecord(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseFileUploadConfig(
  config: Prisma.JsonValue | null,
): FileUploadDataSourceConfig | null {
  if (!isRecord(config)) {
    return null;
  }

  const bucket = config.bucket;
  const filePath = config.filePath;
  const uploadedAt = config.uploadedAt;
  const originalFileName = config.originalFileName;

  if (typeof bucket !== 'string' || typeof filePath !== 'string') {
    return null;
  }

  return {
    bucket,
    filePath,
    uploadedAt: typeof uploadedAt === 'string' ? uploadedAt : undefined,
    originalFileName:
      typeof originalFileName === 'string' ? originalFileName : undefined,
  };
}

export function parseNextcloudConfig(
  config: Prisma.JsonValue | null,
): NextcloudDataSourceConfig | null {
  if (!isRecord(config)) {
    return null;
  }

  const filePath = config.filePath;
  if (typeof filePath !== 'string') {
    return null;
  }

  return { filePath };
}

export function toPrismaJsonValue(value: object): Prisma.InputJsonValue {
  return value;
}

export const DATA_SOURCE_TYPES = {
  FILE_UPLOAD: DataSourceType.FILE_UPLOAD,
  NEXTCLOUD: DataSourceType.NEXTCLOUD,
} as const;
