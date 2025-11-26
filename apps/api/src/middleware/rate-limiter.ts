import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
};

// In-memory store for development (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(config: Partial<RateLimitConfig> = {}): MiddlewareHandler<AppEnv> {
  const { windowMs, maxRequests } = { ...DEFAULT_CONFIG, ...config };

  return async (c, next) => {
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
    const key = `rate-limit:${ip}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, record);
    }

    record.count++;

    const remaining = Math.max(0, maxRequests - record.count);
    const resetAt = new Date(record.resetAt);

    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', resetAt.toISOString());

    if (record.count > maxRequests) {
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
            },
          },
        },
        429
      );
    }

    await next();
  };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);
