"""Pydantic models for API request/response schemas."""

from pydantic import BaseModel, Field


class WordSegment(BaseModel):
    """A single segmented word with analysis."""

    text: str = Field(..., description="The segmented word")
    pinyin: str | None = Field(None, description="Pinyin pronunciation")
    tone_marks: str | None = Field(None, description="Pinyin with tone marks")
    definitions: list[str] = Field(default_factory=list, description="English definitions")
    hsk_level: int | None = Field(None, ge=1, le=6, description="HSK level (1-6)")
    pos: str | None = Field(None, description="Part of speech tag")
    is_punctuation: bool = Field(False, description="Whether this is punctuation")


class SegmentRequest(BaseModel):
    """Request to segment Chinese text."""

    text: str = Field(..., min_length=1, max_length=5000, description="Chinese text to segment")
    include_pinyin: bool = Field(True, description="Include pinyin in response")
    include_definitions: bool = Field(True, description="Include dictionary definitions")
    include_hsk: bool = Field(True, description="Include HSK level")


class SegmentResponse(BaseModel):
    """Response containing segmented text."""

    segments: list[WordSegment] = Field(..., description="List of segmented words")
    original_text: str = Field(..., description="Original input text")
    word_count: int = Field(..., description="Number of words (excluding punctuation)")


class SimplifyRequest(BaseModel):
    """Request to simplify a Chinese sentence."""

    text: str = Field(..., min_length=1, max_length=1000, description="Chinese sentence")
    target_level: int = Field(3, ge=1, le=6, description="Target HSK level")


class SimplifyResponse(BaseModel):
    """Response containing simplified sentence."""

    original: str = Field(..., description="Original sentence")
    simplified: str = Field(..., description="Simplified sentence")
    target_level: int = Field(..., description="Target HSK level used")
    words_replaced: int = Field(..., description="Number of words simplified")


class LookupRequest(BaseModel):
    """Request to look up a word in the dictionary."""

    word: str = Field(..., min_length=1, max_length=50, description="Word to look up")


class LookupResponse(BaseModel):
    """Response containing dictionary entry."""

    word: str
    traditional: str | None = None
    pinyin: str | None = None
    definitions: list[str] = Field(default_factory=list)
    hsk_level: int | None = None
    examples: list[str] = Field(default_factory=list)
    found: bool = True


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    version: str
    models_loaded: bool
    dictionary_entries: int
