import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { useVideoStore, type Subtitle } from '~/store/video';
import { useSettingsStore } from '~/store/settings';

interface ParsedSubtitle {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface UseSubtitlesOptions {
  videoPath: string | null;
  currentTime: number;
  onSubtitleChange?: (subtitle: Subtitle | null) => void;
}

interface UseSubtitlesReturn {
  subtitles: Subtitle[];
  currentSubtitle: Subtitle | null;
  currentIndex: number;
  loading: boolean;
  error: string | null;
  loadSubtitles: (path: string) => Promise<void>;
  seekToSubtitle: (index: number) => number;
  getNextSubtitle: () => Subtitle | null;
  getPreviousSubtitle: () => Subtitle | null;
}

export function useSubtitles({
  videoPath,
  currentTime,
  onSubtitleChange,
}: UseSubtitlesOptions): UseSubtitlesReturn {
  const { subtitles, setSubtitles, currentSubtitleIndex, setCurrentSubtitleIndex } =
    useVideoStore();
  const { apiUrl, accessToken, targetHSKLevel } = useSettingsStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevIndexRef = useRef<number>(-1);

  // Find current subtitle based on time
  useEffect(() => {
    if (subtitles.length === 0) {
      if (currentSubtitleIndex !== -1) {
        setCurrentSubtitleIndex(-1);
      }
      return;
    }

    const index = subtitles.findIndex(
      (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
    );

    if (index !== currentSubtitleIndex) {
      setCurrentSubtitleIndex(index);

      if (index !== prevIndexRef.current) {
        prevIndexRef.current = index;
        const subtitle = index >= 0 ? subtitles[index] : null;
        onSubtitleChange?.(subtitle);
      }
    }
  }, [currentTime, subtitles, currentSubtitleIndex, setCurrentSubtitleIndex, onSubtitleChange]);

  // Auto-load subtitles when video changes
  useEffect(() => {
    if (videoPath) {
      autoLoadSubtitles(videoPath);
    }
  }, [videoPath]);

  const autoLoadSubtitles = async (vidPath: string) => {
    // Try to find subtitle file with same name
    const subtitleExtensions = ['.srt', '.vtt', '.ass', '.ssa'];
    const basePath = vidPath.replace(/\.[^/.]+$/, '');

    for (const ext of subtitleExtensions) {
      try {
        await loadSubtitles(basePath + ext);
        return;
      } catch {
        // Try next extension
      }
    }
  };

  const loadSubtitles = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);

      try {
        // Call Tauri backend to parse subtitle file
        const parsed = await invoke<ParsedSubtitle[]>('parse_subtitles', {
          path,
        });

        // Segment Chinese text for each subtitle
        const segmentedSubtitles = await Promise.all(
          parsed.map(async (sub): Promise<Subtitle> => {
            try {
              const segments = await segmentText(sub.text);
              return {
                ...sub,
                segments,
              };
            } catch {
              return {
                ...sub,
                segments: undefined,
              };
            }
          })
        );

        setSubtitles(segmentedSubtitles);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load subtitles';
        setError(message);
        console.error('Failed to load subtitles:', err);
      } finally {
        setLoading(false);
      }
    },
    [setSubtitles]
  );

  const segmentText = async (
    text: string
  ): Promise<Subtitle['segments']> => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/nlp/segment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({
          text,
          targetLevel: targetHSKLevel,
        }),
      });

      if (!response.ok) {
        throw new Error('Segmentation failed');
      }

      const data = await response.json();
      return data.data?.segments;
    } catch {
      // Return basic character-level segmentation as fallback
      return basicSegmentation(text);
    }
  };

  const seekToSubtitle = useCallback(
    (index: number): number => {
      if (index >= 0 && index < subtitles.length) {
        return subtitles[index].startTime;
      }
      return 0;
    },
    [subtitles]
  );

  const getNextSubtitle = useCallback((): Subtitle | null => {
    const nextIndex = currentSubtitleIndex + 1;
    if (nextIndex < subtitles.length) {
      return subtitles[nextIndex];
    }
    return null;
  }, [subtitles, currentSubtitleIndex]);

  const getPreviousSubtitle = useCallback((): Subtitle | null => {
    const prevIndex = currentSubtitleIndex - 1;
    if (prevIndex >= 0) {
      return subtitles[prevIndex];
    }
    return null;
  }, [subtitles, currentSubtitleIndex]);

  const currentSubtitle =
    currentSubtitleIndex >= 0 ? subtitles[currentSubtitleIndex] : null;

  return {
    subtitles,
    currentSubtitle,
    currentIndex: currentSubtitleIndex,
    loading,
    error,
    loadSubtitles,
    seekToSubtitle,
    getNextSubtitle,
    getPreviousSubtitle,
  };
}

function basicSegmentation(text: string): Subtitle['segments'] {
  const segments: NonNullable<Subtitle['segments']> = [];
  const regex = /([\u4e00-\u9fff\u3400-\u4dbf]+|[^\u4e00-\u9fff\u3400-\u4dbf]+)/gu;
  const matches = text.matchAll(regex);

  for (const match of matches) {
    const matchText = match[0];
    const isChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(matchText);

    if (isChinese) {
      for (const char of matchText) {
        segments.push({
          text: char,
          pinyin: null,
          definition: null,
          hskLevel: null,
          isKnown: false,
        });
      }
    } else {
      segments.push({
        text: matchText,
        pinyin: null,
        definition: null,
        hskLevel: null,
        isKnown: true,
      });
    }
  }

  return segments;
}
