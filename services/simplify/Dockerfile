# Kairos AI Simplification Service Dockerfile
# Uses vLLM with Qwen3-30B-A3B MoE model

FROM nvidia/cuda:12.1-devel-ubuntu22.04 AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-dev \
    python3-pip \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install vLLM and dependencies
RUN pip install --no-cache-dir \
    "vllm>=0.6.4" \
    "transformers>=4.46.0" \
    "torch>=2.4.0" \
    "fastapi>=0.109.0" \
    "pydantic>=2.5.0" \
    "orjson>=3.9.0" \
    "structlog>=24.1.0" \
    "tiktoken>=0.8.0" \
    "uvicorn>=0.25.0" \
    "redis>=5.0.0" \
    "httpx>=0.25.0"

# Copy application code
COPY src/ ./src/
COPY pyproject.toml ./

# Create non-root user
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1 \
    VLLM_ATTENTION_BACKEND=FLASH_ATTN \
    MODEL_ID=Qwen/Qwen3-30B-A3B \
    HOST=0.0.0.0 \
    PORT=8001

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=300s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Run the application
CMD ["python", "-m", "src.server"]
