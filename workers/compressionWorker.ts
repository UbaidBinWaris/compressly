/**
 * BullMQ Compression Worker
 *
 * Run with: npm run worker
 * (i.e. tsx workers/compressionWorker.ts)
 *
 * This is a standalone Node.js process — separate from the Next.js server.
 * It consumes jobs from the "image-compression" queue, compresses images using
 * the same compressImage() function, then writes the result to the Redis job
 * store and copies it to the persistent cache directory.
 *
 * ANALYTICS NOTE: lib/analytics is in-memory and process-local. Calling its
 * functions here would update this process's private store, not the one the
 * Next.js API reads. Analytics tracking for async jobs requires a shared
 * store (e.g. Redis) and is not yet implemented.
 */

import os from "node:os";
import path from "node:path";
import { promises as fsp } from "node:fs";
import sharp from "sharp";
import { Worker, type Job } from "bullmq";
import { getRedisConnection, QUEUE_NAME, type JobPayload, type JobResult } from "../lib/queue";
import { compressImage, withTimeout } from "../lib/compress";
import { getCachedResult, setCachedResult } from "../lib/hash";
import { maybeCleanup, UPLOADS_TMP_DIR } from "../lib/cleanup";

// ── Sharp tuning ─────────────────────────────────────────────────────────────

sharp.concurrency(0); // use all available cores within each job
sharp.cache(false);   // disable sharp's internal tile cache

// ── Concurrency ───────────────────────────────────────────────────────────────

const CONCURRENCY = Math.min(os.cpus().length, 10);

// ── Job config ────────────────────────────────────────────────────────────────

/** Hard wall-clock limit per job. BullMQ's own timeout kills the job at the
 *  queue level; this inner timeout gives us a clean error message first. */
const JOB_TIMEOUT_MS = 10_000;

// ── File-read retry config ────────────────────────────────────────────────────

const FILE_READ_RETRIES = 3;
const FILE_READ_RETRY_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Read the uploaded file with up to FILE_READ_RETRIES attempts.
 * Retries handle the edge case where a freshly-written file is not yet
 * visible to the worker process (network mounts, some container runtimes).
 */
async function readUploadWithRetry(filePath: string): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= FILE_READ_RETRIES; attempt++) {
    try {
      console.log(`[worker] Reading file (attempt ${attempt}/${FILE_READ_RETRIES}): ${filePath}`);
      return await fsp.readFile(filePath);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isNotFound = (err as NodeJS.ErrnoException).code === "ENOENT";
      if (isNotFound && attempt < FILE_READ_RETRIES) {
        console.warn(`[worker] File not found, retrying in ${FILE_READ_RETRY_DELAY_MS}ms… (${filePath})`);
        await sleep(FILE_READ_RETRY_DELAY_MS);
      } else {
        break; // non-ENOENT error or final attempt — give up
      }
    }
  }

  throw new Error(
    `File not found after ${FILE_READ_RETRIES} retries: ${filePath} — ${lastError?.message ?? "unknown error"}`
  );
}

// ── Worker ────────────────────────────────────────────────────────────────────

const worker = new Worker<JobPayload, JobResult>(
  QUEUE_NAME,
  async (job: Job<JobPayload>): Promise<JobResult> => {
    const { filePath, uploadId, originalName, options, hash } = job.data;
    const jobTag = `[worker] job ${job.id} (${originalName})`;

    // Ensure all working directories exist before any file I/O
    await maybeCleanup().catch(() => {});

    // ── Progress: 0% ─────────────────────────────────────────────────────────
    await job.updateProgress(0);

    // Double-check cache — another worker may have already processed this hash
    const cached = await getCachedResult(hash);
    if (cached) {
      console.log(`${jobTag} — cache hit (hash: ${hash.slice(0, 8)}…)`);
      await job.updateProgress(100);
      return {
        outputUrl: cached.url,
        outputName: path.basename(cached.filePath),
        originalSize: 0,
        compressedSize: 0,
        reductionPercent: 0,
        outputFormat: cached.ext,
        uploadId,
        formatOverridden: false,
        quality: 0,
        cachedUrl: cached.url,
      };
    }

    console.log(`${jobTag} — ${options.format} @ ${options.targetSizeKB}KB target`);

    // Resolve upload path: prefer the explicit absolute filePath set by the API
    // route; fall back to reconstructing from uploadId for backward compatibility.
    const resolvedPath = filePath ?? path.join(UPLOADS_TMP_DIR, uploadId);

    // ── Progress: 20% — about to read file ───────────────────────────────────
    await job.updateProgress(20);
    const buffer = await readUploadWithRetry(resolvedPath);

    // ── Progress: 50% — file read, compression starting ──────────────────────
    await job.updateProgress(50);

    let result: Awaited<ReturnType<typeof compressImage>>;
    try {
      result = await withTimeout(
        compressImage(buffer, originalName, options),
        JOB_TIMEOUT_MS,
        `compress:${originalName}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${jobTag} — compression failed: ${msg} | filePath: ${resolvedPath}`);
      throw err; // BullMQ will mark the job as failed and apply retry/backoff
    }

    // ── Progress: 80% — compression done, writing cache ──────────────────────
    await job.updateProgress(80);

    const ext = path.extname(result.outputName).slice(1);
    const cacheEntry = await setCachedResult(hash, result.outputPath, ext);

    // ── Progress: 100% ────────────────────────────────────────────────────────
    await job.updateProgress(100);

    console.log(
      `${jobTag} — ✓ done ${(result.compressedSize / 1024).toFixed(1)} KB ` +
      `(${result.reductionPercent}% reduction) q${result.quality} ` +
      `→ cache: ${path.basename(cacheEntry.filePath)}`
    );

    return {
      outputUrl: result.outputUrl,
      outputName: result.outputName,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      reductionPercent: result.reductionPercent,
      outputFormat: result.outputFormat,
      uploadId: result.uploadId,
      formatOverridden: result.formatOverridden,
      quality: result.quality,
      cachedUrl: cacheEntry.url,
    };
  },
  {
    connection: getRedisConnection(),
    concurrency: CONCURRENCY,
  }
);

// ── Event handlers ────────────────────────────────────────────────────────────

worker.on("completed", (job) => {
  console.log(`[worker] ✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] ❌ Job ${job?.id} failed: ${err.message}`);
});

worker.on("error", (err) => {
  console.error(`[worker] Worker error: ${err.message}`);
});

console.log(
  `[worker] 🚀 Started (concurrency: ${CONCURRENCY}, queue: "${QUEUE_NAME}", timeout: ${JOB_TIMEOUT_MS}ms)`
);
console.log(`[worker] Waiting for jobs…`);

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received — draining…`);
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
