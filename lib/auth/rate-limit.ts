import { Errors } from '@/lib/http';

/**
 * In-memory rate limiter.
 * ---------------------------------------------------------------------------
 * Protects authentication and other abuse-prone endpoints.
 *
 * Note: counters live in the Node process. On a multi-instance/serverless
 * deployment, register a shared limiter (Redis/Upstash/KV) by replacing
 * `consume()` — the call sites do not need to change.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function consume(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

export function reset(key: string): void {
  buckets.delete(key);
}

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

/**
 * Standard policies used across the API.
 *
 * The login/register ceilings can be tuned through the environment
 * (LOGIN_RATE_LIMIT, REGISTER_RATE_LIMIT) — useful for load testing and for
 * deployments behind a proxy that shares one source IP.
 */
export const LIMITS = {
  login: { limit: envInt('LOGIN_RATE_LIMIT', 8), windowMs: 15 * 60_000 },
  register: { limit: envInt('REGISTER_RATE_LIMIT', 5), windowMs: 60 * 60_000 },
  upload: { limit: 12, windowMs: 10 * 60_000 },
  prediction: { limit: 20, windowMs: 5 * 60_000 },
  adminAction: { limit: 120, windowMs: 5 * 60_000 },
  api: { limit: 240, windowMs: 5 * 60_000 },
} as const;

export function guardRate(key: string, policy: { limit: number; windowMs: number }): void {
  const result = consume(key, policy.limit, policy.windowMs);
  if (!result.allowed) {
    throw Errors.tooMany(
      `Too many attempts. Try again in ${result.retryAfterSeconds} second${
        result.retryAfterSeconds === 1 ? '' : 's'
      }.`,
    );
  }
}
