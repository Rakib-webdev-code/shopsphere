export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export type RateLimiter = {
  check(key: string, now?: number): RateLimitResult;
  reset(): void;
};

type Bucket = {
  count: number;
  resetAt: number;
};

/**
 * Small fixed-window limiter for the assistant endpoint.
 *
 * This is intentionally in-process and best-effort: it protects a single
 * server instance from accidental loops and obvious abuse without adding a
 * dependency. A multi-instance deployment should use a shared store (for
 * example Redis) instead. It is not used for authorization.
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const limit = Math.max(1, Math.trunc(options.limit));
  const windowMs = Math.max(1_000, Math.trunc(options.windowMs));
  const maxKeys = Math.max(100, Math.trunc(options.maxKeys ?? 5_000));
  const buckets = new Map<string, Bucket>();
  let checks = 0;

  function prune(now: number) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }

    // Hard bound even when every bucket is still active. Losing the oldest
    // counters only makes the limiter more permissive; it can never grant
    // more access than the window allows per key.
    while (buckets.size > maxKeys) {
      const oldest = buckets.keys().next().value;

      if (oldest === undefined) {
        break;
      }

      buckets.delete(oldest);
    }
  }

  return {
    check(key, now = Date.now()) {
      checks += 1;

      if (checks % 1_000 === 0 || buckets.size > maxKeys) {
        prune(now);
      }

      const bucket = buckets.get(key);

      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return {
          allowed: true,
          remaining: limit - 1,
          retryAfterMs: 0,
        };
      }

      if (bucket.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterMs: Math.max(0, bucket.resetAt - now),
        };
      }

      bucket.count += 1;

      return {
        allowed: true,
        remaining: Math.max(0, limit - bucket.count),
        retryAfterMs: 0,
      };
    },

    reset() {
      buckets.clear();
      checks = 0;
    },
  };
}

// 20 questions per five minutes is enough for shopping use and limits accidental
// loops. Authenticated requests use the user id; anonymous requests use the
// client address supplied by the deployment proxy.
export const assistantRateLimiter = createRateLimiter({
  limit: 20,
  windowMs: 5 * 60_000,
});
