import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Tesseract from 'tesseract.js';
import {
  preprocessReceiptImagesForOcr,
  PreprocessedOcrVariant,
} from './receipt-image-preprocessor';

interface OcrCandidate {
  label: string;
  text: string;
  confidence: number;
  wordCount: number;
}

@Injectable()
export class ReceiptOcrService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReceiptOcrService.name);
  private worker: Tesseract.Worker | null = null;
  private workerInitPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.ensureWorker();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.workerInitPromise = null;
  }

  async extractText(imageBuffer: Buffer, mimeType: string): Promise<string> {
    try {
      await this.ensureWorker();
      const worker = this.worker;
      if (!worker) {
        throw new ServiceUnavailableException('OCR worker is not available');
      }

      const variants = await preprocessReceiptImagesForOcr(imageBuffer);
      const candidates = await Promise.all(
        variants.map((variant) => this.recognizeVariant(worker, variant)),
      );

      const best = this.pickBestCandidate(candidates);
      if (!best) {
        throw new ServiceUnavailableException(
          `OCR could not read any text from ${mimeType} receipt image`,
        );
      }

      this.logger.debug(
        `Selected OCR variant "${best.label}" (confidence=${best.confidence.toFixed(1)}, words=${best.wordCount})`,
      );

      return best.text.slice(0, 12000);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed OCR extraction from receipt image: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Could not read text from receipt image',
      );
    }
  }

  private async ensureWorker(): Promise<void> {
    if (this.worker) {
      return;
    }

    if (!this.workerInitPromise) {
      this.workerInitPromise = this.initializeWorker();
    }

    await this.workerInitPromise;
  }

  private async initializeWorker(): Promise<void> {
    const ocrLanguage =
      this.configService.get<string>('RECEIPT_OCR_LANG')?.trim() || 'eng+pol';
    const pageSegMode = this.resolvePageSegMode();

    const worker = await Tesseract.createWorker(ocrLanguage);
    await worker.setParameters({
      tessedit_pageseg_mode: pageSegMode,
      user_defined_dpi: '300',
      preserve_interword_spaces: '1',
    });

    this.worker = worker;
  }

  /**
   * Receipts are narrow single-column strips of text. `PSM.AUTO` runs full
   * page-layout analysis and frequently misdetects the name column and the
   * "qty x unit_price total" column as two separate blocks, emitting all
   * item names first and all price lines second — silently decoupling every
   * name from its price. `PSM.SINGLE_COLUMN` keeps each physical line intact
   * (name and its price on the same output line), which is what downstream
   * parsing (and the LLM) relies on to pair names with the correct amount.
   */
  private resolvePageSegMode(): Tesseract.PSM {
    const configured = this.configService
      .get<string>('RECEIPT_OCR_PSM')
      ?.trim();

    const validModes = Object.values(Tesseract.PSM) as string[];
    if (configured && validModes.includes(configured)) {
      return configured as Tesseract.PSM;
    }

    return Tesseract.PSM.SINGLE_COLUMN;
  }

  private async recognizeVariant(
    worker: Tesseract.Worker,
    variant: PreprocessedOcrVariant,
  ): Promise<OcrCandidate> {
    const result = await worker.recognize(variant.buffer, { rotateAuto: true });
    const text = this.normalizeOcrText(result.data.text || '');
    const confidence = result.data.confidence ?? 0;
    const wordCount = this.countMeaningfulWords(text);

    return {
      label: variant.label,
      text,
      confidence,
      wordCount,
    };
  }

  private pickBestCandidate(candidates: OcrCandidate[]): OcrCandidate | null {
    const readable = candidates.filter((candidate) => candidate.wordCount > 0);
    if (readable.length === 0) {
      return null;
    }

    // Word count alone rewards noisy binarization that "recognizes" lots of
    // garbage tokens; confidence alone can favor a near-empty read. Scoring
    // by their product balances "read a lot of text" against "was actually
    // confident about it", which in practice picks the visibly cleaner
    // candidate far more often than either metric alone.
    return readable.sort(
      (left, right) =>
        right.confidence * right.wordCount - left.confidence * left.wordCount,
    )[0];
  }

  private normalizeOcrText(rawText: string): string {
    return rawText
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')
      .trim();
  }

  private countMeaningfulWords(text: string): number {
    return text
      .split(/\s+/)
      .filter((word) => word.replace(/\W/g, '').length > 0).length;
  }
}
