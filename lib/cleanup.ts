import fs from "fs/promises";
import path from "path";
import { CACHE_DIR } from "./hash";

// ── Canonical directory paths (single source of truth for the whole app) ────
export const UPLOADS_TMP_DIR = path.join(process.cwd(), "public", "uploads", "tmp");
export const GENERATED_DIR = path.join(process.cwd(), "public", "generated", "tmp");

// Re-export so consumers can import CACHE_DIR from either module
export { CACHE_DIR };

const FILE_TTL_MS = 60 * 60 * 1000;        // delete files older than 1 hour
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // run at most once every 10 minutes

// Module-level timestamp — persists across requests within the same Node process.
let lastCleanupMs = 0;

/**
 * Ensure all working directories exist.
 * Called unconditionally — cheap because mkdir with recursive:true is a no-op
 * when the directory already exists.
 */
export async function ensureDirectories(): Promise<void> {
  await Promise.allSettled([
    fs.mkdir(UPLOADS_TMP_DIR, { recursive: true }),
    fs.mkdir(GENERATED_DIR, { recursive: true }),
    fs.mkdir(CACHE_DIR, { recursive: true }),
  ]);
}

/**
 * Call at the start of every compress / reoptimize request.
 * Always ensures directories exist, then runs a full cleanup pass at most
 * once every CLEANUP_INTERVAL_MS.
 * Cache directory is intentionally excluded — it is persistent.
 */
export async function maybeCleanup(): Promise<void> {
  // Always create directories — this is fast and must not be throttled,
  // because the worker is a separate process and may start before the
  // API route has had a chance to create them.
  await ensureDirectories();

  const now = Date.now();
  if (now - lastCleanupMs < CLEANUP_INTERVAL_MS) return;
  lastCleanupMs = now;

  // Only clean tmp dirs — cache is persistent
  await Promise.allSettled([
    cleanDir(GENERATED_DIR),
    cleanDir(UPLOADS_TMP_DIR),
  ]);
}

async function cleanDir(dir: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return; // directory doesn't exist yet — nothing to clean
  }

  const now = Date.now();

  await Promise.allSettled(
    entries.map(async (entry) => {
      if (entry === ".gitkeep") return;
      const fullPath = path.join(dir, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (now - stat.mtimeMs > FILE_TTL_MS) {
          await fs.unlink(fullPath);
        }
      } catch {
        // File already gone — fine to ignore
      }
    })
  );
}
