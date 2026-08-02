import sharp from 'sharp';

const MIN_OCR_DIMENSION = 1800;
const TRIM_THRESHOLD = 15;
const ADAPTIVE_BLOCK_RADIUS = 15;
const ADAPTIVE_OFFSET = 12;

export interface PreprocessedOcrVariant {
  label: string;
  buffer: Buffer;
}

function buildUpscaledPipeline(imageBuffer: Buffer) {
  const metadataPromise = sharp(imageBuffer).metadata();

  return metadataPromise.then((metadata) => {
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const minDimension = Math.min(width, height);

    let pipeline = sharp(imageBuffer).rotate();

    if (minDimension > 0 && minDimension < MIN_OCR_DIMENSION) {
      const scale = MIN_OCR_DIMENSION / minDimension;
      pipeline = pipeline.resize({
        width: width ? Math.round(width * scale) : undefined,
        height: height ? Math.round(height * scale) : undefined,
        fit: 'inside',
        withoutEnlargement: false,
      });
    }

    return pipeline.grayscale();
  });
}

async function prepareBaseGrayscalePng(imageBuffer: Buffer): Promise<Buffer> {
  const greyscale = await buildUpscaledPipeline(imageBuffer);

  try {
    return greyscale
      .clone()
      .trim({ threshold: TRIM_THRESHOLD })
      .png()
      .toBuffer();
  } catch {
    return greyscale.png().toBuffer();
  }
}

async function toSingleChannelUchar(
  imageBuffer: Buffer,
): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(imageBuffer)
    .greyscale()
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Copy defensively: sharp/libvips can alias the underlying pixel memory of
  // `data` with the pipeline that produced it, which is unsafe once the
  // buffer is handed to a brand new sharp() instance.
  return { data: Buffer.from(data), width: info.width, height: info.height };
}

function adaptiveThreshold(
  pixels: Buffer,
  width: number,
  height: number,
  radius: number,
  offset: number,
): Buffer {
  const source = new Uint8Array(pixels);
  const output = new Uint8Array(source.length);
  const integralWidth = width + 1;
  const integral = new Float64Array(integralWidth * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += source[y * width + x];
      const above = integral[y * integralWidth + x + 1];
      integral[(y + 1) * integralWidth + x + 1] = rowSum + above;
    }
  }

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(height - 1, y + radius);

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - radius);
      const x2 = Math.min(width - 1, x + radius);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * integralWidth + x2 + 1] -
        integral[y1 * integralWidth + x2 + 1] -
        integral[(y2 + 1) * integralWidth + x1] +
        integral[y1 * integralWidth + x1];
      const localMean = sum / area;
      const idx = y * width + x;
      output[idx] = source[idx] < localMean - offset ? 0 : 255;
    }
  }

  return Buffer.from(output);
}

async function buildContrastVariant(basePng: Buffer): Promise<Buffer> {
  // Deliberately avoids sharp's `.clahe()`: under concurrent use (this
  // variant is built alongside the other two via Promise.all) it has proven
  // unreliable in practice — it can throw "hist_local: image must be
  // VIPS_FORMAT_UCHAR" on genuinely valid 8-bit input, and libvips's error
  // state has been observed to leak into unrelated sharp calls issued around
  // the same time, which can take down this whole variant. A global
  // normalize + sharpen pass is simpler, has no such failure mode, and is
  // "good enough" contrast enhancement for thermal receipt scans.
  return sharp(basePng).greyscale().normalize().sharpen().png().toBuffer();
}

async function buildAdaptiveThresholdVariant(basePng: Buffer): Promise<Buffer> {
  const { data, width, height } = await toSingleChannelUchar(basePng);
  const denoised = await sharp(data, { raw: { width, height, channels: 1 } })
    .median(3)
    .raw()
    .toBuffer();

  const binarized = adaptiveThreshold(
    denoised,
    width,
    height,
    ADAPTIVE_BLOCK_RADIUS,
    ADAPTIVE_OFFSET,
  );

  return sharp(binarized, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

async function buildFixedThresholdVariant(
  basePng: Buffer,
  threshold: number,
): Promise<Buffer> {
  return sharp(basePng)
    .greyscale()
    .normalize()
    .sharpen()
    .threshold(threshold)
    .png()
    .toBuffer();
}

async function buildVariantSafely(
  label: string,
  build: () => Promise<Buffer>,
): Promise<PreprocessedOcrVariant | null> {
  try {
    return { label, buffer: await build() };
  } catch {
    return null;
  }
}

/**
 * Builds several OCR-ready variants so Tesseract can pick the best read.
 */
export async function preprocessReceiptImagesForOcr(
  imageBuffer: Buffer,
): Promise<PreprocessedOcrVariant[]> {
  const basePng = await prepareBaseGrayscalePng(imageBuffer);

  const variants = await Promise.all([
    buildVariantSafely('contrast-enhanced', () =>
      buildContrastVariant(basePng),
    ),
    buildVariantSafely('adaptive-threshold', () =>
      buildAdaptiveThresholdVariant(basePng),
    ),
    buildVariantSafely('fixed-threshold', () =>
      buildFixedThresholdVariant(basePng, 128),
    ),
  ]);

  const ready = variants.filter(
    (variant): variant is PreprocessedOcrVariant => variant !== null,
  );

  if (ready.length === 0) {
    return [{ label: 'original-greyscale', buffer: basePng }];
  }

  return ready;
}
