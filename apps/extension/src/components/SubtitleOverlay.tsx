import { useState, useMemo, useCallback, useEffect } from 'react';
import { sendToBackground } from '@plasmohq/messaging';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserSettings, Segment } from '@kairos/types';

import { WordTooltip } from './WordTooltip';
import { useSegmentation } from '~/hooks/useSegmentation';

interface SubtitleOverlayProps {
  text: string;
  settings?: UserSettings;
  platform: 'netflix' | 'youtube';
  onWordClick?: (word: string, sentence: string) => void;
  onMine?: (word: string, sentence: string) => void;
}

export function SubtitleOverlay({
  text,
  settings,
  platform,
  onWordClick,
  onMine,
}: SubtitleOverlayProps) {
  const [hoveredWord, setHoveredWord] = useState<{
    segment: Segment;
    rect: DOMRect;
  } | null>(null);

  // Segment the Chinese text
  const { segments, isLoading, error } = useSegmentation(text);

  // Get font size based on settings
  const fontSize = useMemo(() => {
    switch (settings?.fontSize) {
      case 'small':
        return 'text-lg';
      case 'large':
        return 'text-3xl';
      default:
        return 'text-2xl';
    }
  }, [settings?.fontSize]);

  const handleWordHover = useCallback(
    (segment: Segment, event: React.MouseEvent<HTMLSpanElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setHoveredWord({ segment, rect });
    },
    []
  );

  const handleWordLeave = useCallback(() => {
    setHoveredWord(null);
  }, []);

  const handleWordClick = useCallback(
    (segment: Segment) => {
      onWordClick?.(segment.text, text);
    },
    [onWordClick, text]
  );

  const handleMine = useCallback(
    (segment: Segment) => {
      onMine?.(segment.text, text);
      setHoveredWord(null);
    },
    [onMine, text]
  );

  if (!text || error) {
    return null;
  }

  return (
    <div className="kairos-overlay relative">
      {/* Main subtitle display */}
      <div
        className={`
          ${fontSize} font-chinese text-white text-center
          bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2
          shadow-lg max-w-4xl mx-auto
        `}
      >
        {/* Original text with segmented words */}
        <div className="flex flex-wrap justify-center gap-0.5">
          {isLoading ? (
            // Show plain text while loading segmentation
            <span>{text}</span>
          ) : (
            segments.map((segment, index) => (
              <Word
                key={`${segment.text}-${index}`}
                segment={segment}
                settings={settings}
                onHover={handleWordHover}
                onLeave={handleWordLeave}
                onClick={() => handleWordClick(segment)}
              />
            ))
          )}
        </div>

        {/* Simplified version (if enabled) */}
        {settings?.simplificationEnabled && (
          <SimplifiedSubtitle text={text} targetLevel={settings.hskLevel} />
        )}
      </div>

      {/* Word tooltip */}
      <AnimatePresence>
        {hoveredWord && (
          <WordTooltip
            segment={hoveredWord.segment}
            anchorRect={hoveredWord.rect}
            settings={settings}
            onMine={() => handleMine(hoveredWord.segment)}
            onClose={() => setHoveredWord(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface WordProps {
  segment: Segment;
  settings?: UserSettings;
  onHover: (segment: Segment, event: React.MouseEvent<HTMLSpanElement>) => void;
  onLeave: () => void;
  onClick: () => void;
}

function Word({ segment, settings, onHover, onLeave, onClick }: WordProps) {
  // Determine if word should be hidden (known word)
  const isHidden = settings?.knownWordsHidden && segment.isKnown;

  // Don't highlight punctuation or known words
  const isPunctuation = /^[\p{P}\p{S}\s]+$/u.test(segment.text);

  if (isPunctuation) {
    return <span className="mx-0.5">{segment.text}</span>;
  }

  if (isHidden) {
    return (
      <span className="kairos-word known opacity-60">{segment.text}</span>
    );
  }

  return (
    <span
      className={`kairos-word relative ${segment.isKnown ? 'known' : 'unknown'}`}
      onMouseEnter={(e) => onHover(segment, e)}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {segment.text}
      {settings?.showPinyin && segment.pinyin && (
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-gray-300/80 whitespace-nowrap pointer-events-none">
          {segment.pinyin}
        </span>
      )}
    </span>
  );
}

interface SimplifiedSubtitleProps {
  text: string;
  targetLevel: number;
}

function SimplifiedSubtitle({ text, targetLevel }: SimplifiedSubtitleProps) {
  const [simplified, setSimplified] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch simplified version when text changes
  useEffect(() => {
    if (!text || text.length < 2) {
      setSimplified(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      try {
        const response = await sendToBackground({
          name: 'simplify-text',
          body: {
            text,
            targetLevel,
          },
        });

        if (cancelled) return;

        if (response?.success && response.data?.simplifiedText) {
          // Only show if different from original
          if (response.data.simplifiedText !== text) {
            setSimplified(response.data.simplifiedText);
          } else {
            setSimplified(null);
          }
        } else {
          setSimplified(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Simplification error:', err);
          setSimplified(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 300); // 300ms debounce

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [text, targetLevel]);

  if (isLoading) {
    return (
      <div className="kairos-simplified mt-2 pt-2 border-t border-white/20 animate-pulse">
        <span className="inline-block h-4 w-48 bg-white/20 rounded" />
      </div>
    );
  }

  if (!simplified) {
    return null;
  }

  return (
    <div className="kairos-simplified mt-2 pt-2 border-t border-white/20">
      <span className="text-xs text-kairos-400 mr-2">HSK {targetLevel}:</span>
      <span className="font-chinese">{simplified}</span>
    </div>
  );
}
