import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, BookPlus, Copy, Check, ExternalLink } from 'lucide-react';
import type { Segment, UserSettings } from '@kairos/types';

interface WordTooltipProps {
  segment: Segment;
  anchorRect: DOMRect;
  settings?: UserSettings;
  onMine: () => void;
  onClose: () => void;
}

export function WordTooltip({
  segment,
  anchorRect,
  settings,
  onMine,
  onClose,
}: WordTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);

  // Calculate position to avoid going off-screen
  useEffect(() => {
    if (!tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 10;

    let x = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
    let y = anchorRect.top - tooltipRect.height - padding;

    // Keep within viewport
    if (x < padding) x = padding;
    if (x + tooltipRect.width > window.innerWidth - padding) {
      x = window.innerWidth - tooltipRect.width - padding;
    }

    // If tooltip would go above viewport, show below word
    if (y < padding) {
      y = anchorRect.bottom + padding;
    }

    setPosition({ x, y });
  }, [anchorRect]);

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(segment.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlayAudio = () => {
    // TODO: Play TTS audio
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = 'zh-CN';
    speechSynthesis.speak(utterance);
  };

  const handleOpenDict = () => {
    // Open in external dictionary (Pleco or online)
    window.open(`https://www.mdbg.net/chinese/dictionary?page=worddict&wdrst=0&wdqb=${encodeURIComponent(segment.text)}`, '_blank');
  };

  return (
    <motion.div
      ref={tooltipRef}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      transition={{ duration: 0.15 }}
      className="kairos-tooltip fixed"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header with word and pinyin */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-chinese">{segment.text}</span>
            {segment.hskLevel && (
              <span className="text-xs px-1.5 py-0.5 bg-kairos-600/30 text-kairos-300 rounded">
                HSK {segment.hskLevel}
              </span>
            )}
          </div>
          {segment.pinyin && (
            <p className="text-sm text-kairos-400 mt-0.5">{segment.pinyin}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePlayAudio}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Play pronunciation"
          >
            <Volume2 size={16} />
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check size={16} className="text-kairos-400" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Definition */}
      {segment.definition && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-sm text-gray-300">{segment.definition}</p>
        </div>
      )}

      {/* No definition yet */}
      {!segment.definition && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-sm text-gray-400 italic">No definition available</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
        <button
          onClick={onMine}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-kairos-600 hover:bg-kairos-500 rounded-lg text-sm transition-colors"
        >
          <BookPlus size={14} />
          Mine Card
        </button>
        <button
          onClick={handleOpenDict}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
        >
          <ExternalLink size={14} />
          Dictionary
        </button>
      </div>

      {/* Keyboard hint */}
      <div className="mt-2 text-xs text-gray-500">
        Press <kbd className="px-1 py-0.5 bg-white/10 rounded">M</kbd> to mine
      </div>
    </motion.div>
  );
}
