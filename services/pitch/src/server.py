"""FastAPI server for Kairos Pitch Detection Service.

Uses FCPE for accurate Chinese tone detection.
Designed for Docker/Enclii deployment.
"""

import os
import io
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

import numpy as np
import structlog
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from . import __version__

logger = structlog.get_logger()

# Mandarin tone patterns
TONE_PATTERNS = {
    1: {"name": "high-level", "contour": "flat-high"},
    2: {"name": "rising", "contour": "low-to-high"},
    3: {"name": "dipping", "contour": "mid-low-mid"},
    4: {"name": "falling", "contour": "high-to-low"},
    5: {"name": "neutral", "contour": "short-mid"},
}

# Global model instance
model = None
device = None
sample_rate = 16000


def load_model():
    """Load FCPE model."""
    global model, device

    import torch
    from torchfcpe import spawn_bundled_infer_model

    logger.info("Loading FCPE model...")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = spawn_bundled_infer_model(device=device)

    logger.info("FCPE loaded", device=device)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler."""
    logger.info("Starting Kairos Pitch Detection service", version=__version__)
    load_model()
    yield
    logger.info("Shutting down Kairos Pitch Detection service")


app = FastAPI(
    title="Kairos Pitch Detection Service",
    description="FCPE-powered pitch detection for Mandarin tone analysis",
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


def extract_pitch_contour(
    audio_bytes: bytes,
    hop_length: int = 160,
    threshold: float = 0.3,
) -> dict:
    """Extract pitch contour from audio."""
    import torch
    import soundfile as sf
    import librosa

    # Load audio
    audio_data, sr = sf.read(io.BytesIO(audio_bytes))

    # Resample if needed
    if sr != sample_rate:
        audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=sample_rate)

    # Ensure mono
    if len(audio_data.shape) > 1:
        audio_data = audio_data.mean(axis=1)

    # Extract pitch using FCPE
    with torch.no_grad():
        audio_tensor = torch.from_numpy(audio_data).float().unsqueeze(0).unsqueeze(0).to(device)
        f0 = model.infer(audio_tensor, sr=sample_rate, decoder_mode="local_argmax")
        f0 = f0.squeeze().cpu().numpy()

    # Generate timestamps
    times = np.arange(len(f0)) * hop_length / sample_rate

    # Filter out unvoiced segments
    voiced_mask = f0 > 0
    voiced_f0 = f0[voiced_mask].tolist()
    voiced_times = times[voiced_mask].tolist()

    return {
        "f0": f0.tolist(),
        "times": times.tolist(),
        "voiced_f0": voiced_f0,
        "voiced_times": voiced_times,
        "sample_rate": sample_rate,
        "hop_length": hop_length,
        "duration": len(audio_data) / sample_rate,
    }


def extract_contour_features(semitones: np.ndarray) -> dict:
    """Extract features from pitch contour for tone classification."""
    n = len(semitones)
    first_third = semitones[:n//3]
    mid_third = semitones[n//3:2*n//3]
    last_third = semitones[2*n//3:]

    return {
        "start_pitch": float(np.mean(first_third)),
        "mid_pitch": float(np.mean(mid_third)),
        "end_pitch": float(np.mean(last_third)),
        "slope": float((semitones[-1] - semitones[0]) / len(semitones)),
        "range": float(np.max(semitones) - np.min(semitones)),
        "std": float(np.std(semitones)),
        "min_position": float(np.argmin(semitones) / len(semitones)),
    }


def classify_tone(features: dict) -> int:
    """Classify Mandarin tone based on contour features."""
    slope = features["slope"]
    pitch_range = features["range"]
    min_pos = features["min_position"]
    start = features["start_pitch"]
    end = features["end_pitch"]

    # Tone 1: High level (flat, high pitch, small range)
    if pitch_range < 3 and abs(slope) < 0.05:
        return 1

    # Tone 2: Rising (positive slope)
    if slope > 0.08 and end > start + 2:
        return 2

    # Tone 3: Dipping (minimum in middle, ends higher)
    if 0.3 < min_pos < 0.7 and pitch_range > 3:
        return 3

    # Tone 4: Falling (negative slope, large drop)
    if slope < -0.08 and start > end + 2:
        return 4

    # Default to neutral tone
    return 5


def tone_confidence(features: dict, tone: int) -> float:
    """Calculate confidence score for tone classification."""
    base_confidence = 0.7

    if tone == 1 and features["range"] < 2:
        base_confidence += 0.2
    elif tone == 2 and features["slope"] > 0.1:
        base_confidence += 0.2
    elif tone == 3 and 0.35 < features["min_position"] < 0.65:
        base_confidence += 0.2
    elif tone == 4 and features["slope"] < -0.1:
        base_confidence += 0.2

    return min(base_confidence, 0.95)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    import torch

    return {
        "status": "ok" if model is not None else "loading",
        "version": __version__,
        "model": "FCPE",
        "device": device,
        "gpu_available": torch.cuda.is_available(),
    }


@app.post("/extract")
async def extract_pitch(
    audio: UploadFile = File(...),
    hop_length: int = Form(160),
    threshold: float = Form(0.3),
):
    """Extract pitch contour from audio file."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        audio_bytes = await audio.read()
        result = extract_pitch_contour(audio_bytes, hop_length, threshold)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error("Pitch extraction failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-tone")
async def analyze_tone(
    audio: UploadFile = File(...),
    expected_tone: Optional[int] = Form(None),
):
    """Analyze Mandarin tone from audio."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        audio_bytes = await audio.read()
        pitch_data = extract_pitch_contour(audio_bytes)

        voiced_f0 = np.array(pitch_data["voiced_f0"])
        if len(voiced_f0) < 5:
            return {
                "success": False,
                "error": "Insufficient voiced audio",
                "data": {"detected_tone": None, "confidence": 0},
            }

        # Normalize pitch to semitones
        mean_f0 = np.mean(voiced_f0)
        semitones = 12 * np.log2(voiced_f0 / mean_f0)

        # Analyze
        contour_features = extract_contour_features(semitones)
        detected_tone = classify_tone(contour_features)
        confidence = tone_confidence(contour_features, detected_tone)

        result = {
            "detected_tone": detected_tone,
            "tone_name": TONE_PATTERNS[detected_tone]["name"],
            "confidence": confidence,
            "contour_features": contour_features,
        }

        if expected_tone:
            result["expected_tone"] = expected_tone
            result["is_correct"] = detected_tone == expected_tone

        return {"success": True, "data": result}

    except Exception as e:
        logger.error("Tone analysis failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/compare")
async def compare_pitch(
    reference: UploadFile = File(...),
    user_audio: UploadFile = File(...),
):
    """Compare user pitch to reference audio."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        from scipy.spatial.distance import cosine

        ref_bytes = await reference.read()
        user_bytes = await user_audio.read()

        ref_pitch = extract_pitch_contour(ref_bytes)
        user_pitch = extract_pitch_contour(user_bytes)

        ref_f0 = np.array(ref_pitch["voiced_f0"])
        user_f0 = np.array(user_pitch["voiced_f0"])

        if len(ref_f0) < 5 or len(user_f0) < 5:
            return {"success": False, "error": "Insufficient voiced audio", "data": {"similarity": 0}}

        # Normalize to semitones
        ref_semitones = 12 * np.log2(ref_f0 / np.mean(ref_f0))
        user_semitones = 12 * np.log2(user_f0 / np.mean(user_f0))

        # Resample to same length
        target_len = min(len(ref_semitones), len(user_semitones), 100)
        ref_resampled = np.interp(
            np.linspace(0, 1, target_len),
            np.linspace(0, 1, len(ref_semitones)),
            ref_semitones
        )
        user_resampled = np.interp(
            np.linspace(0, 1, target_len),
            np.linspace(0, 1, len(user_semitones)),
            user_semitones
        )

        # Calculate similarity
        similarity = 1 - cosine(ref_resampled, user_resampled)

        # Calculate per-segment scores
        segments = 5
        segment_scores = []
        seg_len = target_len // segments
        for i in range(segments):
            start = i * seg_len
            end = start + seg_len
            seg_sim = 1 - cosine(ref_resampled[start:end], user_resampled[start:end])
            segment_scores.append(float(seg_sim))

        return {
            "success": True,
            "data": {
                "similarity": float(similarity),
                "segment_scores": segment_scores,
                "reference_contour": ref_resampled.tolist(),
                "user_contour": user_resampled.tolist(),
                "reference_duration": ref_pitch["duration"],
                "user_duration": user_pitch["duration"],
            },
        }

    except Exception as e:
        logger.error("Pitch comparison failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


def start() -> None:
    """Start the server using uvicorn."""
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8002"))

    uvicorn.run(
        "src.server:app",
        host=host,
        port=port,
        workers=1,
    )


if __name__ == "__main__":
    start()
