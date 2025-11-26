"""FastAPI application for the Kairos NLP service."""

import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from . import __version__
from .config import get_settings
from .dictionary import get_dictionary, load_dictionary
from .hsk import get_hsk_classifier, load_hsk
from .models import (
    HealthResponse,
    LookupRequest,
    LookupResponse,
    SegmentRequest,
    SegmentResponse,
)
from .segmenter import get_segmenter, load_segmenter

logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler - load models on startup."""
    logger.info("Starting Kairos NLP service", version=__version__)

    # Load dictionary
    logger.info("Loading CC-CEDICT dictionary")
    load_dictionary(settings.cedict_path)

    # Load HSK vocabulary
    logger.info("Loading HSK vocabulary")
    load_hsk(settings.hsk_path)

    # Load segmenter (LAC model)
    logger.info("Loading LAC segmenter")
    load_segmenter(mode=settings.lac_mode)

    logger.info("All models loaded successfully")
    yield
    logger.info("Shutting down Kairos NLP service")


app = FastAPI(
    title="Kairos NLP Service",
    description="Chinese text segmentation, pinyin, and dictionary lookup",
    version=__version__,
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time header to responses."""
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    return response


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    dictionary = get_dictionary()
    segmenter = get_segmenter()

    return HealthResponse(
        status="ok",
        version=__version__,
        models_loaded=segmenter.loaded,
        dictionary_entries=dictionary.entry_count,
    )


@app.post("/segment", response_model=SegmentResponse)
async def segment_text(request: SegmentRequest) -> SegmentResponse:
    """Segment Chinese text into words with analysis."""
    segmenter = get_segmenter()

    if not segmenter.loaded:
        raise HTTPException(status_code=503, detail="Segmenter not loaded")

    try:
        segments = segmenter.analyze(
            text=request.text,
            include_pinyin=request.include_pinyin,
            include_definitions=request.include_definitions,
            include_hsk=request.include_hsk,
        )

        word_count = sum(1 for s in segments if not s.is_punctuation)

        return SegmentResponse(
            segments=segments,
            original_text=request.text,
            word_count=word_count,
        )
    except Exception as e:
        logger.error("Segmentation failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")


@app.post("/lookup", response_model=LookupResponse)
async def lookup_word(request: LookupRequest) -> LookupResponse:
    """Look up a word in the dictionary."""
    dictionary = get_dictionary()
    hsk = get_hsk_classifier()

    entry = dictionary.lookup(request.word)

    if not entry:
        return LookupResponse(
            word=request.word,
            found=False,
        )

    return LookupResponse(
        word=entry.simplified,
        traditional=entry.traditional if entry.traditional != entry.simplified else None,
        pinyin=entry.pinyin,
        definitions=entry.definitions,
        hsk_level=hsk.get_level(entry.simplified),
        found=True,
    )


@app.get("/hsk/{word}")
async def get_hsk_level(word: str) -> dict:
    """Get HSK level for a word."""
    hsk = get_hsk_classifier()
    level = hsk.get_level(word)

    return {
        "word": word,
        "hsk_level": level,
        "found": level is not None,
    }


def start() -> None:
    """Start the server using uvicorn."""
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        workers=settings.workers,
        reload=settings.debug,
    )


if __name__ == "__main__":
    start()
