import { useState, useEffect, useRef } from 'react';
import { sendToBackground } from '@plasmohq/messaging';
import type { Segment, SegmentationResult } from '@kairos/types';

interface UseSegmentationResult {
  segments: Segment[];
  isLoading: boolean;
  error: Error | null;
}

// Simple cache for segmentation results
const segmentationCache = new Map<string, Segment[]>();

/**
 * Hook to segment Chinese text into individual words
 */
export function useSegmentation(text: string): UseSegmentationResult {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!text || !containsChinese(text)) {
      setSegments([]);
      return;
    }

    // Check cache first
    const cached = segmentationCache.get(text);
    if (cached) {
      setSegments(cached);
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const segmentText = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First, try local segmentation (basic character-level)
        // This provides instant feedback while we wait for the API
        const basicSegments = basicSegmentation(text);
        setSegments(basicSegments);

        // Then, call the background script for proper segmentation
        const response = await sendToBackground({
          name: 'segment-text',
          body: { text },
        });

        if (response?.success && response.data?.segments) {
          const properSegments = response.data.segments as Segment[];
          setSegments(properSegments);
          segmentationCache.set(text, properSegments);
        }
      } catch (err) {
        // Don't set error if it was an abort
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Segmentation error:', err);
        setError(err instanceof Error ? err : new Error('Segmentation failed'));

        // Fallback to basic segmentation
        const fallbackSegments = basicSegmentation(text);
        setSegments(fallbackSegments);
      } finally {
        setIsLoading(false);
      }
    };

    segmentText();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [text]);

  return { segments, isLoading, error };
}

/**
 * Check if text contains Chinese characters
 */
function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}]/u.test(text);
}

/**
 * Basic character-level segmentation as fallback
 * This provides instant feedback before API response
 */
function basicSegmentation(text: string): Segment[] {
  const segments: Segment[] = [];
  let currentIndex = 0;

  // Simple regex to split by Chinese characters vs non-Chinese
  const regex = /([\u4e00-\u9fff\u3400-\u4dbf]+|[^\u4e00-\u9fff\u3400-\u4dbf]+)/gu;
  const matches = text.matchAll(regex);

  for (const match of matches) {
    const matchText = match[0];
    const isChinese = containsChinese(matchText);

    if (isChinese) {
      // For Chinese text, split into individual characters for now
      // The API will provide proper word segmentation
      for (const char of matchText) {
        segments.push({
          text: char,
          pinyin: null,
          definition: null,
          hskLevel: null,
          isProperNoun: false,
          isKnown: false,
          startIndex: currentIndex,
          endIndex: currentIndex + char.length,
        });
        currentIndex += char.length;
      }
    } else {
      // Non-Chinese text (punctuation, spaces, etc.)
      segments.push({
        text: matchText,
        pinyin: null,
        definition: null,
        hskLevel: null,
        isProperNoun: false,
        isKnown: true, // Don't highlight non-Chinese
        startIndex: currentIndex,
        endIndex: currentIndex + matchText.length,
      });
      currentIndex += matchText.length;
    }
  }

  return segments;
}

// Clear cache periodically to prevent memory issues
setInterval(() => {
  if (segmentationCache.size > 100) {
    // Keep most recent 50 entries
    const entries = Array.from(segmentationCache.entries());
    segmentationCache.clear();
    entries.slice(-50).forEach(([key, value]) => {
      segmentationCache.set(key, value);
    });
  }
}, 60000);
