# Kairos AI Simplification Service

AI-powered Chinese sentence simplification using Qwen2.5-7B-Instruct.

## Features

- Simplify Chinese sentences to target HSK levels (1-6)
- Batch processing support
- Result caching (Redis or in-memory)
- Deployed on Modal with GPU acceleration (vLLM)

## Quick Start

### Deploy to Modal (Recommended)

```bash
# Install Modal CLI
pip install modal

# Authenticate
modal token new

# Deploy
modal deploy modal_app.py
```

### Local Development

```bash
# Install dependencies
pip install -e ".[dev]"

# Run local server (calls Modal endpoint)
python -m src.main
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

- **Model**: Qwen/Qwen2.5-7B-Instruct
- **GPU**: A10G (Modal)
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

## Cost Estimation (Modal)

- A10G GPU: ~$0.75/hour
- Average request: ~1-2 seconds
- Cold start: ~30 seconds (cached container: instant)
- Estimated cost: ~$0.0004 per simplification

## License

MIT
