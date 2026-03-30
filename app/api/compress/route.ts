import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { compressImage, concurrentMap, DEFAULT_OPTIONS, withTimeout } from "@/lib/compress";
import { maybeCleanup, UPLOADS_TMP_DIR } from "@/lib/cleanup";
import { generateHash, getCachedResult, setCachedResult } from "@/lib/hash";
import { detectMimeType, ALLOWED_MIMES } from "@/lib/magicBytes";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  getQueue,
  isRedisAvailable,
  resetRedisCache,
  type JobPayload,
} from "@/lib/queue";
import type { CompressionOptions } from "@/lib/settings";
import { trackRequest, trackCompression, trackCacheHit, trackError } from "@/lib/analytics";
import fs from "fs/promises";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB per file
const MAX_FILES_PER_REQUEST = 20;             // max 20 files per batch
const MAX_QUEUE_SIZE = 1000;                  // reject if queue is overloaded
const COMPRESS_TIMEOUT_MS = 10_000;           // 10 s per file
const CONCURRENCY_LIMIT = Math.min(10, Math.max(1, os.cpus().length));

// ── Shared result shape ───────────────────────────────────────────────────────

interface FileResult {
  /** Set when the job was queued (async mode) */
  jobId?: string;
  /** Set when the result is immediately available (sync or cache hit) */
  outputUrl?: string;
  outputName?: string;
  originalSize?: number;
  compressedSize?: number;
  reductionPercent?: number;
  outputFormat?: string;
  uploadId?: string;
  formatOverridden?: boolean;
  quality?: number;
  /** True when this result came from the hash cache */
  cached?: boolean;
  originalName: string;
  error: string | null;
}

// ── POST /api/compress ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests. Max 30 compress requests per minute." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "30",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  trackRequest();

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await maybeCleanup();

  // ── Parse form data ────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (!files || files.length === 0) {
    return Response.json({ error: "No files uploaded" }, { status: 400 });
  }

  // ── File count guard ────────────────────────────────────────────────────────
  if (files.length > MAX_FILES_PER_REQUEST) {
    return Response.json(
      { error: `Too many files. Max ${MAX_FILES_PER_REQUEST} files per request.` },
      { status: 400 }
    );
  }

  // ── Parse options ──────────────────────────────────────────────────────────
  let options: CompressionOptions = DEFAULT_OPTIONS;
  const optionsRaw = formData.get("options");
  if (typeof optionsRaw === "string") {
    try {
      const parsed = JSON.parse(optionsRaw) as Partial<CompressionOptions>;
      options = {
        targetSizeKB: Number(parsed.targetSizeKB) || DEFAULT_OPTIONS.targetSizeKB,
        format: parsed.format ?? DEFAULT_OPTIONS.format,
        qualityStart: Number(parsed.qualityStart) || DEFAULT_OPTIONS.qualityStart,
        qualityMin: Number(parsed.qualityMin) || DEFAULT_OPTIONS.qualityMin,
        qualityStep: Number(parsed.qualityStep) || DEFAULT_OPTIONS.qualityStep,
        resize: parsed.resize ?? null,
        stripMetadata: parsed.stripMetadata ?? DEFAULT_OPTIONS.stripMetadata,
      };
    } catch {
      // Use defaults
    }
  }

  // ?sync=true or ?sync forces synchronous mode regardless of Redis availability
  const syncMode = request.nextUrl.searchParams.get("sync") !== null;

  // ── Check Redis + queue size ────────────────────────────────────────────────
  let useQueue = false;
  if (!syncMode) {
    const redisUp = await isRedisAvailable().catch(() => false);
    if (redisUp) {
      try {
        const queue = getQueue();
        const counts = await queue.getJobCounts("waiting", "active", "delayed");
        const queueSize = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
        if (queueSize <= MAX_QUEUE_SIZE) {
          useQueue = true;
        } else {
          console.warn(`[api/compress] Queue overloaded (${queueSize} jobs) — falling back to sync`);
        }
      } catch {
        // Queue check failed — fall back to sync
      }
    }
  }

  // ── Process each file ──────────────────────────────────────────────────────
  const results = await concurrentMap(files, CONCURRENCY_LIMIT, async (file): Promise<FileResult> => {
    // Size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        originalName: file.name,
        error: `File too large (max 20 MB): ${file.name}`,
      };
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return { originalName: file.name, error: "Failed to read file" };
    }

    // ── Magic bytes validation ──────────────────────────────────────────────
    const mime = detectMimeType(buffer);
    if (!mime || !ALLOWED_MIMES.has(mime)) {
      return {
        originalName: file.name,
        error: `Unsupported file type for "${file.name}". Accepted: JPEG, PNG, WebP, GIF, AVIF.`,
      };
    }

    // ── Hash & cache check ──────────────────────────────────────────────────
    const hash = generateHash(buffer, options);
    const cached = await getCachedResult(hash);
    if (cached) {
      // Instant cache hit — no compression needed
      const stat = await fs.stat(cached.filePath).catch(() => null);
      trackCacheHit(cached.ext);
      return {
        originalName: file.name,
        error: null,
        outputUrl: cached.url,
        outputName: path.basename(cached.filePath),
        originalSize: file.size,
        compressedSize: stat?.size ?? 0,
        reductionPercent: stat
          ? Math.max(0, Math.round(((file.size - stat.size) / file.size) * 100))
          : 0,
        outputFormat: cached.ext,
        cached: true,
      };
    }

    // ── Save original for worker / re-optimize ──────────────────────────────
    // (compressImage already saves to UPLOADS_TMP_DIR — only needed for queue mode)
    if (useQueue) {
      try {
        await fs.mkdir(UPLOADS_TMP_DIR, { recursive: true });
        // We'll let compressImage handle saving when in sync mode;
        // for queue mode we save manually so the worker can read it
        const { v4: uuidv4 } = await import("uuid");
        const rawExt = path.extname(file.name).toLowerCase();
        const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"].includes(rawExt)
          ? rawExt
          : ".bin";
        const uploadId = `${uuidv4()}_${Date.now()}${safeExt}`;
        const uploadPath = path.join(UPLOADS_TMP_DIR, uploadId);
        await fs.writeFile(uploadPath, buffer);

        // Verify file is on disk before handing the path to the worker.
        // fs.writeFile resolves only after the OS write, but an explicit
        // stat call also ensures the directory entry is visible to other
        // processes (relevant on network/virtual file systems).
        await fs.access(uploadPath).catch(() => {
          throw new Error(`File not saved properly before queuing: ${uploadPath}`);
        });

        const payload: JobPayload = {
          filePath: uploadPath, // absolute path — worker must use this
          uploadId,
          originalName: file.name,
          options,
          hash,
        };

        const queue = getQueue();
        const job = await queue.add("compress", payload).catch((err) => {
          // Redis failed mid-request — reset and fall through to sync
          resetRedisCache();
          throw err;
        });

        return {
          originalName: file.name,
          error: null,
          jobId: job.id,
        };
      } catch (err) {
        // Queue failed — fall through to sync processing
        console.warn("[api/compress] Queue enqueue failed, falling back to sync:", err);
      }
    }

    // ── Synchronous fallback ────────────────────────────────────────────────
    const fileStart = Date.now();
    try {
      const result = await withTimeout(
        compressImage(buffer, file.name, options),
        COMPRESS_TIMEOUT_MS,
        `compress:${file.name}`
      );

      const elapsed = Date.now() - fileStart;
      trackCompression(result.originalSize, result.compressedSize, elapsed, result.outputFormat);

      // structured logging
      console.log(
        `[api/compress] ${ip} | ${file.name} | ${(file.size / 1024).toFixed(1)}KB→` +
        `${(result.compressedSize / 1024).toFixed(1)}KB | ${result.outputFormat}` +
        ` q${result.quality} | ${elapsed}ms`
      );

      // Write result to cache
      const ext = path.extname(result.outputName).slice(1);
      const cacheEntry = await setCachedResult(hash, result.outputPath, ext).catch(() => null);

      return {
        originalName: file.name,
        error: null,
        outputUrl: cacheEntry?.url ?? result.outputUrl,
        outputName: result.outputName,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        reductionPercent: result.reductionPercent,
        outputFormat: result.outputFormat,
        uploadId: result.uploadId,
        formatOverridden: result.formatOverridden,
        quality: result.quality,
        cached: false,
      };
    } catch (err) {
      const isTimeout = err instanceof Error && err.message.startsWith("Timeout:");
      trackError();
      console.error(
        `[api/compress] ${ip} | ${file.name} | ${isTimeout ? "TIMEOUT" : "ERROR"}: ${(err as Error).message}`
      );
      return {
        originalName: file.name,
        error: isTimeout
          ? `Compression timed out for "${file.name}" — image may be too complex`
          : (err instanceof Error ? err.message : "Compression failed"),
      };
    }
  });

  return Response.json(
    { results },
    {
      headers: {
        "X-RateLimit-Limit": "30",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
      },
    }
  );
}
