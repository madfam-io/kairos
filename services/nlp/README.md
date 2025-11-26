# Kairos NLP Service

Chinese text segmentation, pinyin generation, and dictionary lookup service for Kairos.

## Features

- **Chinese Segmentation**: Uses PaddleNLP LAC for accurate word segmentation
- **Pinyin Generation**: Automatic pinyin with tone numbers and tone marks
- **Dictionary Lookup**: CC-CEDICT integration for definitions
- **HSK Classification**: Word-level HSK (1-6) classification

## Quick Start

### Local Development

```bash
# Install dependencies
pip install -e ".[dev]"

# Download CC-CEDICT dictionary
mkdir -p data
curl -L https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz -o data/cedict.txt.gz
gunzip data/cedict.txt.gz
mv data/cedict.txt data/cedict_ts.u8

# Run the service
python -m src.main
```

### Docker

```bash
# Build
docker build -t kairos-nlp .

# Run
docker run -p 8000:8000 kairos-nlp
```

### Modal Deployment

```bash
# Install Modal CLI
pip install modal

# Authenticate
modal token new

# Deploy
modal deploy modal_app.py
```

## API Endpoints

### POST /segment

Segment Chinese text into words with analysis.

**Request:**
```json
{
  "text": "你好，我正在学习中文。",
  "include_pinyin": true,
  "include_definitions": true,
  "include_hsk": true
}
```

**Response:**
```json
{
  "segments": [
    {
      "text": "你好",
      "pinyin": "ni3hao3",
      "tone_marks": "nǐhǎo",
      "definitions": ["hello", "hi"],
      "hsk_level": 1,
      "pos": "interjection",
      "is_punctuation": false
    }
  ],
  "original_text": "你好，我正在学习中文。",
  "word_count": 6
}
```

### POST /lookup

Look up a word in the dictionary.

**Request:**
```json
{
  "word": "学习"
}
```

**Response:**
```json
{
  "word": "学习",
  "traditional": "學習",
  "pinyin": "xue2xi2",
  "definitions": ["to learn", "to study"],
  "hsk_level": 1,
  "found": true
}
```

### GET /hsk/{word}

Get HSK level for a word.

### GET /health

Health check endpoint.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   FastAPI Server                     │
├─────────────────────────────────────────────────────┤
│  /segment    │  /lookup    │  /hsk     │  /health   │
├─────────────────────────────────────────────────────┤
│                    Segmenter                         │
│              (PaddleNLP LAC Model)                   │
├─────────────────────────────────────────────────────┤
│    Dictionary       │      HSK         │   Pinyin   │
│   (CC-CEDICT)       │   Classifier     │  (pypinyin)│
└─────────────────────────────────────────────────────┘
```

## Performance

- Cold start: ~10s (model loading)
- Segmentation: ~10-50ms per request
- Dictionary lookup: <1ms

## License

MIT
