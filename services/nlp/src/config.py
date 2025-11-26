"""Configuration settings for the NLP service."""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1
    debug: bool = False

    # Paths
    cedict_path: str = "data/cedict_ts.u8"
    hsk_path: str = "data/hsk.json"

    # Cache
    redis_url: str | None = None
    cache_ttl: int = 86400  # 24 hours

    # Rate limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # seconds

    # Model settings
    lac_mode: str = "lac"  # "lac" for full, "seg" for segmentation only

    model_config = {"env_prefix": "NLP_", "env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
