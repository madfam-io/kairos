"""FastAPI application for local development/testing."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from . import __version__
from .config import get_settings
from .models import (
    SimplifyRequest,
    SimplifyResponse,
    BatchSimplifyRequest,
    BatchSimplifyResponse,
    HealthResponse,
)
from .cache import create_cache

logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler."""
    logger.info("Starting Kairos Simplification service", version=__version__)

    # Initialize cache
    app.state.cache = create_cache(settings.redis_url, settings.cache_ttl)

    yield

    # Cleanup
    await app.state.cache.close()
    logger.info("Shutting down Kairos Simplification service")


app = FastAPI(
    title="Kairos Simplification Service",
    description="AI-powered Chinese sentence simplification",
    version=__version__,
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        version=__version__,
        model_loaded=False,  # Local mode doesn't load model
        gpu_available=False,
    )


@app.post("/simplify", response_model=SimplifyResponse)
async def simplify(request: SimplifyRequest) -> SimplifyResponse:
    """Simplify a Chinese sentence.

    In local mode, this calls the Modal-deployed model.
    """
    import httpx

    # For local development, call the Modal endpoint
    modal_url = "https://kairos-simplify--web-app.modal.run/simplify"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                modal_url,
                json={
                    "text": request.text,
                    "target_level": request.target_level,
                    "preserve_names": request.preserve_names,
                    "context": request.context,
                },
            )
            response.raise_for_status()
            data = response.json()

            return SimplifyResponse(
                original=data["data"]["original"],
                simplified=data["data"]["simplified"],
                target_level=data["data"]["target_level"],
                confidence=data["data"].get("confidence", 0.9),
                cached=False,
                tokens_used=data["data"].get("tokens_used", 0),
            )
    except httpx.HTTPError as e:
        logger.error("Modal API call failed", error=str(e))
        raise HTTPException(status_code=503, detail="Simplification service unavailable")


@app.post("/simplify/batch", response_model=BatchSimplifyResponse)
async def simplify_batch(request: BatchSimplifyRequest) -> BatchSimplifyResponse:
    """Simplify multiple sentences."""
    import httpx

    modal_url = "https://kairos-simplify--web-app.modal.run/simplify/batch"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                modal_url,
                json={
                    "sentences": request.sentences,
                    "target_level": request.target_level,
                    "preserve_names": request.preserve_names,
                },
            )
            response.raise_for_status()
            data = response.json()

            results = [
                SimplifyResponse(
                    original=r["original"],
                    simplified=r["simplified"],
                    target_level=r["target_level"],
                    confidence=r.get("confidence", 0.9),
                    cached=False,
                    tokens_used=r.get("tokens_used", 0),
                )
                for r in data["data"]["results"]
            ]

            return BatchSimplifyResponse(
                results=results,
                total_tokens=data["data"].get("total_tokens", 0),
                cache_hits=0,
            )
    except httpx.HTTPError as e:
        logger.error("Modal API call failed", error=str(e))
        raise HTTPException(status_code=503, detail="Simplification service unavailable")


def start() -> None:
    """Start the server using uvicorn."""
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    start()
