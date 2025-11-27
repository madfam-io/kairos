# Kairos AI Simplification Service

AI-powered Chinese sentence simplification using Qwen3-30B-A3B.

## Features

- Simplify Chinese sentences to target HSK levels (1-6)
- Batch processing support
- Result caching (Redis or in-memory)
- Deployed via Docker/Enclii with GPU acceleration (vLLM)

## Quick Start

### Docker Deployment (Recommended)

```bash
# Build the image
docker build -t kairos-simplify .

# Run with GPU
docker run --gpus all -p 8001:8001 kairos-simplify
```

### Local Development

```bash
# Install dependencies
pip install -e ".[dev]"

# Run local server
python -m src.main
```

### Enclii Deployment

```bash
# Deploy all services
enclii deploy
```

## API Endpoints

### POST /simplify

Simplify a single sentence.

**Request:**
```json
{
  "text": "这部电影的情节跌宕起伏，令人叹为观止。",
  "target_level": 3,
  "preserve_names": true,
  "context": "Movie review"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "original": "这部电影的情节跌宕起伏，令人叹为观止。",
    "simplified": "这部电影的故事很精彩，让人觉得很好看。",
    "target_level": 3,
    "confidence": 0.9,
    "tokens_used": 45
  }
}
```

### POST /simplify/batch

Simplify multiple sentences.

**Request:**
```json
{
  "sentences": [
    "这部电影的情节跌宕起伏",
    "他毅然决然地放弃了工作"
  ],
  "target_level": 3
}
```

### GET /health

Health check endpoint.

## Model Information

- **Model**: Qwen/Qwen3-30B-A3B
- **GPU**: A10G (24GB VRAM required)
- **Inference**: vLLM with flash attention
- **Max tokens**: 512
- **Temperature**: 0.3

## HSK Level Guidelines

| Level | Description |
|-------|-------------|
| HSK 1-2 | Basic vocabulary, simple sentences |
| HSK 3 | Common everyday vocabulary |
| HSK 4 | Intermediate, can express opinions |
| HSK 5 | Advanced, abstract topics |
| HSK 6 | Near-native vocabulary |

## Resource Requirements

- A10G GPU: 24GB VRAM minimum
- Average request: ~1-2 seconds
- Cold start: ~30 seconds (model loading)
- Estimated cost: ~$0.0004 per simplification (self-hosted)

## License

MIT
