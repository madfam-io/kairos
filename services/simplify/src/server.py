"""FastAPI server for Kairos AI Simplification Service.

Runs vLLM with Qwen3-30B-A3B MoE model for Chinese sentence simplification.
Designed for Docker/Enclii deployment.
"""

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel, Field

from . import __version__
from .prompts import build_messages
from .cache import create_cache
from .config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# Model configuration
MODEL_ID = os.getenv("MODEL_ID", "Qwen/Qwen3-30B-A3B")
GPU_MEMORY_UTILIZATION = float(os.getenv("GPU_MEMORY_UTILIZATION", "0.90"))
MAX_MODEL_LEN = int(os.getenv("MAX_MODEL_LEN", "8192"))

# Global model instance
llm = None
sampling_params = None


def load_model():
    """Load the vLLM model."""
    global llm, sampling_params

    from vllm import LLM, SamplingParams

    logger.info("Loading model", model_id=MODEL_ID)

    llm = LLM(
        model=MODEL_ID,
        trust_remote_code=True,
        tensor_parallel_size=1,
        gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
        max_model_len=MAX_MODEL_LEN,
        enforce_eager=False,  # Use CUDA graphs for MoE
    )

    sampling_params = SamplingParams(
        temperature=0.3,
        top_p=0.9,
        max_tokens=512,
        stop=["<|endoftext|>", "<|im_end|>"],
    )

    logger.info("Model loaded successfully", model_id=MODEL_ID)


def format_chat_prompt(messages: list[dict]) -> str:
    """Format messages for Qwen chat template."""
    prompt_parts = []

    for msg in messages:
        role = msg["role"]
        content = msg["content"]

        if role == "system":
            prompt_parts.append(f"<|im_start|>system\n{content}<|im_end|>")
        elif role == "user":
            prompt_parts.append(f"<|im_start|>user\n{content}<|im_end|>")
        elif role == "assistant":
            prompt_parts.append(f"<|im_start|>assistant\n{content}<|im_end|>")

    # Add assistant prefix for generation
    prompt_parts.append("<|im_start|>assistant\n")

    return "\n".join(prompt_parts)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler - load model on startup."""
    logger.info("Starting Kairos Simplification service", version=__version__)

    # Load the model
    load_model()

    # Initialize cache if Redis is available
    if settings.redis_url:
        app.state.cache = create_cache(settings.redis_url, settings.cache_ttl)
    else:
        app.state.cache = None

    yield

    # Cleanup
    if app.state.cache:
        await app.state.cache.close()
    logger.info("Shutting down Kairos Simplification service")


app = FastAPI(
    title="Kairos Simplification Service",
    description="AI-powered Chinese sentence simplification using Qwen3",
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


# Request/Response models
class SimplifyRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    target_level: int = Field(3, ge=1, le=6)
    preserve_names: bool = True
    context: str | None = None


class SimplifyResponse(BaseModel):
    original: str
    simplified: str
    target_level: int
    confidence: float
    cached: bool = False
    tokens_used: int


class BatchRequest(BaseModel):
    sentences: list[str] = Field(..., min_length=1, max_length=50)
    target_level: int = Field(3, ge=1, le=6)
    preserve_names: bool = True


class BatchResponse(BaseModel):
    results: list[SimplifyResponse]
    total_tokens: int
    cache_hits: int = 0


class HealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool
    model_id: str
    gpu_available: bool


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    import torch

    return HealthResponse(
        status="ok" if llm is not None else "loading",
        version=__version__,
        model_loaded=llm is not None,
        model_id=MODEL_ID,
        gpu_available=torch.cuda.is_available(),
    )


@app.post("/simplify")
async def simplify(request: SimplifyRequest):
    """Simplify a Chinese sentence to target HSK level."""
    if llm is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        # Check cache first
        cache = app.state.cache
        cache_key = f"simplify:{request.target_level}:{hash(request.text)}"

        if cache:
            cached = await cache.get(cache_key)
            if cached:
                return {
                    "success": True,
                    "data": {**cached, "cached": True},
                }

        # Build prompt and generate
        messages = build_messages(request.text, request.target_level, request.context)
        prompt = format_chat_prompt(messages)

        outputs = llm.generate([prompt], sampling_params)
        result_text = outputs[0].outputs[0].text.strip()
        simplified = result_text.split("\n")[0].strip()

        result = {
            "original": request.text,
            "simplified": simplified,
            "target_level": request.target_level,
            "confidence": 0.9,
            "cached": False,
            "tokens_used": len(outputs[0].outputs[0].token_ids),
        }

        # Cache the result
        if cache:
            await cache.set(cache_key, result, ttl=settings.cache_ttl)

        return {"success": True, "data": result}

    except Exception as e:
        logger.error("Simplification failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Simplification failed: {str(e)}")


@app.post("/simplify/batch")
async def simplify_batch(request: BatchRequest):
    """Simplify multiple sentences in batch."""
    if llm is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        prompts = []
        for text in request.sentences:
            messages = build_messages(text, request.target_level)
            prompts.append(format_chat_prompt(messages))

        outputs = llm.generate(prompts, sampling_params)

        results = []
        total_tokens = 0
        for text, output in zip(request.sentences, outputs):
            result_text = output.outputs[0].text.strip()
            simplified = result_text.split("\n")[0].strip()
            tokens = len(output.outputs[0].token_ids)
            total_tokens += tokens

            results.append({
                "original": text,
                "simplified": simplified,
                "target_level": request.target_level,
                "confidence": 0.9,
                "cached": False,
                "tokens_used": tokens,
            })

        return {
            "success": True,
            "data": {
                "results": results,
                "total_tokens": total_tokens,
            },
        }

    except Exception as e:
        logger.error("Batch simplification failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Batch simplification failed: {str(e)}")


def start() -> None:
    """Start the server using uvicorn."""
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8001"))

    uvicorn.run(
        "src.server:app",
        host=host,
        port=port,
        workers=1,  # vLLM manages its own parallelism
    )


if __name__ == "__main__":
    start()
