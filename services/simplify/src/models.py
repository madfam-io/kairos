"""Pydantic models for API request/response schemas."""

from pydantic import BaseModel, Field


class SimplifyRequest(BaseModel):
    """Request to simplify a Chinese sentence."""

    text: str = Field(..., min_length=1, max_length=1000, description="Chinese sentence to simplify")
    target_level: int = Field(3, ge=1, le=6, description="Target HSK level (1-6)")
    preserve_names: bool = Field(True, description="Preserve proper nouns")
    context: str | None = Field(None, max_length=500, description="Optional context for better simplification")


class SimplifyResponse(BaseModel):
    """Response containing simplified sentence."""

    original: str = Field(..., description="Original sentence")
    simplified: str = Field(..., description="Simplified sentence")
    target_level: int = Field(..., description="Target HSK level used")
    changes: list[dict] = Field(default_factory=list, description="List of word substitutions made")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score")
    cached: bool = Field(False, description="Whether result was from cache")
    tokens_used: int = Field(0, description="Number of tokens used")


class BatchSimplifyRequest(BaseModel):
    """Request to simplify multiple sentences."""

    sentences: list[str] = Field(..., min_length=1, max_length=50, description="Sentences to simplify")
    target_level: int = Field(3, ge=1, le=6, description="Target HSK level")
    preserve_names: bool = Field(True, description="Preserve proper nouns")


class BatchSimplifyResponse(BaseModel):
    """Response containing batch of simplified sentences."""

    results: list[SimplifyResponse] = Field(..., description="Simplified sentences")
    total_tokens: int = Field(0, description="Total tokens used")
    cache_hits: int = Field(0, description="Number of cache hits")


class QuotaResponse(BaseModel):
    """Response containing user's quota information."""

    tier: str = Field(..., description="User's subscription tier")
    used: int = Field(..., description="Sentences used this month")
    limit: int = Field(..., description="Monthly limit (-1 for unlimited)")
    remaining: int = Field(..., description="Remaining sentences")
    resets_at: str = Field(..., description="When quota resets (ISO datetime)")


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    version: str
    model_loaded: bool
    gpu_available: bool
