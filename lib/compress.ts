import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { formatExt, ALPHA_SAFE_FORMATS } from "./presets";
import { sanitizeBasename } from "./utils";
import { UPLOADS_TMP_DIR, GENERATED_DIR } from "./cleanup";
import type { CompressionOptions } from "./settings";

// Security: block decompression bombs (max 4096×4096 = 16.7 MP)
// Applied per-instance via options (avoids Turbopack ESM interop issues with static methods)
const PIXEL_LIMIT = 4096 * 4096;

// Allowed extensions for saved originals
const SAFE_INPUT_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

/**
 * Resolves or rejects after `ms` milliseconds.
 * Wrap any async operation to enforce a hard timeout.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

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
  // limitInputPixels is set globally above; sharp enforces it on every decode
  const metadata = await withTimeout(sharp(buffer, { limitInputPixels: PIXEL_LIMIT }).metadata(), 8000, "metadata");
  const hasAlpha = metadata.hasAlpha === true;

  // If the requested format can't carry transparency, silently upgrade to WebP
  const effectiveFormat =
    hasAlpha && !ALPHA_SAFE_FORMATS.includes(format) ? "webp" : format;
  const formatOverridden = effectiveFormat !== format;

  // ── 3. Build resized base buffer ─────────────────────────────────────────
  const baseBuffer = await buildBaseBuffer(buffer, resize, stripMetadata);

  const originalSize = buffer.byteLength;
  const maxBytes = targetSizeKB * 1024;

  // ── 4. Output filename: basename_timestamp_qQuality.ext ─────────────────
  const ext = formatExt(effectiveFormat);
  const fileBase = sanitizeBasename(path.basename(originalName, path.extname(originalName)));
  const ts = Date.now();

  // ── 5. Encode ─────────────────────────────────────────────────────────────
  const { outputBuffer, finalQuality } = await encodeToTarget(
    baseBuffer, effectiveFormat, originalSize, maxBytes, qualityStart, qualityMin
  );

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

async function buildBaseBuffer(
  buffer: Buffer,
  resize: CompressionOptions["resize"],
  stripMetadata: boolean
): Promise<Buffer> {
  let base = stripMetadata
    ? sharp(buffer, { limitInputPixels: PIXEL_LIMIT })
    : sharp(buffer, { limitInputPixels: PIXEL_LIMIT }).withMetadata();
  if (resize && (resize.width || resize.height)) {
    base = base.resize({
      width: resize.width ?? undefined,
      height: resize.height ?? undefined,
      fit: resize.maintainAspect ? "inside" : "fill",
      withoutEnlargement: true,
    });
  }
  return base.toBuffer();
}

async function encodeToTarget(
  baseBuffer: Buffer,
  format: CompressionOptions["format"],
  originalSize: number,
  maxBytes: number,
  qualityStart: number,
  qualityMin: number
): Promise<{ outputBuffer: Buffer; finalQuality: number }> {
  if (format === "png") {
    return { outputBuffer: await encodePng(baseBuffer), finalQuality: 9 };
  }

  // Input already fits the budget — encode once at max quality, skip binary search.
  if (originalSize <= maxBytes) {
    return { outputBuffer: await encodeBuffer(baseBuffer, format, qualityStart), finalQuality: qualityStart };
  }

  // Early exit: max quality already fits.
  const earlyCandidate = await encodeBuffer(baseBuffer, format, qualityStart);
  if (earlyCandidate.byteLength <= maxBytes) {
    return { outputBuffer: earlyCandidate, finalQuality: qualityStart };
  }

  return binarySearchEncode(baseBuffer, format, maxBytes, qualityStart, qualityMin);
}

async function binarySearchEncode(
  baseBuffer: Buffer,
  format: Exclude<CompressionOptions["format"], "png">,
  maxBytes: number,
  qualityStart: number,
  qualityMin: number
): Promise<{ outputBuffer: Buffer; finalQuality: number }> {
  let lo = qualityMin;
  let hi = qualityStart - 1;
  let bestBuffer: Buffer | null = null;
  let bestQuality = qualityMin;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = await encodeBuffer(baseBuffer, format, mid);
    if (candidate.byteLength <= maxBytes) {
      bestBuffer = candidate;
      bestQuality = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (bestBuffer) {
    return { outputBuffer: bestBuffer, finalQuality: bestQuality };
  }
  // Fallback: nothing fit — use minimum quality
  return { outputBuffer: await encodeBuffer(baseBuffer, format, qualityMin), finalQuality: qualityMin };
}

async function encodeBuffer(
  buf: Buffer,
  format: Exclude<CompressionOptions["format"], "png">,
  quality: number
): Promise<Buffer> {
  const opts = { limitInputPixels: PIXEL_LIMIT };
  switch (format) {
    case "avif":
      return sharp(buf, opts).avif({ quality }).toBuffer();
    case "jpeg":
      return sharp(buf, opts).jpeg({ quality, mozjpeg: true }).toBuffer();
    default: // webp
      return sharp(buf, opts).webp({ quality }).toBuffer();
  }
}

async function encodePng(buf: Buffer): Promise<Buffer> {
  return sharp(buf, { limitInputPixels: PIXEL_LIMIT })
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
