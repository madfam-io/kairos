"""Modal deployment for Kairos Pitch Detection Service.

Uses FCPE (Fast Context-based Pitch Estimation) - 77x faster than CREPE
with equivalent accuracy (96.79% RPA).

Deploy with: modal deploy modal_pitch.py
"""

import modal
from typing import Optional

# Define the Modal app
app = modal.App("kairos-pitch")

# Create image with FCPE and audio processing dependencies
pitch_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install(
        "torch>=2.0.0",
        "torchaudio>=2.0.0",
        "numpy>=1.24.0",
        "librosa>=0.10.0",
        "soundfile>=0.12.0",
        "fastapi>=0.109.0",
        "pydantic>=2.5.0",
        "python-multipart>=0.0.6",
        "scipy>=1.11.0",
    )
    .run_commands(
        "pip install git+https://github.com/CNChTu/FCPE.git"
    )
)

# Mandarin tone patterns (Hz ranges for male/female voices)
TONE_PATTERNS = {
    1: {"name": "high-level", "contour": "flat-high"},
    2: {"name": "rising", "contour": "low-to-high"},
    3: {"name": "dipping", "contour": "mid-low-mid"},
    4: {"name": "falling", "contour": "high-to-low"},
    5: {"name": "neutral", "contour": "short-mid"},
}


@app.cls(
    image=pitch_image,
    gpu="T4",  # FCPE is lightweight, T4 is sufficient
    timeout=120,
    container_idle_timeout=180,
    allow_concurrent_inputs=16,
)
class PitchDetector:
    """FCPE-powered pitch detection for Mandarin tone analysis."""

    @modal.enter()
    def load_model(self):
        """Load FCPE model when container starts."""
        import torch
        from fcpe import FCPE

        print("Loading FCPE model...")

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = FCPE(device=self.device)
        self.sample_rate = 16000  # Standard for speech

        print(f"FCPE loaded on {self.device}")

    @modal.method()
    def extract_pitch(
        self,
        audio_bytes: bytes,
        hop_length: int = 160,  # 10ms at 16kHz
        threshold: float = 0.3,
    ) -> dict:
        """Extract pitch contour from audio."""
        import numpy as np
        import soundfile as sf
        import io

        # Load audio
        audio_data, sr = sf.read(io.BytesIO(audio_bytes))

        # Resample if needed
        if sr != self.sample_rate:
            import librosa
            audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=self.sample_rate)

        # Ensure mono
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1)

        # Extract pitch using FCPE
        import torch
        with torch.no_grad():
            audio_tensor = torch.from_numpy(audio_data).float().unsqueeze(0).to(self.device)
            f0, confidence = self.model(audio_tensor, self.sample_rate, hop_length, threshold)

        f0 = f0.squeeze().cpu().numpy()
        confidence = confidence.squeeze().cpu().numpy()

        # Generate timestamps
        times = np.arange(len(f0)) * hop_length / self.sample_rate

        # Filter out unvoiced segments
        voiced_mask = f0 > 0
        voiced_f0 = f0[voiced_mask].tolist()
        voiced_times = times[voiced_mask].tolist()

        return {
            "f0": f0.tolist(),
            "confidence": confidence.tolist(),
            "times": times.tolist(),
            "voiced_f0": voiced_f0,
            "voiced_times": voiced_times,
            "sample_rate": self.sample_rate,
            "hop_length": hop_length,
            "duration": len(audio_data) / self.sample_rate,
        }

    @modal.method()
    def analyze_tone(
        self,
        audio_bytes: bytes,
        expected_tone: Optional[int] = None,
    ) -> dict:
        """Analyze Mandarin tone from audio and optionally compare to expected."""
        import numpy as np

        # Extract pitch
        pitch_data = self.extract_pitch(audio_bytes)

        voiced_f0 = np.array(pitch_data["voiced_f0"])
        if len(voiced_f0) < 5:
            return {
                "error": "Insufficient voiced audio",
                "detected_tone": None,
                "confidence": 0,
            }

        # Normalize pitch to semitones (relative to mean)
        mean_f0 = np.mean(voiced_f0)
        semitones = 12 * np.log2(voiced_f0 / mean_f0)

        # Analyze contour shape
        contour_features = self._extract_contour_features(semitones)
        detected_tone = self._classify_tone(contour_features)

        # Calculate confidence
        confidence = self._tone_confidence(contour_features, detected_tone)

        result = {
            "detected_tone": detected_tone,
            "tone_name": TONE_PATTERNS[detected_tone]["name"],
            "confidence": confidence,
            "contour_features": contour_features,
            "pitch_data": pitch_data,
        }

        # Compare to expected if provided
        if expected_tone:
            result["expected_tone"] = expected_tone
            result["is_correct"] = detected_tone == expected_tone
            result["similarity_score"] = self._tone_similarity(
                contour_features, expected_tone
            )

        return result

    def _extract_contour_features(self, semitones: "np.ndarray") -> dict:
        """Extract features from pitch contour for tone classification."""
        import numpy as np

        # Split into segments
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

    def _classify_tone(self, features: dict) -> int:
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

    def _tone_confidence(self, features: dict, tone: int) -> float:
        """Calculate confidence score for tone classification."""
        # Simplified confidence based on how well features match tone pattern
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

    def _tone_similarity(self, features: dict, expected_tone: int) -> float:
        """Calculate similarity between detected contour and expected tone."""
        # Ideal contour features for each tone
        ideal_features = {
            1: {"slope": 0, "range": 1.5, "min_position": 0.5},
            2: {"slope": 0.15, "range": 4, "min_position": 0.0},
            3: {"slope": 0.02, "range": 5, "min_position": 0.5},
            4: {"slope": -0.15, "range": 4, "min_position": 1.0},
            5: {"slope": 0, "range": 2, "min_position": 0.5},
        }

        ideal = ideal_features[expected_tone]
        score = 1.0

        # Penalize deviations
        score -= abs(features["slope"] - ideal["slope"]) * 2
        score -= abs(features["range"] - ideal["range"]) * 0.1
        score -= abs(features["min_position"] - ideal["min_position"]) * 0.3

        return max(0.0, min(1.0, score))

    @modal.method()
    def compare_pitch(
        self,
        reference_bytes: bytes,
        user_bytes: bytes,
    ) -> dict:
        """Compare user pitch contour to reference."""
        import numpy as np
        from scipy.spatial.distance import cosine

        # Extract pitch from both
        ref_pitch = self.extract_pitch(reference_bytes)
        user_pitch = self.extract_pitch(user_bytes)

        ref_f0 = np.array(ref_pitch["voiced_f0"])
        user_f0 = np.array(user_pitch["voiced_f0"])

        if len(ref_f0) < 5 or len(user_f0) < 5:
            return {"error": "Insufficient voiced audio", "similarity": 0}

        # Normalize to semitones
        ref_semitones = 12 * np.log2(ref_f0 / np.mean(ref_f0))
        user_semitones = 12 * np.log2(user_f0 / np.mean(user_f0))

        # Resample to same length using interpolation
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

        # Calculate similarity (1 - cosine distance)
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
            "similarity": float(similarity),
            "segment_scores": segment_scores,
            "reference_contour": ref_resampled.tolist(),
            "user_contour": user_resampled.tolist(),
            "reference_duration": ref_pitch["duration"],
            "user_duration": user_pitch["duration"],
        }

    @modal.method()
    def health(self) -> dict:
        """Health check."""
        return {
            "status": "ok",
            "model": "FCPE",
            "device": self.device,
        }


# FastAPI web endpoint
@app.function(image=pitch_image)
@modal.asgi_app()
def web_app():
    """FastAPI web application for pitch detection."""
    from fastapi import FastAPI, HTTPException, UploadFile, File, Form
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
    from typing import Optional

    api = FastAPI(
        title="Kairos Pitch Detection API",
        description="FCPE-powered pitch detection for Mandarin tone analysis",
        version="0.1.0",
    )

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @api.get("/health")
    async def health():
        detector = PitchDetector()
        return detector.health.remote()

    @api.post("/extract")
    async def extract_pitch(
        audio: UploadFile = File(...),
        hop_length: int = Form(160),
        threshold: float = Form(0.3),
    ):
        """Extract pitch contour from audio file."""
        detector = PitchDetector()
        audio_bytes = await audio.read()

        result = detector.extract_pitch.remote(
            audio_bytes=audio_bytes,
            hop_length=hop_length,
            threshold=threshold,
        )
        return {"success": True, "data": result}

    @api.post("/analyze-tone")
    async def analyze_tone(
        audio: UploadFile = File(...),
        expected_tone: Optional[int] = Form(None),
    ):
        """Analyze Mandarin tone from audio."""
        detector = PitchDetector()
        audio_bytes = await audio.read()

        result = detector.analyze_tone.remote(
            audio_bytes=audio_bytes,
            expected_tone=expected_tone,
        )
        return {"success": True, "data": result}

    @api.post("/compare")
    async def compare_pitch(
        reference: UploadFile = File(...),
        user_audio: UploadFile = File(...),
    ):
        """Compare user pitch to reference audio."""
        detector = PitchDetector()
        ref_bytes = await reference.read()
        user_bytes = await user_audio.read()

        result = detector.compare_pitch.remote(
            reference_bytes=ref_bytes,
            user_bytes=user_bytes,
        )
        return {"success": True, "data": result}

    return api


# Local testing
@app.local_entrypoint()
def main():
    """Test the deployed pitch detector."""
    detector = PitchDetector()

    print("Health check:")
    print(detector.health.remote())
