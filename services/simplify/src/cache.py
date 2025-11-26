"""Caching layer for simplification results."""

import hashlib
import json
from typing import Any

import structlog

logger = structlog.get_logger()


def generate_cache_key(text: str, target_level: int, preserve_names: bool = True) -> str:
    """Generate a cache key for a simplification request."""
    key_data = f"{text}:{target_level}:{preserve_names}"
    return f"simplify:{hashlib.sha256(key_data.encode()).hexdigest()[:16]}"


class SimplifyCache:
    """Cache for simplification results using Redis."""

    def __init__(self, redis_url: str | None = None, ttl: int = 86400 * 7):
        self.ttl = ttl
        self._redis = None
        self._redis_url = redis_url

    async def _get_redis(self):
        """Lazy initialization of Redis connection."""
        if self._redis is None and self._redis_url:
            try:
                import redis.asyncio as redis
                self._redis = redis.from_url(self._redis_url)
            except Exception as e:
                logger.warning("Failed to connect to Redis", error=str(e))
        return self._redis

    async def get(self, key: str) -> dict | None:
        """Get a cached result."""
        redis = await self._get_redis()
        if not redis:
            return None

        try:
            data = await redis.get(key)
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning("Cache get failed", key=key, error=str(e))

        return None

    async def set(self, key: str, value: dict) -> bool:
        """Set a cached result."""
        redis = await self._get_redis()
        if not redis:
            return False

        try:
            await redis.setex(key, self.ttl, json.dumps(value))
            return True
        except Exception as e:
            logger.warning("Cache set failed", key=key, error=str(e))
            return False

    async def get_or_compute(
        self,
        text: str,
        target_level: int,
        preserve_names: bool,
        compute_fn,
    ) -> tuple[dict, bool]:
        """Get from cache or compute and cache the result."""
        key = generate_cache_key(text, target_level, preserve_names)

        # Try cache first
        cached = await self.get(key)
        if cached:
            return cached, True

        # Compute result
        result = await compute_fn()

        # Cache the result
        await self.set(key, result)

        return result, False

    async def close(self):
        """Close the Redis connection."""
        if self._redis:
            await self._redis.close()


# In-memory cache fallback when Redis is not available
class InMemoryCache:
    """Simple in-memory cache with LRU eviction."""

    def __init__(self, max_size: int = 10000, ttl: int = 86400):
        self._cache: dict[str, tuple[dict, float]] = {}
        self._max_size = max_size
        self._ttl = ttl

    async def get(self, key: str) -> dict | None:
        import time

        if key in self._cache:
            value, timestamp = self._cache[key]
            if time.time() - timestamp < self._ttl:
                return value
            else:
                del self._cache[key]
        return None

    async def set(self, key: str, value: dict) -> bool:
        import time

        # Evict oldest entries if cache is full
        if len(self._cache) >= self._max_size:
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][1])
            del self._cache[oldest_key]

        self._cache[key] = (value, time.time())
        return True

    async def get_or_compute(
        self,
        text: str,
        target_level: int,
        preserve_names: bool,
        compute_fn,
    ) -> tuple[dict, bool]:
        key = generate_cache_key(text, target_level, preserve_names)

        cached = await self.get(key)
        if cached:
            return cached, True

        result = await compute_fn()
        await self.set(key, result)

        return result, False

    async def close(self):
        pass


def create_cache(redis_url: str | None = None, ttl: int = 86400 * 7):
    """Create the appropriate cache implementation."""
    if redis_url:
        return SimplifyCache(redis_url, ttl)
    return InMemoryCache(ttl=ttl)
