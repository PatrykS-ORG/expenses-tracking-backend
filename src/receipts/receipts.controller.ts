import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from '../ai/ai.service';

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Controller('api/receipts')
export class ReceiptsController {
  constructor(private readonly aiService: AiService) {}

  @Post('scan')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 2 * 1024 * 1024,
      },
    }),
  )
  async scanReceipt(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please attach an image in "file" field');
    }

    if (!SUPPORTED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WEBP images are supported');
    }

    const extractedText = await this.aiService.extractExpensesFromImage(
      file.buffer,
      file.mimetype,
    );

    return { extractedText };
  }
}
