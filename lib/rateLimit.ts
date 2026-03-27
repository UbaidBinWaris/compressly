/**
 * Simple in-memory rate limiter.
 * 30 compress requests per minute per IP address.
 * Resets automatically; no external dependencies.
 */

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;

const buckets = new Map<string, Bucket>();

// Periodically prune expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}, 5 * 60_000).unref(); // .unref() so it doesn't keep the process alive

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check and increment the rate limit counter for the given identifier (IP).
 * Returns whether the request is allowed and how many requests remain.
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    // New window
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }

  const allowed = bucket.count < MAX_REQUESTS;
  if (allowed) bucket.count++;

  return {
    allowed,
    remaining: Math.max(0, MAX_REQUESTS - bucket.count),
    resetAt: bucket.resetAt,
  };
}
