"""FastAPI server for Kairos Speech Service.

SenseVoice ASR + CosyVoice TTS for Chinese speech processing.
Designed for Docker/Enclii deployment.
"""

import os
import io
import base64
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

import numpy as np
import structlog
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from . import __version__

logger = structlog.get_logger()

# Global model instances
asr_model = None
tts_model = None
device = None


def load_models():
    """Load ASR and TTS models."""
    global asr_model, tts_model, device

    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info("Loading speech models", device=device)

    # Load SenseVoice ASR
    try:
        from funasr import AutoModel

        asr_model = AutoModel(
            model="iic/SenseVoiceSmall",
            vad_model="fsmn-vad",
            punc_model="ct-punc-c",
            device=device,
        )
        logger.info("SenseVoice ASR loaded")
    except Exception as e:
        logger.warning("Failed to load SenseVoice ASR", error=str(e))
        asr_model = None

    # Load CosyVoice TTS
    try:
        from cosyvoice import CosyVoice

        tts_model = CosyVoice("CosyVoice-300M-SFT")
        logger.info("CosyVoice TTS loaded")
    except Exception as e:
        logger.warning("Failed to load CosyVoice TTS", error=str(e))
        tts_model = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan handler."""
    logger.info("Starting Kairos Speech service", version=__version__)
    load_models()
    yield
    logger.info("Shutting down Kairos Speech service")


app = FastAPI(
    title="Kairos Speech Service",
    description="SenseVoice ASR + CosyVoice TTS for Chinese",
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


# Request/Response models
class TranscribeResponse(BaseModel):
    text: str
    language: str = "zh"
    confidence: float
    duration: float
    segments: list = []


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    voice: str = Field("中文女", description="Voice ID or name")
    speed: float = Field(1.0, ge=0.5, le=2.0)
    format: str = Field("wav", regex="^(wav|mp3|ogg)$")


class SynthesizeResponse(BaseModel):
    audio_base64: str
    duration: float
    sample_rate: int
    format: str


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    import torch

    return {
        "status": "ok",
        "version": __version__,
        "asr_loaded": asr_model is not None,
        "tts_loaded": tts_model is not None,
        "device": device,
        "gpu_available": torch.cuda.is_available(),
    }


@app.post("/asr/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("zh"),
):
    """Transcribe audio to text using SenseVoice."""
    if asr_model is None:
        raise HTTPException(status_code=503, detail="ASR model not loaded")

    try:
        import soundfile as sf

        # Read audio file
        audio_bytes = await audio.read()
        audio_data, sr = sf.read(io.BytesIO(audio_bytes))

        # Ensure mono
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1)

        # Transcribe
        result = asr_model.generate(
            input=audio_data,
            cache={},
            language=language,
            use_itn=True,
        )

        # Parse result
        if result and len(result) > 0:
            text = result[0].get("text", "")
            segments = result[0].get("segments", [])
        else:
            text = ""
            segments = []

        duration = len(audio_data) / sr

        return {
            "success": True,
            "data": {
                "text": text,
                "language": language,
                "confidence": 0.95,  # SenseVoice doesn't provide confidence
                "duration": duration,
                "segments": segments,
            },
        }

    except Exception as e:
        logger.error("Transcription failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tts/synthesize")
async def synthesize(request: SynthesizeRequest):
    """Synthesize speech from text using CosyVoice."""
    if tts_model is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")

    try:
        import soundfile as sf

        # Generate speech
        output = tts_model.inference_sft(
            request.text,
            request.voice,
            stream=False,
        )

        # Get audio data
        audio_data = output["tts_speech"].numpy()
        sample_rate = 22050  # CosyVoice default

        # Write to buffer
        buffer = io.BytesIO()
        sf.write(buffer, audio_data, sample_rate, format=request.format.upper())
        buffer.seek(0)

        # Encode to base64
        audio_base64 = base64.b64encode(buffer.read()).decode("utf-8")
        duration = len(audio_data) / sample_rate

        return {
            "success": True,
            "data": {
                "audio_base64": audio_base64,
                "duration": duration,
                "sample_rate": sample_rate,
                "format": request.format,
            },
        }

    except Exception as e:
        logger.error("Synthesis failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tts/synthesize/stream")
async def synthesize_stream(request: SynthesizeRequest):
    """Synthesize speech with streaming output."""
    if tts_model is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")

    async def generate():
        try:
            import soundfile as sf

            for chunk in tts_model.inference_sft(
                request.text,
                request.voice,
                stream=True,
            ):
                audio_data = chunk["tts_speech"].numpy()
                buffer = io.BytesIO()
                sf.write(buffer, audio_data, 22050, format="WAV")
                buffer.seek(0)
                yield buffer.read()

        except Exception as e:
            logger.error("Streaming synthesis failed", error=str(e))
            raise

    return StreamingResponse(
        generate(),
        media_type="audio/wav",
        headers={"Transfer-Encoding": "chunked"},
    )


@app.post("/tts/clone")
async def voice_clone(
    audio: UploadFile = File(...),
    text: str = Form(...),
):
    """Clone voice from audio and synthesize new text."""
    if tts_model is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")

    try:
        import soundfile as sf

        # Read reference audio
        audio_bytes = await audio.read()
        ref_audio, sr = sf.read(io.BytesIO(audio_bytes))

        # Generate with voice cloning
        output = tts_model.inference_cross_lingual(
            text,
            ref_audio,
            stream=False,
        )

        # Get audio data
        audio_data = output["tts_speech"].numpy()
        sample_rate = 22050

        # Write to buffer
        buffer = io.BytesIO()
        sf.write(buffer, audio_data, sample_rate, format="WAV")
        buffer.seek(0)

        audio_base64 = base64.b64encode(buffer.read()).decode("utf-8")
        duration = len(audio_data) / sample_rate

        return {
            "success": True,
            "data": {
                "audio_base64": audio_base64,
                "duration": duration,
                "sample_rate": sample_rate,
                "format": "wav",
            },
        }

    except Exception as e:
        logger.error("Voice cloning failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tts/voices")
async def list_voices():
    """List available TTS voices."""
    voices = [
        {"id": "中文女", "name": "Chinese Female", "language": "zh"},
        {"id": "中文男", "name": "Chinese Male", "language": "zh"},
        {"id": "英文女", "name": "English Female", "language": "en"},
        {"id": "英文男", "name": "English Male", "language": "en"},
        {"id": "日语男", "name": "Japanese Male", "language": "ja"},
        {"id": "粤语女", "name": "Cantonese Female", "language": "yue"},
        {"id": "韩语女", "name": "Korean Female", "language": "ko"},
    ]

    return {"success": True, "data": {"voices": voices}}


def start() -> None:
    """Start the server using uvicorn."""
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8003"))

    uvicorn.run(
        "src.server:app",
        host=host,
        port=port,
        workers=1,
    )


if __name__ == "__main__":
    start()
