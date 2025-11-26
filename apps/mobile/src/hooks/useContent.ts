import { useState, useCallback } from 'react';
import { useAuthStore } from './useAuth';
import { useVocabularyStore } from './useVocabulary';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface ContentAnalysis {
  difficulty: 'beginner' | 'elementary' | 'intermediate' | 'upper-intermediate' | 'advanced';
  estimatedHSKLevel: number;
  comprehensibility: number;
  vocabulary: {
    total: number;
    unique: number;
    knownCount: number;
    unknownCount: number;
    knownPercent: number;
  };
  hskDistribution: {
    level1: number;
    level2: number;
    level3: number;
    level4: number;
    level5: number;
    level6: number;
    beyond: number;
  };
  keyUnknownWords: Array<{
    word: string;
    pinyin: string | null;
    hskLevel: number | null;
    frequency: number;
  }>;
  estimatedReadingTime: number;
}

export interface ContentRecommendation {
  id: string;
  title: string;
  description: string;
  type: 'article' | 'video' | 'story' | 'dialogue';
  difficulty: ContentAnalysis['difficulty'];
  hskLevel: number;
  comprehensibility: number;
  duration?: number;
  thumbnailUrl?: string;
  sourceUrl?: string;
  tags: string[];
}

export interface LevelInfo {
  currentLevel: number;
  targetLevel: number;
  readyForNextLevel: boolean;
  vocabularyNeeded: number;
}

export interface ContentPreview {
  difficulty: ContentAnalysis['difficulty'];
  estimatedHSKLevel: number;
  comprehensibility: number;
  estimatedReadingTime: number;
  keyUnknownWords: Array<{
    word: string;
    pinyin: string | null;
    hskLevel: number | null;
    frequency: number;
  }>;
  recommendation: string;
}

interface UseContentReturn {
  // Analysis
  analyze: (text: string) => Promise<ContentAnalysis>;
  analysis: ContentAnalysis | null;

  // Recommendations
  getRecommendations: (options?: {
    limit?: number;
    type?: ContentRecommendation['type'];
    minComprehensibility?: number;
    maxComprehensibility?: number;
  }) => Promise<ContentRecommendation[]>;
  recommendations: ContentRecommendation[];

  // Level info
  getLevel: () => Promise<LevelInfo>;
  levelInfo: LevelInfo | null;

  // Preview
  preview: (options: {
    contentId?: string;
    url?: string;
    text?: string;
  }) => Promise<ContentPreview>;

  // State
  loading: boolean;
  error: string | null;
}

export function useContent(): UseContentReturn {
  const [analysis, setAnalysis] = useState<ContentAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<ContentRecommendation[]>([]);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authStore = useAuthStore();
  const vocabularyStore = useVocabularyStore();

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authStore.session?.accessToken) {
      headers.Authorization = `Bearer ${authStore.session.accessToken}`;
    }

    return headers;
  }, [authStore.session?.accessToken]);

  // Get known words from vocabulary
  const getKnownWords = useCallback(() => {
    return vocabularyStore.items
      .filter((item) => item.status === 'known' || item.status === 'learning')
      .map((item) => item.word);
  }, [vocabularyStore.items]);

  /**
   * Analyze content difficulty
   */
  const analyze = useCallback(async (text: string): Promise<ContentAnalysis> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/content/analyze`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          text,
          knownWords: getKnownWords(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Analysis failed');
      }

      setAnalysis(result.data);
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to analyze content';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getHeaders, getKnownWords]);

  /**
   * Get personalized content recommendations
   */
  const getRecommendations = useCallback(async (options?: {
    limit?: number;
    type?: ContentRecommendation['type'];
    minComprehensibility?: number;
    maxComprehensibility?: number;
  }): Promise<ContentRecommendation[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/content/recommendations`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(options || {}),
      });

      if (!response.ok) {
        throw new Error(`Recommendations failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get recommendations');
      }

      setRecommendations(result.data.recommendations);
      return result.data.recommendations;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get recommendations';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  /**
   * Get user's current level info
   */
  const getLevel = useCallback(async (): Promise<LevelInfo> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/content/level`, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Level check failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get level');
      }

      setLevelInfo(result.data);
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get level';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  /**
   * Preview content before reading
   */
  const preview = useCallback(async (options: {
    contentId?: string;
    url?: string;
    text?: string;
  }): Promise<ContentPreview> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/content/preview`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...options,
          knownWords: getKnownWords(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Preview failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to preview content');
      }

      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to preview content';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getHeaders, getKnownWords]);

  return {
    analyze,
    analysis,
    getRecommendations,
    recommendations,
    getLevel,
    levelInfo,
    preview,
    loading,
    error,
  };
}

export default useContent;
