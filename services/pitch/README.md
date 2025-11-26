# Kairos Pitch Detection Service

FCPE-powered pitch detection for Mandarin tone analysis and shadowing practice.

## Model

- **FCPE** (Fast Context-based Pitch Estimation)
- 96.79% Raw Pitch Accuracy (RPA)
- 77x faster than CREPE with equivalent accuracy
- Real-time capable (RTF 0.0062)

## Endpoints

### `POST /extract`
Extract pitch contour (F0) from audio.

```bash
curl -X POST "https://kairos-pitch.modal.run/extract" \
  -F "audio=@recording.wav" \
  -F "hop_length=160" \
  -F "threshold=0.3"
```

### `POST /analyze-tone`
Analyze Mandarin tone from audio.

```bash
curl -X POST "https://kairos-pitch.modal.run/analyze-tone" \
  -F "audio=@tone.wav" \
  -F "expected_tone=2"
```

Response:
```json
{
  "detected_tone": 2,
  "tone_name": "rising",
  "confidence": 0.89,
  "is_correct": true,
  "similarity_score": 0.92
}
```

### `POST /compare`
Compare user pitch contour to reference for shadowing.

```bash
curl -X POST "https://kairos-pitch.modal.run/compare" \
  -F "reference=@native.wav" \
  -F "user_audio=@user.wav"
```

Response:
```json
{
  "similarity": 0.85,
  "segment_scores": [0.9, 0.82, 0.78, 0.88, 0.87],
  "reference_contour": [...],
  "user_contour": [...]
}
```

## Mandarin Tones

| Tone | Name | Contour |
|------|------|---------|
| 1 | High-level | Flat high pitch |
| 2 | Rising | Low to high |
| 3 | Dipping | Mid → low → mid |
| 4 | Falling | High to low |
| 5 | Neutral | Short, mid pitch |

## Deployment

```bash
modal deploy modal_pitch.py
```

## Local Development

```bash
modal run modal_pitch.py
```
