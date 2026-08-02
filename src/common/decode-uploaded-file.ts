import { BadRequestException } from '@nestjs/common';

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export interface DecodedFileUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export function decodeUploadedFile(input: {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}): DecodedFileUpload {
  const fileName = input.fileName?.trim();
  if (!fileName) {
    throw new BadRequestException('fileName is required');
  }

  const contentBase64 = input.contentBase64?.trim();
  if (!contentBase64) {
    throw new BadRequestException('contentBase64 is required');
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(contentBase64, 'base64');
  } catch {
    throw new BadRequestException('contentBase64 must be valid base64');
  }

  if (buffer.byteLength === 0) {
    throw new BadRequestException('File content cannot be empty');
  }

  if (buffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    throw new BadRequestException('File content exceeds 5MB limit');
  }

  return {
    buffer,
    originalname: fileName,
    mimetype: input.mimeType?.trim() || 'application/octet-stream',
  };
}
