/**
 * Redis Cache Service
 * Provides caching utilities for frequently accessed data
 */

import { log } from '../lib/logger';
import { getEnv, features } from '../lib/env';

interface CacheConfig {
  defaultTtlSeconds: number;
  keyPrefix: string;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTtlSeconds: 300, // 5 minutes
  keyPrefix: 'cache',
};

/**
 * Redis Cache Store using Upstash REST API
 */
class RedisCacheStore {
  private baseUrl: string;
  private token: string;
  private config: CacheConfig;

  constructor(baseUrl: string, token: string, config: Partial<CacheConfig> = {}) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async execute<T>(command: string[]): Promise<T> {
    const response = await fetch(this.baseUrl, {
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

  private buildKey(key: string): string {
    return `${this.config.keyPrefix}:${key}`;
  }

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.execute<string | null>(['GET', this.buildKey(key)]);
      if (!result) return null;
      return JSON.parse(result) as T;
    } catch (error) {
      log.error('Cache GET error', error as Error, { key });
      return null;
    }
  }

  /**
   * Set a cached value with TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const ttl = ttlSeconds ?? this.config.defaultTtlSeconds;
      await this.execute([
        'SET',
        this.buildKey(key),
        JSON.stringify(value),
        'EX',
        String(ttl),
      ]);
    } catch (error) {
      log.error('Cache SET error', error as Error, { key });
    }
  }

  /**
   * Delete a cached value
   */
  async delete(key: string): Promise<void> {
    try {
      await this.execute(['DEL', this.buildKey(key)]);
    } catch (error) {
      log.error('Cache DEL error', error as Error, { key });
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      // Get keys matching pattern
      const keys = await this.execute<string[]>(['KEYS', this.buildKey(pattern)]);
      if (keys && keys.length > 0) {
        await this.execute(['DEL', ...keys]);
      }
    } catch (error) {
      log.error('Cache DEL pattern error', error as Error, { pattern });
    }
  }

  /**
   * Get or set - returns cached value or computes and caches it
   */
  async getOrSet<T>(
    key: string,
    compute: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}

// In-memory cache as fallback
class MemoryCacheStore {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Cleanup expired entries periodically
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 60 * 1000);
    }
  }

  private buildKey(key: string): string {
    return `${this.config.keyPrefix}:${key}`;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(this.buildKey(key));
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(this.buildKey(key));
      return null;
    }

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.config.defaultTtlSeconds;
    this.store.set(this.buildKey(key), {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(this.buildKey(key));
  }

  async deletePattern(pattern: string): Promise<void> {
    const prefix = this.buildKey(pattern.replace('*', ''));
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  async getOrSet<T>(
    key: string,
    compute: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}

// Cache instances
let vocabularyCache: RedisCacheStore | MemoryCacheStore | null = null;
let statsCache: RedisCacheStore | MemoryCacheStore | null = null;

/**
 * Get vocabulary cache instance
 */
export function getVocabularyCache(): RedisCacheStore | MemoryCacheStore {
  if (vocabularyCache) return vocabularyCache;

  if (features.hasRedis()) {
    const env = getEnv();
    vocabularyCache = new RedisCacheStore(
      env.UPSTASH_REDIS_REST_URL!,
      env.UPSTASH_REDIS_REST_TOKEN!,
      { keyPrefix: 'vocab', defaultTtlSeconds: 300 }
    );
    log.info('Vocabulary cache using Redis');
  } else {
    vocabularyCache = new MemoryCacheStore({ keyPrefix: 'vocab', defaultTtlSeconds: 300 });
    log.info('Vocabulary cache using in-memory store');
  }

  return vocabularyCache;
}

/**
 * Get stats cache instance (longer TTL for aggregated data)
 */
export function getStatsCache(): RedisCacheStore | MemoryCacheStore {
  if (statsCache) return statsCache;

  if (features.hasRedis()) {
    const env = getEnv();
    statsCache = new RedisCacheStore(
      env.UPSTASH_REDIS_REST_URL!,
      env.UPSTASH_REDIS_REST_TOKEN!,
      { keyPrefix: 'stats', defaultTtlSeconds: 600 }
    );
    log.info('Stats cache using Redis');
  } else {
    statsCache = new MemoryCacheStore({ keyPrefix: 'stats', defaultTtlSeconds: 600 });
    log.info('Stats cache using in-memory store');
  }

  return statsCache;
}

/**
 * Cache key builders for common patterns
 */
export const cacheKeys = {
  vocabularyStats: (userId: string) => `user:${userId}:stats`,
  vocabularyList: (userId: string, status?: string, page?: number) =>
    `user:${userId}:list:${status ?? 'all'}:${page ?? 0}`,
  vocabularyDue: (userId: string) => `user:${userId}:due`,
  hskData: (level: number) => `hsk:${level}`,
};

/**
 * Invalidate all vocabulary cache for a user
 */
export async function invalidateUserVocabularyCache(userId: string): Promise<void> {
  const cache = getVocabularyCache();
  await cache.deletePattern(`user:${userId}:*`);
}
