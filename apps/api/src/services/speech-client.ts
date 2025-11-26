/**
 * Client for Kairos Speech Services (SenseVoice ASR + CosyVoice TTS)
 */

const SPEECH_SERVICE_URL = process.env.SPEECH_SERVICE_URL || 'https://kairos-speech.modal.run';

// ============================================================================
// ASR Types
// ============================================================================

export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  sample_rate?: number;
}

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptionWithTimestamps {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  duration: number;
}

export type SupportedLanguage = 'zh' | 'en' | 'ja' | 'ko' | 'yue';

// ============================================================================
// TTS Types
// ============================================================================

export type TTSSpeaker =
  | '中文女'
  | '中文男'
  | '粤语女'
  | '英文女'
  | '英文男'
  | '日语女'
  | '韩语女';

export interface TTSOptions {
  speaker?: TTSSpeaker;
  speed?: number;
}

// ============================================================================
// ASR Functions
// ============================================================================

/**
 * Transcribe audio to text using SenseVoice
 */
export async function transcribe(
  audioBuffer: ArrayBuffer,
  language: SupportedLanguage = 'zh'
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append('audio', new Blob([audioBuffer]), 'audio.wav');
  formData.append('language', language);

  const response = await fetch(`${SPEECH_SERVICE_URL}/asr/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Transcribe with word-level timestamps
 */
export async function transcribeWithTimestamps(
  audioBuffer: ArrayBuffer,
  language: SupportedLanguage = 'zh'
): Promise<TranscriptionWithTimestamps> {
  const formData = new FormData();
  formData.append('audio', new Blob([audioBuffer]), 'audio.wav');
  formData.append('language', language);

  const response = await fetch(`${SPEECH_SERVICE_URL}/asr/transcribe-timestamps`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

// ============================================================================
// TTS Functions
// ============================================================================

/**
 * Synthesize speech from text using CosyVoice
 */
export async function synthesize(
  text: string,
  options: TTSOptions = {}
): Promise<ArrayBuffer> {
  const response = await fetch(`${SPEECH_SERVICE_URL}/tts/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      speaker: options.speaker || '中文女',
      speed: options.speed || 1.0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Speech synthesis failed: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

/**
 * Synthesize with voice cloning
 */
export async function synthesizeWithCloning(
  text: string,
  referenceAudio: ArrayBuffer,
  referenceText: string
): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('reference_audio', new Blob([referenceAudio]), 'reference.wav');
  formData.append('reference_text', referenceText);

  const response = await fetch(`${SPEECH_SERVICE_URL}/tts/clone`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Voice cloning failed: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

/**
 * List available TTS speakers
 */
export async function listSpeakers(): Promise<TTSSpeaker[]> {
  const response = await fetch(`${SPEECH_SERVICE_URL}/tts/speakers`);

  if (!response.ok) {
    throw new Error(`Failed to list speakers: ${response.statusText}`);
  }

  const result = await response.json();
  return result.speakers;
}

// ============================================================================
// Health Checks
// ============================================================================

export async function checkASRHealth(): Promise<{ status: string; model: string }> {
  const response = await fetch(`${SPEECH_SERVICE_URL}/health/asr`);
  return response.json();
}

export async function checkTTSHealth(): Promise<{ status: string; model: string }> {
  const response = await fetch(`${SPEECH_SERVICE_URL}/health/tts`);
  return response.json();
}

export async function checkSpeechHealth(): Promise<{ asr: string; tts: string }> {
  const response = await fetch(`${SPEECH_SERVICE_URL}/health`);
  return response.json();
}
