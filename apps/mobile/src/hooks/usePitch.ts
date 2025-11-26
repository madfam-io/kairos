import { useState, useCallback } from 'react';
import { useAuthStore } from './useAuth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface PitchContour {
  f0: number[];
  times: number[];
  voiced_f0: number[];
  voiced_times: number[];
  duration: number;
}

export interface ToneAnalysis {
  detected_tone: number;
  tone_name: string;
  confidence: number;
  is_correct?: boolean;
  similarity_score?: number;
}

export interface PitchComparison {
  similarity: number;
  segment_scores: number[];
  reference_contour: number[];
  user_contour: number[];
}

interface UsePitchReturn {
  extractPitch: (audioUri: string) => Promise<PitchContour>;
  analyzeTone: (audioUri: string, expectedTone?: number) => Promise<ToneAnalysis>;
  comparePitch: (referenceUri: string, userUri: string) => Promise<PitchComparison>;
  loading: boolean;
  error: string | null;
}

export function usePitch(): UsePitchReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authStore = useAuthStore();

  const getAuthHeaders = useCallback(() => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }
    return {
      Authorization: `Bearer ${authStore.session.accessToken}`,
    };
  }, [authStore.session?.accessToken]);

  const uriToBlob = async (uri: string): Promise<Blob> => {
    const response = await fetch(uri);
    return response.blob();
  };

  const extractPitch = useCallback(async (audioUri: string): Promise<PitchContour> => {
    setLoading(true);
    setError(null);

    try {
      const blob = await uriToBlob(audioUri);
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');

      const response = await fetch(`${API_URL}/api/v1/pitch/extract`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to extract pitch');
      }

      const result = await response.json();
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pitch extraction failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const analyzeTone = useCallback(async (
    audioUri: string,
    expectedTone?: number
  ): Promise<ToneAnalysis> => {
    setLoading(true);
    setError(null);

    try {
      const blob = await uriToBlob(audioUri);
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');
      if (expectedTone !== undefined) {
        formData.append('expected_tone', expectedTone.toString());
      }

      const response = await fetch(`${API_URL}/api/v1/pitch/analyze-tone`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to analyze tone');
      }

      const result = await response.json();
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tone analysis failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const comparePitch = useCallback(async (
    referenceUri: string,
    userUri: string
  ): Promise<PitchComparison> => {
    setLoading(true);
    setError(null);

    try {
      const [refBlob, userBlob] = await Promise.all([
        uriToBlob(referenceUri),
        uriToBlob(userUri),
      ]);

      const formData = new FormData();
      formData.append('reference', refBlob, 'reference.wav');
      formData.append('user_audio', userBlob, 'user.wav');

      const response = await fetch(`${API_URL}/api/v1/pitch/compare`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to compare pitch');
      }

      const result = await response.json();
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pitch comparison failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  return {
    extractPitch,
    analyzeTone,
    comparePitch,
    loading,
    error,
  };
}
