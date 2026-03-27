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
 * Call at the start of every compress / reoptimize request.
 * Runs a full cleanup pass at most once every CLEANUP_INTERVAL_MS.
 * Cache directory is intentionally excluded — it is persistent.
 */
export async function maybeCleanup(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupMs < CLEANUP_INTERVAL_MS) return;
  lastCleanupMs = now;

  // Ensure all directories exist
  await Promise.allSettled([
    fs.mkdir(UPLOADS_TMP_DIR, { recursive: true }),
    fs.mkdir(GENERATED_DIR, { recursive: true }),
    fs.mkdir(CACHE_DIR, { recursive: true }),
  ]);

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
