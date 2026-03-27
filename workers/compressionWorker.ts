/**
 * BullMQ Compression Worker
 *
 * Run with: npm run worker
 * (i.e. tsx workers/compressionWorker.ts)
 *
 * This is a standalone Node.js process — separate from the Next.js server.
 * It consumes jobs from the "image-compression" queue, compresses images using
 * the same compressImage() function used in sync mode, then writes the result
 * to the Redis job store and copies it to the persistent cache directory.
 */

import os from "os";
import path from "path";
import sharp from "sharp";
import { Worker, type Job } from "bullmq";
import { getRedisConnection, QUEUE_NAME, type JobPayload, type JobResult } from "../lib/queue";
import { compressImage } from "../lib/compress";
import { getCachedResult, setCachedResult } from "../lib/hash";
import { maybeCleanup } from "../lib/cleanup";

// ── Sharp tuning ─────────────────────────────────────────────────────────────

sharp.concurrency(0); // use all available cores within each job
sharp.cache(false);   // disable sharp's internal tile cache

// ── Concurrency ───────────────────────────────────────────────────────────────

const CONCURRENCY = Math.min(os.cpus().length, 10);

// ── Worker ────────────────────────────────────────────────────────────────────

const worker = new Worker<JobPayload, JobResult>(
  QUEUE_NAME,
  async (job: Job<JobPayload>): Promise<JobResult> => {
    const { uploadId, originalName, options, hash } = job.data;

    // Run lazy cleanup (same as the API route does)
    await maybeCleanup().catch(() => {});

    // Double-check cache in case another worker already processed this hash
    const cached = await getCachedResult(hash);
    if (cached) {
      console.log(`[worker] Cache hit for job ${job.id} (hash: ${hash.slice(0, 8)}…)`);
      return {
        outputUrl: cached.url,
        outputName: path.basename(cached.filePath),
        originalSize: 0, // not stored in cache metadata
        compressedSize: 0,
        reductionPercent: 0,
        outputFormat: cached.ext,
        uploadId,
        formatOverridden: false,
        quality: 0,
        cachedUrl: cached.url,
      };
    }

    console.log(`[worker] Processing job ${job.id} (${originalName}) — ${options.format} @ ${options.targetSizeKB}KB`);

    // Read the preserved original from uploads/tmp
    const { UPLOADS_TMP_DIR } = await import("../lib/cleanup");
    const fs = await import("fs/promises");
    const uploadPath = path.join(UPLOADS_TMP_DIR, uploadId);
    const buffer = await fs.readFile(uploadPath);

    // Compress
    const result = await compressImage(buffer, originalName, options);

    // Write to persistent cache
    const ext = path.extname(result.outputName).slice(1);
    const cacheEntry = await setCachedResult(hash, result.outputPath, ext);

    console.log(
      `[worker] ✓ Job ${job.id} done — ${(result.compressedSize / 1024).toFixed(1)} KB ` +
      `(${result.reductionPercent}% reduction) → cached as ${path.basename(cacheEntry.filePath)}`
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
  console.error(`[worker] ❌ Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err.message);
});

console.log(
  `[worker] 🚀 Compression worker started (concurrency: ${CONCURRENCY}, queue: "${QUEUE_NAME}")`
);
console.log(`[worker] Waiting for jobs…`);

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[worker] SIGTERM received — draining…");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[worker] SIGINT received — draining…");
  await worker.close();
  process.exit(0);
});
