"""Configuration settings for the simplification service."""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = False

    # Model
    model_name: str = "Qwen/Qwen2.5-7B-Instruct"
    model_revision: str = "main"
    max_tokens: int = 512
    temperature: float = 0.3
    top_p: float = 0.9

    # Cache
    redis_url: str | None = None
    cache_ttl: int = 86400 * 7  # 7 days

    # Rate limiting
    rate_limit_requests: int = 50
    rate_limit_window: int = 60  # seconds

    # Quotas (per tier per month)
    free_tier_quota: int = 0
    learner_tier_quota: int = 500
    immersion_tier_quota: int = -1  # unlimited

    model_config = {"env_prefix": "SIMPLIFY_", "env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
