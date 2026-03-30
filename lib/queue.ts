import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import type { CompressionOptions } from "./settings";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobPayload {
  /** Absolute path to the saved upload file — primary source of truth. */
  filePath: string;
  /** Filename within UPLOADS_TMP_DIR — kept for backward compatibility. */
  uploadId: string;
  originalName: string;
  options: CompressionOptions;
  hash: string;
}

export interface JobResult {
  outputUrl: string;
  outputName: string;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
  outputFormat: string;
  uploadId: string;
  formatOverridden: boolean;
  quality: number;
  cachedUrl?: string; // set when result was written to cache
}

// ── Redis connection ──────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let _connection: IORedis | null = null;
let _available: boolean | null = null;

export function getRedisConnection(): IORedis {
  if (!_connection) {
    _connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return _connection;
}

/**
 * Checks if Redis is reachable. Returns false gracefully so the app can
 * fall back to synchronous processing when Redis is not running.
 */
export async function isRedisAvailable(): Promise<boolean> {
  if (_available !== null) return _available;
  try {
    const conn = getRedisConnection();
    await conn.connect().catch(() => {});
    await conn.ping();
    _available = true;
  } catch {
    _available = false;
  }
  return _available;
}

// Reset cached availability (called after connection errors so we re-check next time)
export function resetRedisCache(): void {
  _available = null;
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export const QUEUE_NAME = "image-compression";

let _queue: Queue<JobPayload, JobResult> | null = null;

export function getQueue(): Queue<JobPayload, JobResult> {
  if (!_queue) {
    _queue = new Queue<JobPayload, JobResult>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: { age: 7200 }, // keep completed jobs 2 hours
        removeOnFail: { age: 7200 },
        attempts: 2,
        backoff: { type: "exponential", delay: 1000 },
      },
    });
  }
  return _queue;
}

let _queueEvents: QueueEvents | null = null;

export function getQueueEvents(): QueueEvents {
  if (!_queueEvents) {
    _queueEvents = new QueueEvents(QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return _queueEvents;
}
