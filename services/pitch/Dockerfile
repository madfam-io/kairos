# Kairos Pitch Detection Service Dockerfile
# Uses FCPE for accurate Chinese tone detection

FROM nvidia/cuda:12.1-runtime-ubuntu22.04 AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-dev \
    python3-pip \
    build-essential \
    ffmpeg \
    libsndfile1 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as default
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install Python dependencies
RUN pip install --no-cache-dir \
    "torch>=2.1.0" \
    "torchaudio>=2.1.0" \
    "torchfcpe>=0.0.4" \
    "numpy>=1.24.0" \
    "scipy>=1.11.0" \
    "librosa>=0.10.0" \
    "soundfile>=0.12.0" \
    "fastapi>=0.109.0" \
    "pydantic>=2.5.0" \
    "uvicorn>=0.25.0" \
    "python-multipart>=0.0.6" \
    "structlog>=24.1.0" \
    "orjson>=3.9.0"

# Copy application code
COPY src/ ./src/

# Create non-root user
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser

# Environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8002

# Expose port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Run the application
CMD ["python", "-m", "src.server"]
