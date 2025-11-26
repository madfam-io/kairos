"""Modal deployment for Kairos Speech Services.

- SenseVoice-Small: ASR (15x faster than Whisper, best Chinese accuracy)
- CosyVoice 2.0: TTS (150ms streaming latency, supports Chinese dialects)
- Fish Speech 1.5: TTS (highest quality, ELO 1339, 1.3% CER for Chinese)

Deploy with: modal deploy modal_speech.py
"""

import modal
from typing import Optional

# Define the Modal app
app = modal.App("kairos-speech")

# Shared model volume
model_volume = modal.Volume.from_name("kairos-speech-models", create_if_missing=True)

# ASR image with SenseVoice
asr_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1", "git")
    .pip_install(
        "torch>=2.0.0",
        "torchaudio>=2.0.0",
        "numpy>=1.24.0",
        "librosa>=0.10.0",
        "soundfile>=0.12.0",
        "funasr>=1.0.0",
        "modelscope>=1.9.0",
        "fastapi>=0.109.0",
        "pydantic>=2.5.0",
        "python-multipart>=0.0.6",
    )
)

# TTS image with CosyVoice
tts_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1", "git", "sox")
    .pip_install(
        "torch>=2.0.0",
        "torchaudio>=2.0.0",
        "numpy>=1.24.0",
        "soundfile>=0.12.0",
        "fastapi>=0.109.0",
        "pydantic>=2.5.0",
        "onnxruntime-gpu>=1.16.0",
        "transformers>=4.40.0",
        "scipy>=1.11.0",
    )
    .run_commands(
        "pip install git+https://github.com/FunAudioLLM/CosyVoice.git"
    )
)

# Fish Speech TTS image - highest quality Chinese TTS
fish_speech_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1", "git")
    .pip_install(
        "torch>=2.1.0",
        "torchaudio>=2.1.0",
        "numpy>=1.24.0",
        "soundfile>=0.12.0",
        "fastapi>=0.109.0",
        "pydantic>=2.5.0",
        "transformers>=4.40.0",
        "encodec>=0.1.1",
        "einops>=0.7.0",
        "hydra-core>=1.3.0",
        "scipy>=1.11.0",
    )
    .run_commands(
        "pip install fish-speech"
    )
)


# ============================================================================
# SenseVoice ASR Service
# ============================================================================

@app.cls(
    image=asr_image,
    gpu="T4",  # SenseVoice is very efficient
    timeout=120,
    container_idle_timeout=180,
    volumes={"/root/.cache": model_volume},
    allow_concurrent_inputs=32,
)
class SpeechRecognizer:
    """SenseVoice-powered speech recognition for Chinese."""

    @modal.enter()
    def load_model(self):
        """Load SenseVoice model."""
        from funasr import AutoModel

        print("Loading SenseVoice-Small model...")

        # SenseVoice-Small: optimized for Chinese/Cantonese
        self.model = AutoModel(
            model="iic/SenseVoiceSmall",
            trust_remote_code=True,
            device="cuda",
        )

        self.sample_rate = 16000
        print("SenseVoice loaded successfully!")

    @modal.method()
    def transcribe(
        self,
        audio_bytes: bytes,
        language: str = "zh",  # zh, en, ja, ko, yue (Cantonese)
    ) -> dict:
        """Transcribe audio to text."""
        import soundfile as sf
        import io
        import numpy as np

        # Load audio
        audio_data, sr = sf.read(io.BytesIO(audio_bytes))

        # Resample if needed
        if sr != self.sample_rate:
            import librosa
            audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=self.sample_rate)

        # Ensure mono
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1)

        # Run inference
        result = self.model.generate(
            input=audio_data,
            cache={},
            language=language,
            use_itn=True,  # Inverse text normalization (numbers, dates)
        )

        # Extract text and metadata
        text = result[0]["text"] if result else ""

        return {
            "text": text,
            "language": language,
            "duration": len(audio_data) / self.sample_rate,
            "sample_rate": self.sample_rate,
        }

    @modal.method()
    def transcribe_with_timestamps(
        self,
        audio_bytes: bytes,
        language: str = "zh",
    ) -> dict:
        """Transcribe with word-level timestamps."""
        import soundfile as sf
        import io

        # Load audio
        audio_data, sr = sf.read(io.BytesIO(audio_bytes))
        if sr != self.sample_rate:
            import librosa
            audio_data = librosa.resample(audio_data, orig_sr=sr, target_sr=self.sample_rate)
        if len(audio_data.shape) > 1:
            audio_data = audio_data.mean(axis=1)

        # Run with timestamps
        result = self.model.generate(
            input=audio_data,
            cache={},
            language=language,
            use_itn=True,
            return_timestamps=True,
        )

        if not result:
            return {"text": "", "segments": [], "duration": 0}

        # Parse segments
        segments = []
        if "segments" in result[0]:
            for seg in result[0]["segments"]:
                segments.append({
                    "text": seg.get("text", ""),
                    "start": seg.get("start", 0),
                    "end": seg.get("end", 0),
                })

        return {
            "text": result[0].get("text", ""),
            "segments": segments,
            "language": language,
            "duration": len(audio_data) / self.sample_rate,
        }

    @modal.method()
    def health(self) -> dict:
        return {"status": "ok", "model": "SenseVoice-Small"}


# ============================================================================
# CosyVoice TTS Service
# ============================================================================

@app.cls(
    image=tts_image,
    gpu="T4",
    timeout=120,
    container_idle_timeout=180,
    volumes={"/root/.cache": model_volume},
    allow_concurrent_inputs=16,
)
class SpeechSynthesizer:
    """CosyVoice 2.0 powered text-to-speech for Chinese."""

    @modal.enter()
    def load_model(self):
        """Load CosyVoice model."""
        print("Loading CosyVoice 2.0 model...")

        from cosyvoice import CosyVoice2

        # CosyVoice 2.0 - supports streaming, dialects, voice cloning
        self.model = CosyVoice2("CosyVoice2-0.5B")
        self.sample_rate = 22050

        print("CosyVoice loaded successfully!")

    @modal.method()
    def synthesize(
        self,
        text: str,
        speaker: str = "中文女",  # Built-in speakers
        speed: float = 1.0,
    ) -> bytes:
        """Synthesize speech from text."""
        import io
        import soundfile as sf

        # Generate audio
        audio_generator = self.model.inference_sft(
            text,
            speaker,
            stream=False,
        )

        # Collect audio chunks
        audio_chunks = []
        for chunk in audio_generator:
            audio_chunks.append(chunk["tts_speech"])

        import numpy as np
        audio = np.concatenate(audio_chunks)

        # Adjust speed if needed
        if speed != 1.0:
            import librosa
            audio = librosa.effects.time_stretch(audio, rate=speed)

        # Convert to bytes
        buffer = io.BytesIO()
        sf.write(buffer, audio, self.sample_rate, format="WAV")
        buffer.seek(0)

        return buffer.read()

    @modal.method()
    def synthesize_with_reference(
        self,
        text: str,
        reference_audio: bytes,
        reference_text: str,
    ) -> bytes:
        """Zero-shot voice cloning - synthesize in a reference voice."""
        import io
        import soundfile as sf
        import numpy as np

        # Load reference audio
        ref_audio, ref_sr = sf.read(io.BytesIO(reference_audio))
        if ref_sr != self.sample_rate:
            import librosa
            ref_audio = librosa.resample(ref_audio, orig_sr=ref_sr, target_sr=self.sample_rate)

        # Generate with voice cloning
        audio_generator = self.model.inference_zero_shot(
            text,
            reference_text,
            ref_audio,
            stream=False,
        )

        audio_chunks = []
        for chunk in audio_generator:
            audio_chunks.append(chunk["tts_speech"])

        audio = np.concatenate(audio_chunks)

        buffer = io.BytesIO()
        sf.write(buffer, audio, self.sample_rate, format="WAV")
        buffer.seek(0)

        return buffer.read()

    @modal.method()
    def list_speakers(self) -> list[str]:
        """List available built-in speakers."""
        return [
            "中文女",
            "中文男",
            "粤语女",
            "英文女",
            "英文男",
            "日语女",
            "韩语女",
        ]

    @modal.method()
    def health(self) -> dict:
        return {"status": "ok", "model": "CosyVoice2-0.5B"}


# ============================================================================
# Fish Speech TTS Service (Highest Quality)
# ============================================================================

@app.cls(
    image=fish_speech_image,
    gpu="A10G",  # Fish Speech benefits from more GPU memory
    timeout=120,
    container_idle_timeout=180,
    volumes={"/root/.cache": model_volume},
    allow_concurrent_inputs=8,
)
class FishSpeechSynthesizer:
    """Fish Speech 1.5 - highest quality Chinese TTS.

    Features:
    - ELO score 1339 in TTS Arena
    - 1.3% character error rate for Chinese
    - DualAR architecture for natural prosody
    - Zero-shot voice cloning

    Use for: High-quality vocabulary cards, reference audio
    """

    @modal.enter()
    def load_model(self):
        """Load Fish Speech model."""
        print("Loading Fish Speech 1.5 model...")

        from fish_speech.inference import TTSInference

        self.model = TTSInference(
            model_name="fishaudio/fish-speech-1.5",
            device="cuda",
        )
        self.sample_rate = 44100  # Fish Speech uses higher sample rate

        print("Fish Speech loaded successfully!")

    @modal.method()
    def synthesize(
        self,
        text: str,
        speaker: str = "default",
        speed: float = 1.0,
        temperature: float = 0.7,
    ) -> bytes:
        """Synthesize high-quality speech from text.

        Args:
            text: Chinese text to synthesize
            speaker: Speaker ID or "default"
            speed: Speech speed multiplier (0.5-2.0)
            temperature: Sampling temperature (0.1-1.0, higher = more expressive)
        """
        import io
        import soundfile as sf

        # Generate audio with Fish Speech
        audio = self.model.synthesize(
            text=text,
            speaker=speaker,
            speed=speed,
            temperature=temperature,
        )

        # Convert to bytes
        buffer = io.BytesIO()
        sf.write(buffer, audio, self.sample_rate, format="WAV")
        buffer.seek(0)

        return buffer.read()

    @modal.method()
    def synthesize_with_reference(
        self,
        text: str,
        reference_audio: bytes,
        reference_text: str | None = None,
        temperature: float = 0.7,
    ) -> bytes:
        """Zero-shot voice cloning with Fish Speech.

        Args:
            text: Text to synthesize
            reference_audio: Reference voice sample (3-10 seconds ideal)
            reference_text: Transcript of reference audio (optional, improves quality)
            temperature: Sampling temperature
        """
        import io
        import soundfile as sf
        import numpy as np

        # Load reference audio
        ref_audio, ref_sr = sf.read(io.BytesIO(reference_audio))

        # Resample reference if needed
        if ref_sr != self.sample_rate:
            import librosa
            ref_audio = librosa.resample(ref_audio, orig_sr=ref_sr, target_sr=self.sample_rate)

        # Ensure mono
        if len(ref_audio.shape) > 1:
            ref_audio = ref_audio.mean(axis=1)

        # Generate with voice cloning
        audio = self.model.synthesize(
            text=text,
            reference_audio=ref_audio,
            reference_text=reference_text,
            temperature=temperature,
        )

        buffer = io.BytesIO()
        sf.write(buffer, audio, self.sample_rate, format="WAV")
        buffer.seek(0)

        return buffer.read()

    @modal.method()
    def synthesize_vocabulary_card(
        self,
        word: str,
        sentence: str | None = None,
        include_pause: bool = True,
    ) -> bytes:
        """Generate audio for vocabulary flashcard.

        Optimized for learning:
        - Word pronounced clearly at natural pace
        - Optional example sentence
        - Pause between word and sentence

        Args:
            word: The vocabulary word
            sentence: Optional example sentence
            include_pause: Add 0.5s pause between word and sentence
        """
        import io
        import soundfile as sf
        import numpy as np

        # Synthesize word
        word_audio = self.model.synthesize(
            text=word,
            speed=0.9,  # Slightly slower for clarity
            temperature=0.5,  # Lower temp for consistent pronunciation
        )

        if sentence:
            # Synthesize sentence
            sentence_audio = self.model.synthesize(
                text=sentence,
                speed=1.0,
                temperature=0.7,
            )

            if include_pause:
                # Add 0.5 second pause
                pause = np.zeros(int(self.sample_rate * 0.5))
                audio = np.concatenate([word_audio, pause, sentence_audio])
            else:
                audio = np.concatenate([word_audio, sentence_audio])
        else:
            audio = word_audio

        buffer = io.BytesIO()
        sf.write(buffer, audio, self.sample_rate, format="WAV")
        buffer.seek(0)

        return buffer.read()

    @modal.method()
    def health(self) -> dict:
        return {
            "status": "ok",
            "model": "Fish-Speech-1.5",
            "sample_rate": self.sample_rate,
            "features": ["high_quality", "voice_cloning", "vocabulary_cards"],
        }


# ============================================================================
# FastAPI Web Application
# ============================================================================

@app.function(image=asr_image)
@modal.asgi_app()
def web_app():
    """Combined FastAPI for ASR and TTS."""
    from fastapi import FastAPI, HTTPException, UploadFile, File, Form
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import Response
    from pydantic import BaseModel
    from typing import Optional

    api = FastAPI(
        title="Kairos Speech API",
        description="SenseVoice ASR + CosyVoice TTS for Chinese learning",
        version="0.1.0",
    )

    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health checks
    @api.get("/health")
    async def health():
        return {"asr": "ok", "tts": "ok"}

    @api.get("/health/asr")
    async def health_asr():
        recognizer = SpeechRecognizer()
        return recognizer.health.remote()

    @api.get("/health/tts")
    async def health_tts():
        synthesizer = SpeechSynthesizer()
        return synthesizer.health.remote()

    # ASR endpoints
    @api.post("/asr/transcribe")
    async def transcribe(
        audio: UploadFile = File(...),
        language: str = Form("zh"),
    ):
        """Transcribe audio to text."""
        recognizer = SpeechRecognizer()
        audio_bytes = await audio.read()
        result = recognizer.transcribe.remote(audio_bytes, language)
        return {"success": True, "data": result}

    @api.post("/asr/transcribe-timestamps")
    async def transcribe_with_timestamps(
        audio: UploadFile = File(...),
        language: str = Form("zh"),
    ):
        """Transcribe with word timestamps."""
        recognizer = SpeechRecognizer()
        audio_bytes = await audio.read()
        result = recognizer.transcribe_with_timestamps.remote(audio_bytes, language)
        return {"success": True, "data": result}

    # TTS endpoints
    class TTSRequest(BaseModel):
        text: str
        speaker: str = "中文女"
        speed: float = 1.0

    @api.post("/tts/synthesize")
    async def synthesize(request: TTSRequest):
        """Synthesize speech from text."""
        synthesizer = SpeechSynthesizer()
        audio_bytes = synthesizer.synthesize.remote(
            request.text,
            request.speaker,
            request.speed,
        )
        return Response(content=audio_bytes, media_type="audio/wav")

    @api.post("/tts/clone")
    async def clone_voice(
        text: str = Form(...),
        reference_audio: UploadFile = File(...),
        reference_text: str = Form(...),
    ):
        """Synthesize with voice cloning."""
        synthesizer = SpeechSynthesizer()
        ref_bytes = await reference_audio.read()
        audio_bytes = synthesizer.synthesize_with_reference.remote(
            text, ref_bytes, reference_text
        )
        return Response(content=audio_bytes, media_type="audio/wav")

    @api.get("/tts/speakers")
    async def list_speakers():
        """List available TTS speakers."""
        synthesizer = SpeechSynthesizer()
        speakers = synthesizer.list_speakers.remote()
        return {"speakers": speakers}

    # Fish Speech endpoints (high-quality TTS)
    @api.get("/health/fish-speech")
    async def health_fish_speech():
        synthesizer = FishSpeechSynthesizer()
        return synthesizer.health.remote()

    class FishSpeechRequest(BaseModel):
        text: str
        speaker: str = "default"
        speed: float = 1.0
        temperature: float = 0.7

    @api.post("/tts/fish-speech/synthesize")
    async def fish_speech_synthesize(request: FishSpeechRequest):
        """Synthesize high-quality speech with Fish Speech 1.5.

        Use this for vocabulary cards and reference audio where quality matters.
        """
        synthesizer = FishSpeechSynthesizer()
        audio_bytes = synthesizer.synthesize.remote(
            request.text,
            request.speaker,
            request.speed,
            request.temperature,
        )
        return Response(content=audio_bytes, media_type="audio/wav")

    @api.post("/tts/fish-speech/clone")
    async def fish_speech_clone(
        text: str = Form(...),
        reference_audio: UploadFile = File(...),
        reference_text: Optional[str] = Form(None),
        temperature: float = Form(0.7),
    ):
        """Zero-shot voice cloning with Fish Speech."""
        synthesizer = FishSpeechSynthesizer()
        ref_bytes = await reference_audio.read()
        audio_bytes = synthesizer.synthesize_with_reference.remote(
            text, ref_bytes, reference_text, temperature
        )
        return Response(content=audio_bytes, media_type="audio/wav")

    class VocabularyCardRequest(BaseModel):
        word: str
        sentence: Optional[str] = None
        include_pause: bool = True

    @api.post("/tts/fish-speech/vocabulary-card")
    async def fish_speech_vocabulary_card(request: VocabularyCardRequest):
        """Generate high-quality audio for vocabulary flashcard.

        Optimized for learning with clear pronunciation.
        """
        synthesizer = FishSpeechSynthesizer()
        audio_bytes = synthesizer.synthesize_vocabulary_card.remote(
            request.word,
            request.sentence,
            request.include_pause,
        )
        return Response(content=audio_bytes, media_type="audio/wav")

    return api


# Local testing
@app.local_entrypoint()
def main():
    """Test speech services."""
    print("Testing SpeechRecognizer (SenseVoice)...")
    recognizer = SpeechRecognizer()
    print(recognizer.health.remote())

    print("\nTesting SpeechSynthesizer (CosyVoice)...")
    synthesizer = SpeechSynthesizer()
    print(synthesizer.health.remote())
    print("Available speakers:", synthesizer.list_speakers.remote())

    print("\nTesting FishSpeechSynthesizer (Fish Speech 1.5)...")
    fish_synthesizer = FishSpeechSynthesizer()
    print(fish_synthesizer.health.remote())
