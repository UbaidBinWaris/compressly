import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { formatExt, ALPHA_SAFE_FORMATS } from "./presets";
import { sanitizeBasename } from "./utils";
import { UPLOADS_TMP_DIR, GENERATED_DIR } from "./cleanup";
import type { CompressionOptions } from "./settings";

// Allowed extensions for saved originals
const SAFE_INPUT_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

export const DEFAULT_OPTIONS: CompressionOptions = {
  targetSizeKB: 100,
  format: "webp",
  qualityStart: 85,
  qualityMin: 20,
  qualityStep: 5,
  resize: null,
  stripMetadata: true,
};

export interface CompressResult {
  outputPath: string;
  outputUrl: string;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
  originalName: string;
  outputName: string;
  outputFormat: string;
  /** Filename of the preserved original — used for Re-optimize */
  uploadId: string;
  /** True when the requested format was changed (e.g. JPEG → WebP for alpha images) */
  formatOverridden: boolean;
  /** Final quality value used (compressionLevel for PNG, 1-100 for lossy) */
  quality: number;
}

export async function compressImage(
  buffer: Buffer,
  originalName: string,
  options: CompressionOptions = DEFAULT_OPTIONS
): Promise<CompressResult> {
  const { targetSizeKB, format, qualityStart, qualityMin, resize, stripMetadata } =
    options;

  // ── 1. Save original to uploads/tmp ──────────────────────────────────────
  await fs.mkdir(UPLOADS_TMP_DIR, { recursive: true });
  await fs.mkdir(GENERATED_DIR, { recursive: true });

  const rawExt = path.extname(originalName).toLowerCase();
  const safeExt = SAFE_INPUT_EXTS.has(rawExt) ? rawExt : ".bin";
  const uploadId = `${uuidv4()}_${Date.now()}${safeExt}`;
  const uploadPath = path.join(UPLOADS_TMP_DIR, uploadId);
  await fs.writeFile(uploadPath, buffer);

  // ── 2. Alpha channel detection ────────────────────────────────────────────
  const metadata = await sharp(buffer).metadata();
  const hasAlpha = metadata.hasAlpha === true;

  // If the requested format can't carry transparency, silently upgrade to WebP
  const effectiveFormat =
    hasAlpha && !ALPHA_SAFE_FORMATS.includes(format) ? "webp" : format;
  const formatOverridden = effectiveFormat !== format;

  // ── 3. Build resized base buffer ─────────────────────────────────────────
  let base = stripMetadata ? sharp(buffer) : sharp(buffer).withMetadata();
  if (resize && (resize.width || resize.height)) {
    base = base.resize({
      width: resize.width ?? undefined,
      height: resize.height ?? undefined,
      fit: resize.maintainAspect ? "inside" : "fill",
      withoutEnlargement: true,
    });
  }
  const baseBuffer = await base.toBuffer();

  const originalSize = buffer.byteLength;
  const maxBytes = targetSizeKB * 1024;

  // ── 4. Output filename: basename_timestamp_qQuality.ext ─────────────────
  const ext = formatExt(effectiveFormat);
  const fileBase = sanitizeBasename(path.basename(originalName, path.extname(originalName)));
  // Quality placeholder — will be filled after encoding
  const ts = Date.now();

  // ── 5. Encode ─────────────────────────────────────────────────────────────
  let outputBuffer: Buffer;
  let finalQuality: number;

  if (effectiveFormat === "png") {
    // PNG is lossless — binary search doesn't apply.
    // compressionLevel 9 = smallest possible lossless file.
    outputBuffer = await encodePng(baseBuffer);
    finalQuality = 9; // compressionLevel
  } else {
    // Early exit: if max quality already fits, use it.
    const earlyCandidate = await encodeBuffer(baseBuffer, effectiveFormat, qualityStart);
    if (earlyCandidate.byteLength <= maxBytes) {
      outputBuffer = earlyCandidate;
      finalQuality = qualityStart;
    } else {
      // Binary search for highest quality that still fits.
      let lo = qualityMin;
      let hi = qualityStart - 1;
      let bestBuffer: Buffer | null = null;
      let bestQuality = qualityMin;

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const candidate = await encodeBuffer(baseBuffer, effectiveFormat, mid);

        if (candidate.byteLength <= maxBytes) {
          bestBuffer = candidate;
          bestQuality = mid;
          lo = mid + 1; // fits — try higher quality
        } else {
          hi = mid - 1; // too large — try lower
        }
      }

      // Fallback if nothing fit (very large or complex image)
      if (bestBuffer) {
        outputBuffer = bestBuffer;
        finalQuality = bestQuality;
      } else {
        outputBuffer = await encodeBuffer(baseBuffer, effectiveFormat, qualityMin);
        finalQuality = qualityMin;
      }
    }
  }

  // ── 6. Write output with quality-stamped filename ─────────────────────────
  const outputName = `${fileBase}_${ts}_q${finalQuality}.${ext}`;
  const outputPath = path.join(GENERATED_DIR, outputName);
  await fs.writeFile(outputPath, outputBuffer);

  const compressedSize = outputBuffer.byteLength;
  return {
    outputPath,
    outputUrl: `/generated/${outputName}`,
    originalSize,
    compressedSize,
    reductionPercent: Math.max(
      0,
      Math.round(((originalSize - compressedSize) / originalSize) * 100)
    ),
    originalName,
    outputName,
    outputFormat: effectiveFormat,
    uploadId,
    formatOverridden,
    quality: finalQuality,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function encodeBuffer(
  buf: Buffer,
  format: Exclude<CompressionOptions["format"], "png">,
  quality: number
): Promise<Buffer> {
  switch (format) {
    case "avif":
      return sharp(buf).avif({ quality }).toBuffer();
    case "jpeg":
      return sharp(buf).jpeg({ quality, mozjpeg: true }).toBuffer();
    default: // webp
      return sharp(buf).webp({ quality }).toBuffer();
  }
}

async function encodePng(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

/**
 * Concurrency-limited parallel map.
 * Spawns at most `limit` workers running `fn` over `items`.
 */
export async function concurrentMap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}
