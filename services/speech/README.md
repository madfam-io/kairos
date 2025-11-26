# Kairos Speech Services

Combined ASR and TTS services for Chinese learning.

## Models

### ASR: SenseVoice-Small
- **15x faster** than Whisper-Large
- **Best Chinese accuracy**: WER 1.22% (vs Whisper 4.72%) on AISHELL-1
- Supports: Chinese, Cantonese, English, Japanese, Korean
- 70ms to process 10 seconds of audio

### TTS Option 1: CosyVoice 2.0 (Streaming)
- **150ms latency** streaming mode
- **30-50% fewer** pronunciation errors vs v1
- Supports: Mandarin, Cantonese, Sichuanese, Shanghainese, English, Japanese, Korean
- Zero-shot voice cloning
- **Best for**: Real-time applications, streaming audio

### TTS Option 2: Fish Speech 1.5 (Highest Quality)
- **ELO score 1339** in TTS Arena (industry-leading)
- **1.3% character error rate** for Chinese
- DualAR architecture for natural prosody
- Zero-shot voice cloning with 3-10s reference
- **Best for**: Vocabulary cards, reference audio, quality-critical applications

## When to Use Which TTS

| Use Case | Recommended TTS | Why |
|----------|-----------------|-----|
| Streaming audio | CosyVoice | 150ms latency |
| Vocabulary cards | Fish Speech | Highest quality |
| Reference audio for shadowing | Fish Speech | Clear pronunciation |
| Real-time feedback | CosyVoice | Low latency |
| Voice cloning | Either | Both support it |

## ASR Endpoints

### `POST /asr/transcribe`
Transcribe audio to text.

```bash
curl -X POST "https://kairos-speech.modal.run/asr/transcribe" \
  -F "audio=@recording.wav" \
  -F "language=zh"
```

Response:
```json
{
  "text": "你好，我是学生。",
  "language": "zh",
  "duration": 2.5
}
```

### `POST /asr/transcribe-timestamps`
Transcribe with word-level timestamps.

```bash
curl -X POST "https://kairos-speech.modal.run/asr/transcribe-timestamps" \
  -F "audio=@recording.wav"
```

Response:
```json
{
  "text": "你好，我是学生。",
  "segments": [
    {"text": "你好", "start": 0.0, "end": 0.5},
    {"text": "我是学生", "start": 0.6, "end": 1.2}
  ]
}
```

## CosyVoice TTS Endpoints

### `POST /tts/synthesize`
Generate speech from text (CosyVoice - streaming optimized).

```bash
curl -X POST "https://kairos-speech.modal.run/tts/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text": "你好", "speaker": "中文女", "speed": 1.0}' \
  --output output.wav
```

### `POST /tts/clone`
Zero-shot voice cloning with CosyVoice.

```bash
curl -X POST "https://kairos-speech.modal.run/tts/clone" \
  -F "text=你好世界" \
  -F "reference_audio=@voice_sample.wav" \
  -F "reference_text=这是参考文本" \
  --output cloned.wav
```

### `GET /tts/speakers`
List available CosyVoice speakers.

```json
{
  "speakers": ["中文女", "中文男", "粤语女", "英文女", "英文男", "日语女", "韩语女"]
}
```

## Fish Speech TTS Endpoints (High Quality)

### `POST /tts/fish-speech/synthesize`
Generate high-quality speech with Fish Speech 1.5.

```bash
curl -X POST "https://kairos-speech.modal.run/tts/fish-speech/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text": "你好", "speed": 1.0, "temperature": 0.7}' \
  --output output.wav
```

Parameters:
- `text`: Chinese text to synthesize
- `speaker`: Speaker ID (default: "default")
- `speed`: Speech speed 0.5-2.0 (default: 1.0)
- `temperature`: Expressiveness 0.1-1.0 (default: 0.7)

### `POST /tts/fish-speech/clone`
Zero-shot voice cloning with Fish Speech (higher quality).

```bash
curl -X POST "https://kairos-speech.modal.run/tts/fish-speech/clone" \
  -F "text=你好世界" \
  -F "reference_audio=@voice_sample.wav" \
  -F "reference_text=这是参考文本" \
  -F "temperature=0.7" \
  --output cloned.wav
```

### `POST /tts/fish-speech/vocabulary-card`
Generate optimized audio for vocabulary flashcards.

```bash
curl -X POST "https://kairos-speech.modal.run/tts/fish-speech/vocabulary-card" \
  -H "Content-Type: application/json" \
  -d '{"word": "学习", "sentence": "我正在学习中文。", "include_pause": true}' \
  --output card_audio.wav
```

Features:
- Word pronounced at 0.9x speed for clarity
- Lower temperature (0.5) for consistent pronunciation
- Optional 0.5s pause between word and sentence
- Higher sample rate (44.1kHz) for quality

Response: WAV audio file with word + pause + sentence

## Health Checks

```bash
# All services
GET /health

# Individual services
GET /health/asr        # SenseVoice
GET /health/tts        # CosyVoice
GET /health/fish-speech  # Fish Speech
```

## Deployment

```bash
modal deploy modal_speech.py
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kairos Speech Services                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ASR (SenseVoice)          TTS (CosyVoice)      TTS (Fish Speech)
│  ┌─────────────┐           ┌─────────────┐      ┌─────────────┐ │
│  │ transcribe  │           │ synthesize  │      │ synthesize  │ │
│  │ timestamps  │           │ clone       │      │ clone       │ │
│  └─────────────┘           │ speakers    │      │ vocab-card  │ │
│        T4 GPU              └─────────────┘      └─────────────┘ │
│                                  T4 GPU              A10G GPU   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Use Cases

1. **Shadowing Practice**: ASR user speech → compare to reference
2. **Pronunciation Feedback**: ASR + pitch analysis
3. **Vocabulary Cards**: Fish Speech for high-quality word audio
4. **Reference Audio**: Fish Speech for clear native pronunciation
5. **Real-time Feedback**: CosyVoice for low-latency responses
6. **Voice Cloning**: Clone native speaker for personalized practice

## Cost Estimates (Modal)

| Service | GPU | Cost/hour | Typical request |
|---------|-----|-----------|-----------------|
| SenseVoice | T4 | ~$0.25 | 70ms for 10s audio |
| CosyVoice | T4 | ~$0.25 | 150ms for sentence |
| Fish Speech | A10G | ~$0.75 | 500ms for sentence |
