import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { log } from '../lib/logger';
import { getEnv, features } from '../lib/env';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyPrefix: 'rl',
};

// In-memory store as fallback
const memoryStore = new Map<string, RateLimitRecord>();

/**
 * Redis-based rate limit store using Upstash REST API
 */
class RedisRateLimitStore {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async execute<T>(command: string[]): Promise<T> {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`Redis error: ${response.status}`);
    }

    const data = await response.json();
    return data.result as T;
  }

  async get(key: string): Promise<RateLimitRecord | null> {
    try {
      const result = await this.execute<string | null>(['GET', key]);
      if (!result) return null;
      return JSON.parse(result);
    } catch (error) {
      log.error('Redis GET error', error as Error, { key });
      return null;
    }
  }

  async set(key: string, record: RateLimitRecord, ttlMs: number): Promise<void> {
    try {
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await this.execute(['SET', key, JSON.stringify(record), 'EX', String(ttlSeconds)]);
    } catch (error) {
      log.error('Redis SET error', error as Error, { key });
    }
  }

  async increment(key: string, windowMs: number): Promise<RateLimitRecord> {
    try {
      // Use INCR with GET for atomic increment
      const now = Date.now();
      const ttlSeconds = Math.ceil(windowMs / 1000);

      // Try to get existing record
      const existing = await this.get(key);

      if (existing && now < existing.resetAt) {
        // Increment existing
        existing.count++;
        await this.set(key, existing, existing.resetAt - now);
        return existing;
      }

      // Create new record
      const record: RateLimitRecord = {
        count: 1,
        resetAt: now + windowMs,
      };
      await this.set(key, record, windowMs);
      return record;
    } catch (error) {
      log.error('Redis increment error', error as Error, { key });
      // Fallback to permissive on Redis error
      return { count: 1, resetAt: Date.now() + windowMs };
    }
  }
}

let redisStore: RedisRateLimitStore | null = null;

/**
 * Get or initialize Redis store
 */
function getRedisStore(): RedisRateLimitStore | null {
  if (redisStore) return redisStore;

  if (features.hasRedis()) {
    const env = getEnv();
    redisStore = new RedisRateLimitStore(
      env.UPSTASH_REDIS_REST_URL!,
      env.UPSTASH_REDIS_REST_TOKEN!
    );
    log.info('Rate limiter using Redis (Upstash)');
    return redisStore;
  }

  log.warn('Rate limiter using in-memory store (not recommended for production)');
  return null;
}

/**
 * Rate limiter middleware
 * Uses Redis in production, in-memory for development
 */
export function rateLimiter(config: Partial<RateLimitConfig> = {}): MiddlewareHandler<AppEnv> {
  const { windowMs, maxRequests, keyPrefix } = { ...DEFAULT_CONFIG, ...config };

  return async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
      c.req.header('x-real-ip') ??
      'unknown';

    const path = c.req.path;
    const key = `${keyPrefix}:${ip}:${path}`;
    const now = Date.now();

    let record: RateLimitRecord;
    const redis = getRedisStore();

    if (redis) {
      // Use Redis
      record = await redis.increment(key, windowMs);
    } else {
      // Use in-memory fallback
      let existing = memoryStore.get(key);

      if (!existing || now > existing.resetAt) {
        existing = { count: 0, resetAt: now + windowMs };
        memoryStore.set(key, existing);
      }

      existing.count++;
      record = existing;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    const resetAt = new Date(record.resetAt);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', resetAt.toISOString());

    if (record.count > maxRequests) {
      log.rateLimited(ip, path);

      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please try again later',
          },
          meta: {
            rateLimit: {
              limit: maxRequests,
              remaining: 0,
              resetAt,
              retryAfter: Math.ceil((record.resetAt - now) / 1000),
            },
          },
        },
        429
      );
    }

    await next();
  };
}

/**
 * Stricter rate limiter for sensitive endpoints (auth, payments)
 */
export function strictRateLimiter(): MiddlewareHandler<AppEnv> {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyPrefix: 'rl:strict',
  });
}

/**
 * Rate limiter for API endpoints (for external developers)
 */
export function apiRateLimiter(): MiddlewareHandler<AppEnv> {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    keyPrefix: 'rl:api',
  });
}

/**
 * Rate limiter for leaderboard endpoints (prevent abuse)
 */
export function leaderboardRateLimiter(): MiddlewareHandler<AppEnv> {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyPrefix: 'rl:leaderboard',
  });
}

/**
 * Rate limiter for search/discovery endpoints
 */
export function searchRateLimiter(): MiddlewareHandler<AppEnv> {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 40,
    keyPrefix: 'rl:search',
  });
}

/**
 * Rate limiter for social features (follow, like, etc.)
 */
export function socialRateLimiter(): MiddlewareHandler<AppEnv> {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
    keyPrefix: 'rl:social',
  });
}

/**
 * Rate limiter for review sessions (generous but protected)
 */
export function reviewRateLimiter(): MiddlewareHandler<AppEnv> {
  return rateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120, // Higher for rapid card responses
    keyPrefix: 'rl:review',
  });
}

// Cleanup old entries from memory store periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (now > record.resetAt) {
        memoryStore.delete(key);
      }
    }
  }, 60 * 1000);
}
