import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

const MAX_SIZE_BYTES = 100 * 1024; // 100 KB
const QUALITY_START = 90;
const QUALITY_MIN = 20;
const QUALITY_STEP = 5;

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

export interface CompressResult {
  outputPath: string; // absolute fs path
  outputUrl: string;  // public URL for browser
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
  originalName: string;
  outputName: string;
}

export async function compressImage(
  buffer: Buffer,
  originalName: string
): Promise<CompressResult> {
  const originalSize = buffer.byteLength;
  const outputName = `${uuidv4()}.webp`;
  const outputPath = path.join(GENERATED_DIR, outputName);

  await fs.mkdir(GENERATED_DIR, { recursive: true });

  let quality = QUALITY_START;
  let outputBuffer: Buffer | null = null;

  while (quality >= QUALITY_MIN) {
    const candidate = await sharp(buffer)
      .webp({ quality })
      .toBuffer();

    if (candidate.byteLength <= MAX_SIZE_BYTES || quality === QUALITY_MIN) {
      outputBuffer = candidate;
      break;
    }

    quality -= QUALITY_STEP;
  }

  if (!outputBuffer) {
    // Fallback — should never hit, but guard against it
    outputBuffer = await sharp(buffer).webp({ quality: QUALITY_MIN }).toBuffer();
  }

  await fs.writeFile(outputPath, outputBuffer);

  const compressedSize = outputBuffer.byteLength;
  const reductionPercent = Math.round(
    ((originalSize - compressedSize) / originalSize) * 100
  );

  return {
    outputPath,
    outputUrl: `/generated/${outputName}`,
    originalSize,
    compressedSize,
    reductionPercent,
    originalName,
    outputName,
  };
}
