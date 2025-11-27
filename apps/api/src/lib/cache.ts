/**
 * Caching Layer
 *
 * Provides in-memory caching with optional Redis support.
 * Reduces database load for frequently accessed data.
 */

import { log } from './logger';
import { getEnv, features } from './env';

// =============================================================================
// Types
// =============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

interface CacheConfig {
  /** Default TTL in milliseconds */
  defaultTtl: number;
  /** Maximum number of entries */
  maxSize: number;
  /** Whether to use Redis if available */
  useRedis: boolean;
  /** Key prefix for namespacing */
  prefix: string;
}

// =============================================================================
// In-Memory Cache
// =============================================================================

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, evictions: 0 };
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      maxSize: 10000,
      useRedis: false,
      prefix: 'kairos:',
      ...config,
    };
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | undefined {
    const fullKey = this.config.prefix + key;
    const entry = this.store.get(fullKey) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(fullKey);
      this.stats.size--;
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    const fullKey = this.config.prefix + key;
    const ttl = ttlMs ?? this.config.defaultTtl;

    // Evict if at max size
    if (this.store.size >= this.config.maxSize && !this.store.has(fullKey)) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now(),
    };

    if (!this.store.has(fullKey)) {
      this.stats.size++;
    }

    this.store.set(fullKey, entry);
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    const fullKey = this.config.prefix + key;
    const deleted = this.store.delete(fullKey);
    if (deleted) {
      this.stats.size--;
    }
    return deleted;
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string): number {
    const fullPattern = this.config.prefix + pattern;
    const regex = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');
    let count = 0;

    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        count++;
        this.stats.size--;
      }
    }

    return count;
  }

  /**
   * Get or set a value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.store.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    };
  }

  /**
   * Evict oldest entries
   */
  private evictOldest(): void {
    let oldest: { key: string; createdAt: number } | null = null;

    for (const [key, entry] of this.store.entries()) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = { key, createdAt: entry.createdAt };
      }
    }

    if (oldest) {
      this.store.delete(oldest.key);
      this.stats.size--;
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        this.stats.size--;
        cleaned++;
      }
    }

    return cleaned;
  }
}

// =============================================================================
// Redis Cache (when available)
// =============================================================================

class RedisCache {
  private baseUrl: string;
  private token: string;
  private prefix: string;

  constructor(baseUrl: string, token: string, prefix: string = 'kairos:') {
    this.baseUrl = baseUrl;
    this.token = token;
    this.prefix = prefix;
  }

  private async execute<T>(command: string[]): Promise<T> {
    try {
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
    } catch (error) {
      log.error('Redis cache error', error as Error);
      throw error;
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.execute<string | null>(['GET', this.prefix + key]);
      if (!result) return undefined;
      return JSON.parse(result) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await this.execute([
        'SET',
        this.prefix + key,
        JSON.stringify(value),
        'EX',
        String(ttlSeconds),
      ]);
    } catch {
      // Silently fail - cache is optional
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.execute<number>(['DEL', this.prefix + key]);
      return result > 0;
    } catch {
      return false;
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }
}

// =============================================================================
// Cache Factory
// =============================================================================

let cacheInstance: MemoryCache | null = null;
let redisCacheInstance: RedisCache | null = null;

/**
 * Get the cache instance
 */
export function getCache(): MemoryCache {
  if (!cacheInstance) {
    cacheInstance = new MemoryCache({
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      maxSize: 10000,
      prefix: 'kairos:',
    });

    // Set up periodic cleanup
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        const cleaned = cacheInstance?.cleanup() ?? 0;
        if (cleaned > 0) {
          log.debug(`Cache cleanup: removed ${cleaned} expired entries`);
        }
      }, 60 * 1000); // Every minute
    }

    log.info('In-memory cache initialized');
  }

  return cacheInstance;
}

/**
 * Get Redis cache if available
 */
export function getRedisCache(): RedisCache | null {
  if (redisCacheInstance) return redisCacheInstance;

  if (features.hasRedis()) {
    const env = getEnv();
    redisCacheInstance = new RedisCache(
      env.UPSTASH_REDIS_REST_URL!,
      env.UPSTASH_REDIS_REST_TOKEN!,
      'kairos:cache:'
    );
    log.info('Redis cache initialized');
    return redisCacheInstance;
  }

  return null;
}

// =============================================================================
// Cache Keys
// =============================================================================

/**
 * Standardized cache key generators
 */
export const cacheKeys = {
  // User stats
  userStats: (userId: string) => `user:${userId}:stats`,
  userVocabularyCount: (userId: string) => `user:${userId}:vocab:count`,
  userVocabularyStats: (userId: string) => `user:${userId}:vocab:stats`,
  userDueCount: (userId: string) => `user:${userId}:vocab:due`,

  // Shared content
  sharedDeck: (deckId: string) => `deck:${deckId}`,
  sharedDeckPopular: () => 'decks:popular',

  // Organization
  organizationMembers: (orgId: string) => `org:${orgId}:members`,
  classroomStudents: (classroomId: string) => `classroom:${classroomId}:students`,

  // Onboarding
  userOnboarding: (userId: string) => `user:${userId}:onboarding`,
  assessmentQuestions: (difficulty: string) => `assessment:questions:${difficulty}`,

  // Review
  userReviewPreferences: (userId: string) => `user:${userId}:review:prefs`,
  userReviewStats: (userId: string) => `user:${userId}:review:stats`,
  reviewModes: () => 'review:modes',
  reviewCardTypes: () => 'review:cardTypes',

  // Gamification
  userXp: (userId: string) => `user:${userId}:xp`,
  userAchievements: (userId: string) => `user:${userId}:achievements`,
  userDailyGoals: (userId: string) => `user:${userId}:goals:daily`,
  achievementDefinitions: () => 'achievements:definitions',
  leaderboard: (type: string) => `leaderboard:${type}`,
  studyGroup: (groupId: string) => `group:${groupId}`,
  userStudyGroups: (userId: string) => `user:${userId}:groups`,

  // Progress
  userProgress: (userId: string) => `user:${userId}:progress`,
  userHskProgress: (userId: string) => `user:${userId}:hsk:progress`,
  userMilestones: (userId: string) => `user:${userId}:milestones`,
  userVelocity: (userId: string, days: number) => `user:${userId}:velocity:${days}`,

  // Discovery
  contentCatalog: (type?: string) => type ? `content:catalog:${type}` : 'content:catalog:all',
  contentTopics: () => 'content:topics',
  topicContent: (topicId: string) => `content:topic:${topicId}`,
  contentDetails: (contentId: string) => `content:${contentId}`,
  featuredContent: () => 'content:featured',
  userRecommendations: (userId: string) => `user:${userId}:recommendations`,
  userContentProgress: (userId: string) => `user:${userId}:content:progress`,
  contentComprehensibility: (userId: string, contentId: string) =>
    `user:${userId}:content:${contentId}:comprehensibility`,
};

/**
 * Cache TTL presets (in milliseconds)
 */
export const cacheTtl = {
  short: 30 * 1000, // 30 seconds
  medium: 5 * 60 * 1000, // 5 minutes
  long: 30 * 60 * 1000, // 30 minutes
  hour: 60 * 60 * 1000, // 1 hour
  day: 24 * 60 * 60 * 1000, // 24 hours
};

// =============================================================================
// Invalidation Helpers
// =============================================================================

/**
 * Invalidate all cache entries for a user
 */
export function invalidateUserCache(userId: string): void {
  const cache = getCache();
  cache.deletePattern(`user:${userId}:*`);

  const redis = getRedisCache();
  if (redis) {
    // Redis pattern deletion would require SCAN + DEL
    // For now, just delete known keys
    redis.delete(cacheKeys.userStats(userId));
    redis.delete(cacheKeys.userVocabularyCount(userId));
    redis.delete(cacheKeys.userVocabularyStats(userId));
    redis.delete(cacheKeys.userDueCount(userId));
  }
}

/**
 * Invalidate vocabulary-related cache for a user
 */
export function invalidateVocabularyCache(userId: string): void {
  const cache = getCache();
  cache.delete(cacheKeys.userVocabularyCount(userId));
  cache.delete(cacheKeys.userVocabularyStats(userId));
  cache.delete(cacheKeys.userDueCount(userId));
}

/**
 * Invalidate gamification cache for a user (after XP/achievement changes)
 */
export function invalidateGamificationCache(userId: string): void {
  const cache = getCache();
  cache.delete(cacheKeys.userXp(userId));
  cache.delete(cacheKeys.userAchievements(userId));
  cache.delete(cacheKeys.userDailyGoals(userId));
  cache.delete(cacheKeys.userProgress(userId));

  const redis = getRedisCache();
  if (redis) {
    redis.delete(cacheKeys.userXp(userId));
    redis.delete(cacheKeys.userAchievements(userId));
    redis.delete(cacheKeys.userDailyGoals(userId));
  }
}

/**
 * Invalidate leaderboard cache (after XP changes)
 */
export function invalidateLeaderboardCache(type?: string): void {
  const cache = getCache();
  if (type) {
    cache.delete(cacheKeys.leaderboard(type));
  } else {
    cache.deletePattern('leaderboard:*');
  }

  const redis = getRedisCache();
  if (redis && type) {
    redis.delete(cacheKeys.leaderboard(type));
  }
}

/**
 * Invalidate progress cache for a user
 */
export function invalidateProgressCache(userId: string): void {
  const cache = getCache();
  cache.delete(cacheKeys.userProgress(userId));
  cache.delete(cacheKeys.userHskProgress(userId));
  cache.delete(cacheKeys.userMilestones(userId));
  cache.deletePattern(`user:${userId}:velocity:*`);

  const redis = getRedisCache();
  if (redis) {
    redis.delete(cacheKeys.userProgress(userId));
    redis.delete(cacheKeys.userHskProgress(userId));
  }
}

/**
 * Invalidate review cache for a user
 */
export function invalidateReviewCache(userId: string): void {
  const cache = getCache();
  cache.delete(cacheKeys.userReviewPreferences(userId));
  cache.delete(cacheKeys.userReviewStats(userId));

  const redis = getRedisCache();
  if (redis) {
    redis.delete(cacheKeys.userReviewStats(userId));
  }
}

/**
 * Invalidate discovery/recommendation cache for a user
 */
export function invalidateDiscoveryCache(userId: string): void {
  const cache = getCache();
  cache.delete(cacheKeys.userRecommendations(userId));
  cache.delete(cacheKeys.userContentProgress(userId));
  cache.deletePattern(`user:${userId}:content:*`);

  const redis = getRedisCache();
  if (redis) {
    redis.delete(cacheKeys.userRecommendations(userId));
  }
}

export default {
  getCache,
  getRedisCache,
  cacheKeys,
  cacheTtl,
  invalidateUserCache,
  invalidateVocabularyCache,
  invalidateGamificationCache,
  invalidateLeaderboardCache,
  invalidateProgressCache,
  invalidateReviewCache,
  invalidateDiscoveryCache,
};
