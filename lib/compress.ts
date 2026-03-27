import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { formatExt } from "./presets";
import type { CompressionOptions } from "./settings";

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

export const DEFAULT_OPTIONS: CompressionOptions = {
  targetSizeKB: 100,
  format: "webp",
  qualityStart: 85,
  qualityMin: 20,
  qualityStep: 5, // kept for backwards-compat; binary search ignores it
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
}

export async function compressImage(
  buffer: Buffer,
  originalName: string,
  options: CompressionOptions = DEFAULT_OPTIONS
): Promise<CompressResult> {
  const { targetSizeKB, format, qualityStart, qualityMin, resize, stripMetadata } =
    options;

  const maxBytes = targetSizeKB * 1024;
  const ext = formatExt(format);
  const outputName = `${uuidv4()}.${ext}`;
  const outputPath = path.join(GENERATED_DIR, outputName);

  await fs.mkdir(GENERATED_DIR, { recursive: true });

  // Build once-resized base buffer so every encode pass reuses the same pixels.
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

  // ── Early exit ─────────────────────────────────────────────────────────────
  // If encoding at maximum quality already satisfies the target, use it as-is —
  // no need to search at all.
  const earlyCandidate = await encodeBuffer(baseBuffer, format, qualityStart);
  if (earlyCandidate.byteLength <= maxBytes) {
    await fs.writeFile(outputPath, earlyCandidate);
    return buildResult(outputPath, outputName, originalName, format, originalSize, earlyCandidate);
  }

  // ── Binary search ──────────────────────────────────────────────────────────
  // Find the highest quality in [qualityMin, qualityStart] whose encoded size
  // fits within maxBytes.  O(log n) encodes vs O(n) for linear step-down.
  let lo = qualityMin;
  let hi = qualityStart - 1; // qualityStart was already tried above
  let bestBuffer: Buffer | null = null;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = await encodeBuffer(baseBuffer, format, mid);

    if (candidate.byteLength <= maxBytes) {
      bestBuffer = candidate; // fits — try higher quality
      lo = mid + 1;
    } else {
      hi = mid - 1; // too large — try lower quality
    }
  }

  // Safety fallback: nothing in the range fit — use the lowest allowed quality.
  if (!bestBuffer) {
    bestBuffer = await encodeBuffer(baseBuffer, format, qualityMin);
  }

  await fs.writeFile(outputPath, bestBuffer);
  return buildResult(outputPath, outputName, originalName, format, originalSize, bestBuffer);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildResult(
  outputPath: string,
  outputName: string,
  originalName: string,
  format: CompressionOptions["format"],
  originalSize: number,
  outputBuffer: Buffer
): CompressResult {
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
    outputFormat: format,
  };
}

async function encodeBuffer(
  buf: Buffer,
  format: CompressionOptions["format"],
  quality: number
): Promise<Buffer> {
  switch (format) {
    case "avif":
      return sharp(buf).avif({ quality }).toBuffer();
    case "jpeg":
      return sharp(buf).jpeg({ quality, mozjpeg: true }).toBuffer();
    default:
      return sharp(buf).webp({ quality }).toBuffer();
  }
}

/**
 * Concurrency-limited parallel map.
 * Spawns at most `limit` concurrent workers over `items`.
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
