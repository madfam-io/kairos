import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, Check, BookPlus, Edit3, Camera, Mic } from 'lucide-react';
import { sendToBackground } from '@plasmohq/messaging';
import type { Segment, UserSettings } from '@kairos/types';

interface MiningModalProps {
  isOpen: boolean;
  onClose: () => void;
  word: string;
  sentence: string;
  segment?: Segment;
  settings?: UserSettings;
  platform: 'netflix' | 'youtube';
}

export function MiningModal({
  isOpen,
  onClose,
  word,
  sentence,
  segment,
  settings,
  platform,
}: MiningModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [editedSentence, setEditedSentence] = useState(sentence);
  const [simplifiedSentence, setSimplifiedSentence] = useState<string | null>(null);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setEditedSentence(sentence);
    setSuccess(false);
  }, [sentence, word]);

  // Fetch simplified version if enabled
  useEffect(() => {
    if (settings?.simplificationEnabled && sentence) {
      sendToBackground({
        name: 'simplify-text',
        body: {
          text: sentence,
          targetLevel: settings.hskLevel,
        },
      }).then((response) => {
        if (response?.success && response.data?.simplifiedText) {
          setSimplifiedSentence(response.data.simplifiedText);
        }
      });
    }
  }, [sentence, settings]);

  const handleMine = async () => {
    setIsLoading(true);

    try {
      // Get current video title and timestamp
      let sourceTitle: string | undefined;
      let sourceTimestamp: string | undefined;

      if (platform === 'netflix') {
        sourceTitle = document.querySelector('.video-title')?.textContent || undefined;
        // Netflix doesn't expose timestamp easily
      } else if (platform === 'youtube') {
        sourceTitle = document.querySelector('#title h1')?.textContent || undefined;
        const video = document.querySelector('video');
        if (video) {
          const seconds = Math.floor(video.currentTime);
          sourceTimestamp = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        }
      }

      const response = await sendToBackground({
        name: 'mine-word',
        body: {
          word,
          sentence: editedSentence,
          simplifiedSentence,
          sourceTitle,
          sourceTimestamp,
        },
      });

      if (response?.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Mining error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = () => {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'zh-CN';
    speechSynthesis.speak(utterance);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="kairos-overlay bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h2 className="font-semibold">Mine Card</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Word */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-chinese">{word}</span>
                  {segment?.hskLevel && (
                    <span className="text-xs px-1.5 py-0.5 bg-kairos-600/30 text-kairos-300 rounded">
                      HSK {segment.hskLevel}
                    </span>
                  )}
                </div>
                {segment?.pinyin && (
                  <p className="text-sm text-kairos-400 mt-1">{segment.pinyin}</p>
                )}
                {segment?.definition && (
                  <p className="text-sm text-gray-400 mt-1">{segment.definition}</p>
                )}
              </div>
              <button
                onClick={handlePlayAudio}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Volume2 size={20} />
              </button>
            </div>

            {/* Sentence */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">
                Sentence
              </label>
              <div className="relative">
                <textarea
                  value={editedSentence}
                  onChange={(e) => setEditedSentence(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-chinese resize-none focus:outline-none focus:border-kairos-500"
                  rows={2}
                />
                <Edit3 size={14} className="absolute right-2 bottom-2 text-gray-500" />
              </div>
            </div>

            {/* Simplified sentence */}
            {simplifiedSentence && (
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1.5 block">
                  Simplified (HSK {settings?.hskLevel})
                </label>
                <div className="bg-kairos-900/30 border border-kairos-600/30 rounded-lg px-3 py-2 text-sm font-chinese text-kairos-300">
                  {simplifiedSentence}
                </div>
              </div>
            )}

            {/* Options */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeScreenshot}
                  onChange={(e) => setIncludeScreenshot(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-kairos-600 focus:ring-kairos-500"
                />
                <Camera size={16} className="text-gray-400" />
                <span className="text-sm">Screenshot</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAudio}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-kairos-600 focus:ring-kairos-500"
                />
                <Mic size={16} className="text-gray-400" />
                <span className="text-sm">Audio</span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/10 bg-white/5">
            {success ? (
              <div className="flex items-center justify-center gap-2 text-kairos-400">
                <Check size={20} />
                <span>Card mined successfully!</span>
              </div>
            ) : (
              <button
                onClick={handleMine}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-kairos-600 hover:bg-kairos-500 disabled:bg-kairos-600/50 rounded-lg font-medium transition-colors"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <BookPlus size={18} />
                    Mine Card
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
