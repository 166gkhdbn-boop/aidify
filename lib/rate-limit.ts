/**
 * In-memory token-bucket rate limiter, keyed per IP + route.
 *
 * LIMITS OF THIS IMPLEMENTATION (read before relying on it):
 * - Single-instance only: state lives in this process. On multi-instance
 *   deployments (e.g. Vercel with many lambdas) each instance gets its own
 *   bucket, so a distributed attacker can exceed the limit ~N times.
 *   For production hardening, swap the Map for a shared store (Upstash
 *   Redis / Supabase table) behind the same `checkRateLimit` signature.
 * - Memory is bounded by a simple LRU eviction (max 10k buckets).
 * - Not suitable for DDoS protection — use edge/CDN controls for that.
 *
 * Behavior: `checkRateLimit` returns { allowed, retryAfterMs }. When not
 * allowed, callers should return HTTP 429 with a Retry-After header.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const MAX_BUCKETS = 10_000;

const buckets = new Map<string, Bucket>();

function evictIfNeeded(): void {
  if (buckets.size <= MAX_BUCKETS) return;
  // Map preserves insertion order — delete the oldest entries.
  const overflow = buckets.size - MAX_BUCKETS;
  let removed = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

export interface RateLimitConfig {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Tokens remaining after this request (0 when denied). */
  remaining: number;
  /** ms until the next token becomes available (0 when allowed). */
  retryAfterMs: number;
  /** The bucket key that was checked (useful for logging). */
  key: string;
}

const DEFAULT_CONFIG: RateLimitConfig = { limit: 60, windowMs: 60_000 };

/** Presets for common cases. */
export const RateLimitPresets = {
  /** Auth endpoints: 10 attempts / minute. */
  auth: { limit: 10, windowMs: 60_000 } satisfies RateLimitConfig,
  /** Writes: 30 / minute. */
  write: { limit: 30, windowMs: 60_000 } satisfies RateLimitConfig,
  /** Reads: 120 / minute. */
  read: { limit: 120, windowMs: 60_000 } satisfies RateLimitConfig,
} as const;

/**
 * Extract a best-effort client IP from request headers. Trusts x-forwarded-for
 * (set by Vercel/CDN/proxy). For direct-IP deployments this is the socket IP.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): RateLimitResult {
  const now = Date.now();
  const refillRatePerMs = config.limit / config.windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.limit, lastRefill: now };
    evictIfNeeded();
    buckets.set(key, bucket);
  } else {
    // Refresh the bucket object on access so eviction order stays sane.
    buckets.delete(key);
    buckets.set(key, bucket);
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(
      config.limit,
      bucket.tokens + elapsed * refillRatePerMs,
    );
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs: 0,
      key,
    };
  }

  const retryAfterMs = Math.ceil((1 - bucket.tokens) / refillRatePerMs);
  return { allowed: false, remaining: 0, retryAfterMs, key };
}

/** Convenience wrapper: per-IP + route key from a Request. */
export function checkRateLimitForRequest(
  request: Request,
  route: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): RateLimitResult {
  return checkRateLimit(`${getClientIp(request)}:${route}`, config);
}

/** Reset all buckets (tests). */
export function resetRateLimits(): void {
  buckets.clear();
}
