import { useState, useCallback } from 'react';
import { useAuthStore } from './useAuth';
import { useVocabularyStore } from './useVocabulary';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface SegmentedWord {
  text: string;
  pinyin: string | null;
  toneMarks: string | null;
  definitions: string[];
  hskLevel: number | null;
  pos: string | null;
  isPunctuation: boolean;
  isKnown: boolean;
}

export interface SegmentationResult {
  segments: SegmentedWord[];
  rawText: string;
  wordCount: number;
  processingTimeMs: number;
  fallback?: boolean;
}

export interface DictionaryEntry {
  word: string;
  pinyin: string | null;
  definitions: string[];
  hskLevel: number | null;
  traditional: string | null;
  found: boolean;
  examples: string[];
}

interface UseReaderReturn {
  // Segmentation
  segment: (text: string) => Promise<SegmentationResult>;
  segmentedContent: SegmentedWord[];

  // Dictionary
  lookup: (word: string) => Promise<DictionaryEntry>;

  // State
  loading: boolean;
  error: string | null;
}

export function useReader(): UseReaderReturn {
  const [segmentedContent, setSegmentedContent] = useState<SegmentedWord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authStore = useAuthStore();
  const vocabularyStore = useVocabularyStore();

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Auth is optional for segmentation
    if (authStore.session?.accessToken) {
      headers.Authorization = `Bearer ${authStore.session.accessToken}`;
    }

    return headers;
  }, [authStore.session?.accessToken]);

  // Get known words from vocabulary store
  const getKnownWords = useCallback(() => {
    return vocabularyStore.items
      .filter((item) => item.status === 'known' || item.status === 'learning')
      .map((item) => item.word);
  }, [vocabularyStore.items]);

  /**
   * Segment Chinese text into words with full metadata
   */
  const segment = useCallback(async (text: string): Promise<SegmentationResult> => {
    setLoading(true);
    setError(null);

    try {
      const knownWords = getKnownWords();

      const response = await fetch(`${API_URL}/api/v1/nlp/segment`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          text,
          knownWords,
          detectAmbiguity: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Segmentation failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Segmentation failed');
      }

      const segments = result.data.segments as SegmentedWord[];
      setSegmentedContent(segments);

      return {
        segments,
        rawText: result.data.rawText,
        wordCount: result.data.wordCount,
        processingTimeMs: result.data.processingTimeMs,
        fallback: result.data.fallback,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to segment text';
      setError(message);

      // Fallback to character-by-character segmentation
      const fallbackSegments = createFallbackSegments(text, getKnownWords());
      setSegmentedContent(fallbackSegments);

      return {
        segments: fallbackSegments,
        rawText: text,
        wordCount: fallbackSegments.filter((s) => !s.isPunctuation).length,
        processingTimeMs: 0,
        fallback: true,
      };
    } finally {
      setLoading(false);
    }
  }, [getHeaders, getKnownWords]);

  /**
   * Look up a word in the dictionary
   */
  const lookup = useCallback(async (word: string): Promise<DictionaryEntry> => {
    try {
      const response = await fetch(
        `${API_URL}/api/v1/nlp/dictionary/${encodeURIComponent(word)}`,
        {
          method: 'GET',
          headers: getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Dictionary lookup failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Dictionary lookup failed');
      }

      return result.data as DictionaryEntry;
    } catch (err) {
      // Return empty entry on error
      return {
        word,
        pinyin: null,
        definitions: [],
        hskLevel: null,
        traditional: null,
        found: false,
        examples: [],
      };
    }
  }, [getHeaders]);

  return {
    segment,
    segmentedContent,
    lookup,
    loading,
    error,
  };
}

/**
 * Create fallback character-by-character segmentation
 */
function createFallbackSegments(text: string, knownWords: string[]): SegmentedWord[] {
  const knownSet = new Set(knownWords);
  const segments: SegmentedWord[] = [];

  for (const char of text) {
    const isPunctuation = /[\s\u3000-\u303F\uFF00-\uFFEF，。！？、；：""''【】《》（）.,!?;:\n]/.test(char);

    segments.push({
      text: char,
      pinyin: null,
      toneMarks: null,
      definitions: [],
      hskLevel: null,
      pos: null,
      isPunctuation,
      isKnown: isPunctuation || knownSet.has(char),
    });
  }

  return segments;
}

export default useReader;
