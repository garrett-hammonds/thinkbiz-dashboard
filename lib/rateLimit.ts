import 'server-only';
import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Sliding-window rate limiting for the public, unauthenticated endpoints
// (visitor check-in, membership application). These insert rows and trigger
// outbound email / director notifications with no login, so without a limiter
// they're an email-bombing / junk-row / notification-spam vector.
//
// Backed by Upstash Redis / Vercel KV. Configured via UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN. When those aren't set (local dev, or before the KV
// store is provisioned) the limiter is DISABLED and every call is allowed —
// deliberately fail-open so a missing store never blocks legitimate check-ins.
// In production, set the env vars so the limiter is active.

let redis: Redis | null | undefined;
const limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn(
      '[rateLimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set — rate limiting disabled.',
    );
    redis = null;
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}

function getLimiter(limit: number, window: Duration): Ratelimit | null {
  const client = getRedis();
  if (!client) return null;
  const cacheKey = `${limit}:${window}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: 'thinkbiz:rl',
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

// Returns { ok: false } when the caller has exceeded `limit` requests within
// `window` for the given key. Fails open (returns ok) when unconfigured or on
// any limiter error, so the store is never a single point of failure for a
// legitimate submission.
export async function checkRateLimit(
  key: string,
  limit: number,
  window: Duration,
): Promise<{ ok: boolean }> {
  const limiter = getLimiter(limit, window);
  if (!limiter) return { ok: true };
  try {
    const { success } = await limiter.limit(key);
    return { ok: success };
  } catch (err) {
    console.error('[rateLimit] limiter error, failing open:', err);
    return { ok: true };
  }
}
