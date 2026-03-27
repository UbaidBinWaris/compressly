import crypto from "crypto";
import path from "path";
import fs from "fs/promises";
import type { CompressionOptions } from "./settings";

export const CACHE_DIR = path.join(process.cwd(), "public", "generated", "cache");

// ── Hash generation ───────────────────────────────────────────────────────────

/**
 * Generates a deterministic SHA-256 hash from the image buffer + compression options.
 * Same image + same options → same hash → instant cache hit.
 */
export function generateHash(buffer: Buffer, options: CompressionOptions): string {
  const optionsStr = JSON.stringify({
    format: options.format,
    targetSizeKB: options.targetSizeKB,
    qualityStart: options.qualityStart,
    qualityMin: options.qualityMin,
    resize: options.resize,
    stripMetadata: options.stripMetadata,
  });
  return crypto
    .createHash("sha256")
    .update(buffer)
    .update(optionsStr)
    .digest("hex");
}

// ── Cache lookup ──────────────────────────────────────────────────────────────

export interface CacheEntry {
  url: string;
  filePath: string;
  ext: string;
}

/**
 * Scans the cache directory for `cache_<hash>.<ext>`.
 * Returns the cache entry if found, or null if it doesn't exist.
 */
export async function getCachedResult(hash: string): Promise<CacheEntry | null> {
  try {
    const entries = await fs.readdir(CACHE_DIR);
    const prefix = `cache_${hash}.`;
    const match = entries.find((e) => e.startsWith(prefix));
    if (!match) return null;
    return {
      url: `/generated/cache/${match}`,
      filePath: path.join(CACHE_DIR, match),
      ext: path.extname(match).slice(1),
    };
  } catch {
    return null; // cache dir doesn't exist yet
  }
}

/**
 * Copies a freshly-compressed file into the persistent cache directory.
 * Filename: cache_<hash>.<ext>
 */
export async function setCachedResult(
  hash: string,
  srcPath: string,
  ext: string
): Promise<CacheEntry> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const filename = `cache_${hash}.${ext}`;
  const destPath = path.join(CACHE_DIR, filename);
  await fs.copyFile(srcPath, destPath);
  return {
    url: `/generated/cache/${filename}`,
    filePath: destPath,
    ext,
  };
}
