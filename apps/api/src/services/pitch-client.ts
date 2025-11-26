/**
 * Client for Kairos Pitch Detection Service (FCPE)
 */

const PITCH_SERVICE_URL = process.env.PITCH_SERVICE_URL || 'https://kairos-pitch.modal.run';

export interface PitchContour {
  f0: number[];
  confidence: number[];
  times: number[];
  voiced_f0: number[];
  voiced_times: number[];
  sample_rate: number;
  hop_length: number;
  duration: number;
}

export interface ToneAnalysis {
  detected_tone: number;
  tone_name: string;
  confidence: number;
  contour_features: {
    start_pitch: number;
    mid_pitch: number;
    end_pitch: number;
    slope: number;
    range: number;
    std: number;
    min_position: number;
  };
  pitch_data: PitchContour;
  expected_tone?: number;
  is_correct?: boolean;
  similarity_score?: number;
}

export interface PitchComparison {
  similarity: number;
  segment_scores: number[];
  reference_contour: number[];
  user_contour: number[];
  reference_duration: number;
  user_duration: number;
}

/**
 * Extract pitch contour from audio
 */
export async function extractPitch(
  audioBuffer: ArrayBuffer,
  options: {
    hopLength?: number;
    threshold?: number;
  } = {}
): Promise<PitchContour> {
  const formData = new FormData();
  formData.append('audio', new Blob([audioBuffer]), 'audio.wav');

  if (options.hopLength) {
    formData.append('hop_length', options.hopLength.toString());
  }
  if (options.threshold) {
    formData.append('threshold', options.threshold.toString());
  }

  const response = await fetch(`${PITCH_SERVICE_URL}/extract`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Pitch extraction failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Analyze Mandarin tone from audio
 */
export async function analyzeTone(
  audioBuffer: ArrayBuffer,
  expectedTone?: number
): Promise<ToneAnalysis> {
  const formData = new FormData();
  formData.append('audio', new Blob([audioBuffer]), 'audio.wav');

  if (expectedTone) {
    formData.append('expected_tone', expectedTone.toString());
  }

  const response = await fetch(`${PITCH_SERVICE_URL}/analyze-tone`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Tone analysis failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Compare user pitch to reference for shadowing
 */
export async function comparePitch(
  referenceBuffer: ArrayBuffer,
  userBuffer: ArrayBuffer
): Promise<PitchComparison> {
  const formData = new FormData();
  formData.append('reference', new Blob([referenceBuffer]), 'reference.wav');
  formData.append('user_audio', new Blob([userBuffer]), 'user.wav');

  const response = await fetch(`${PITCH_SERVICE_URL}/compare`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Pitch comparison failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Health check
 */
export async function checkPitchHealth(): Promise<{ status: string; model: string }> {
  const response = await fetch(`${PITCH_SERVICE_URL}/health`);
  return response.json();
}
