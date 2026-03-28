/**
 * In-memory analytics store.
 *
 * Process-local — resets on server restart, not shared across multiple instances.
 * Tracks per-minute time-series in a circular buffer (60 buckets = 60 minutes).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

const BUCKET_MS = 60_000;  // 1 minute per bucket
const MAX_BUCKETS = 60;    // 60 minutes of history

interface TimeBucket {
  ts: number;          // start of this minute (epoch ms, floored to minute)
  requests: number;
  images: number;
  bytesSaved: number;
  compressionMs: number;
  compressions: number;
}

interface AnalyticsStore {
  totalImagesProcessed: number;
  totalBytesSaved: number;
  totalRequests: number;
  totalCompressionMs: number;
  totalCompressions: number;
  cacheHits: number;
  errors: number;
  formatCounts: Record<string, number>;
  buckets: TimeBucket[];
  startedAt: number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const store: AnalyticsStore = {
  totalImagesProcessed: 0,
  totalBytesSaved: 0,
  totalRequests: 0,
  totalCompressionMs: 0,
  totalCompressions: 0,
  cacheHits: 0,
  errors: 0,
  formatCounts: {},
  buckets: [],
  startedAt: Date.now(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentBucket(): TimeBucket {
  const ts = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
  const last = store.buckets[store.buckets.length - 1];
  if (last?.ts === ts) return last;

  const bucket: TimeBucket = { ts, requests: 0, images: 0, bytesSaved: 0, compressionMs: 0, compressions: 0 };
  store.buckets.push(bucket);
  if (store.buckets.length > MAX_BUCKETS) {
    store.buckets.splice(0, store.buckets.length - MAX_BUCKETS);
  }
  return bucket;
}

/** Fill in zero-value buckets for the last `count` minutes so charts have no gaps. */
function buildTimeline(count = 30): TimelinePoint[] {
  const now = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
  const points: TimelinePoint[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const ts = now - i * BUCKET_MS;
    const b = store.buckets.find((bkt) => bkt.ts === ts);
    const date = new Date(ts);
    const label = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    points.push({
      ts,
      label,
      requests: b?.requests ?? 0,
      images: b?.images ?? 0,
      bytesSaved: b?.bytesSaved ?? 0,
    });
  }
  return points;
}

// ── Public tracking API ───────────────────────────────────────────────────────

/** Call once per POST /api/compress request (before processing). */
export function trackRequest(): void {
  store.totalRequests++;
  currentBucket().requests++;
}

/**
 * Call after a successful sync compression.
 * @param originalSize  bytes of the input buffer
 * @param compressedSize  bytes of the output file
 * @param durationMs  wall-clock time of the compression call
 * @param format  output format string (webp | avif | jpeg | png)
 */
export function trackCompression(
  originalSize: number,
  compressedSize: number,
  durationMs: number,
  format: string
): void {
  const saved = Math.max(0, originalSize - compressedSize);
  store.totalImagesProcessed++;
  store.totalBytesSaved += saved;
  store.totalCompressionMs += durationMs;
  store.totalCompressions++;
  store.formatCounts[format] = (store.formatCounts[format] ?? 0) + 1;

  const b = currentBucket();
  b.images++;
  b.bytesSaved += saved;
  b.compressionMs += durationMs;
  b.compressions++;
}

/**
 * Call when a hash-cache hit is returned without compression.
 * @param format  file extension stored in the cache entry (webp | avif | …)
 */
export function trackCacheHit(format?: string): void {
  store.cacheHits++;
  store.totalImagesProcessed++;
  if (format) {
    store.formatCounts[format] = (store.formatCounts[format] ?? 0) + 1;
  }
  currentBucket().images++;
}

/** Call when a per-file error is returned. */
export function trackError(): void {
  store.errors++;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export interface TimelinePoint {
  ts: number;
  label: string;
  requests: number;
  images: number;
  bytesSaved: number;
}

export interface AnalyticsSnapshot {
  totalImagesProcessed: number;
  totalBytesSaved: number;
  totalRequests: number;
  /** Average ms per image (sync compressions only — queue mode excluded) */
  avgCompressionMs: number;
  /** Percentage of images served from hash cache (0–100) */
  cacheHitRate: number;
  /** Percentage of requests that returned at least one per-file error */
  errorRate: number;
  formatCounts: Record<string, number>;
  /** Last 30 one-minute buckets, zero-filled for gaps */
  timeline: TimelinePoint[];
  startedAt: number;
}

export function getSnapshot(): AnalyticsSnapshot {
  const {
    totalImagesProcessed, totalBytesSaved, totalRequests,
    totalCompressionMs, totalCompressions, cacheHits, errors,
    formatCounts, startedAt,
  } = store;

  return {
    totalImagesProcessed,
    totalBytesSaved,
    totalRequests,
    avgCompressionMs: totalCompressions > 0
      ? Math.round(totalCompressionMs / totalCompressions)
      : 0,
    cacheHitRate: totalImagesProcessed > 0
      ? Math.round((cacheHits / totalImagesProcessed) * 100)
      : 0,
    errorRate: totalRequests > 0
      ? Math.round((errors / totalRequests) * 100)
      : 0,
    formatCounts,
    timeline: buildTimeline(30),
    startedAt,
  };
}
