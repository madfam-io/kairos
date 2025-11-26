import { useState, useCallback } from 'react';
import clsx from 'clsx';

import { useSettingsStore } from '~/store/settings';
import { useVocabularyStore } from '~/store/vocabulary';
import type { Subtitle } from '~/store/video';

interface SubtitleOverlayProps {
  subtitle: Subtitle | null;
  simplified?: string | null;
  onWordClick?: (word: string, sentence: string) => void;
  onMineWord?: (word: string, sentence: string) => void;
}

interface WordSegment {
  text: string;
  pinyin: string | null;
  definition: string | null;
  hskLevel: number | null;
  isKnown: boolean;
}

export function SubtitleOverlay({
  subtitle,
  simplified,
  onWordClick,
  onMineWord,
}: SubtitleOverlayProps) {
  const { fontSize, showPinyin, highlightUnknown, targetHSKLevel, subtitlePosition } =
    useSettingsStore();
  const { isWordKnown } = useVocabularyStore();
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [showSimplified, setShowSimplified] = useState(false);

  const handleWordClick = useCallback(
    (word: string) => {
      if (subtitle && onWordClick) {
        onWordClick(word, subtitle.text);
      }
    },
    [subtitle, onWordClick]
  );

  const handleMine = useCallback(
    (word: string) => {
      if (subtitle && onMineWord) {
        onMineWord(word, subtitle.text);
      }
    },
    [subtitle, onMineWord]
  );

  if (!subtitle) return null;

  const segments = subtitle.segments || parseBasicSegments(subtitle.text);
  const displayText = showSimplified && simplified ? simplified : subtitle.text;

  const positionClasses = {
    bottom: 'bottom-16 left-1/2 -translate-x-1/2',
    top: 'top-16 left-1/2 -translate-x-1/2',
    side: 'right-4 top-1/2 -translate-y-1/2',
  };

  return (
    <div
      className={clsx(
        'absolute max-w-[80%] z-10',
        positionClasses[subtitlePosition]
      )}
    >
      <div className="bg-black/80 backdrop-blur-sm rounded-lg px-6 py-4">
        {/* Main subtitle */}
        <div
          className="flex flex-wrap justify-center gap-1"
          style={{ fontSize }}
        >
          {segments.map((segment, index) => (
            <WordSpan
              key={index}
              segment={segment}
              showPinyin={showPinyin}
              highlightUnknown={highlightUnknown}
              targetHSKLevel={targetHSKLevel}
              isKnown={isWordKnown(segment.text)}
              isHovered={hoveredWord === segment.text}
              onHover={() => setHoveredWord(segment.text)}
              onLeave={() => setHoveredWord(null)}
              onClick={() => handleWordClick(segment.text)}
              onMine={() => handleMine(segment.text)}
            />
          ))}
        </div>

        {/* Simplified version toggle */}
        {simplified && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => setShowSimplified(!showSimplified)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              {showSimplified ? 'Show original' : 'Show simplified'}
            </button>
            {showSimplified && (
              <p className="mt-2 text-base text-gray-300">{simplified}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface WordSpanProps {
  segment: WordSegment;
  showPinyin: boolean;
  highlightUnknown: boolean;
  targetHSKLevel: number;
  isKnown: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  onMine: () => void;
}

function WordSpan({
  segment,
  showPinyin,
  highlightUnknown,
  targetHSKLevel,
  isKnown,
  isHovered,
  onHover,
  onLeave,
  onClick,
  onMine,
}: WordSpanProps) {
  const isChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(segment.text);
  const isAboveLevel = segment.hskLevel && segment.hskLevel > targetHSKLevel;
  const shouldHighlight = highlightUnknown && !isKnown && isChinese;

  if (!isChinese) {
    return <span className="text-white">{segment.text}</span>;
  }

  return (
    <span
      className={clsx(
        'relative cursor-pointer transition-colors rounded px-0.5',
        shouldHighlight && 'text-kairos-400',
        isAboveLevel && 'underline decoration-dotted decoration-yellow-500',
        isHovered && 'bg-white/20'
      )}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      {/* Pinyin ruby */}
      {showPinyin && segment.pinyin && (
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">
          {segment.pinyin}
        </span>
      )}

      {/* Word text */}
      <span>{segment.text}</span>

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20">
          <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg">{segment.text}</span>
              {segment.hskLevel && (
                <span className="text-xs px-2 py-0.5 bg-kairos-600 rounded">
                  HSK {segment.hskLevel}
                </span>
              )}
            </div>
            {segment.pinyin && (
              <p className="text-sm text-gray-400 mb-1">{segment.pinyin}</p>
            )}
            {segment.definition && (
              <p className="text-sm text-gray-300">{segment.definition}</p>
            )}
            <div className="flex gap-2 mt-3 pt-2 border-t border-gray-700">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMine();
                }}
                className="flex-1 text-xs px-2 py-1 bg-kairos-600 hover:bg-kairos-500 rounded transition-colors"
              >
                Mine
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="flex-1 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                {isKnown ? 'Mark Unknown' : 'Mark Known'}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

function parseBasicSegments(text: string): WordSegment[] {
  const segments: WordSegment[] = [];
  const regex = /([\u4e00-\u9fff\u3400-\u4dbf]+|[^\u4e00-\u9fff\u3400-\u4dbf]+)/gu;
  const matches = text.matchAll(regex);

  for (const match of matches) {
    const matchText = match[0];
    const isChinese = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(matchText);

    if (isChinese) {
      // Split Chinese text into individual characters as basic segmentation
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
