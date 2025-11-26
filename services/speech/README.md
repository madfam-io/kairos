# Kairos Speech Services

Combined ASR (SenseVoice) and TTS (CosyVoice) services for Chinese learning.

## Models

### ASR: SenseVoice-Small
- **15x faster** than Whisper-Large
- **Best Chinese accuracy**: WER 1.22% (vs Whisper 4.72%) on AISHELL-1
- Supports: Chinese, Cantonese, English, Japanese, Korean
- 70ms to process 10 seconds of audio

### TTS: CosyVoice 2.0
- **150ms latency** streaming mode
- **30-50% fewer** pronunciation errors vs v1
- Supports: Mandarin, Cantonese, Sichuanese, Shanghainese, English, Japanese, Korean
- Zero-shot voice cloning

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

## TTS Endpoints

### `POST /tts/synthesize`
Generate speech from text.

```bash
curl -X POST "https://kairos-speech.modal.run/tts/synthesize" \
  -H "Content-Type: application/json" \
  -d '{"text": "你好", "speaker": "中文女", "speed": 1.0}' \
  --output output.wav
```

### `POST /tts/clone`
Zero-shot voice cloning.

```bash
curl -X POST "https://kairos-speech.modal.run/tts/clone" \
  -F "text=你好世界" \
  -F "reference_audio=@voice_sample.wav" \
  -F "reference_text=这是参考文本" \
  --output cloned.wav
```

### `GET /tts/speakers`
List available voices.

```json
{
  "speakers": ["中文女", "中文男", "粤语女", "英文女", "英文男", "日语女", "韩语女"]
}
```

## Deployment

```bash
modal deploy modal_speech.py
```

## Use Cases

1. **Shadowing Practice**: ASR user speech → compare to reference
2. **Pronunciation Feedback**: ASR + pitch analysis
3. **Reference Audio**: TTS for vocabulary cards
4. **Voice Cloning**: Clone native speaker for personalized practice
