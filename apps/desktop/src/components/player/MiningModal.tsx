import { useState, useEffect } from 'react';
import { X, Loader2, Check, BookOpen } from 'lucide-react';
import clsx from 'clsx';

import { useVocabularyStore } from '~/store/vocabulary';

interface MiningModalProps {
  isOpen: boolean;
  onClose: () => void;
  word: string;
  sentence: string;
  sourceTitle?: string;
  sourceTimestamp?: string;
}

interface WordInfo {
  word: string;
  pinyin: string | null;
  definitions: string[];
  hskLevel: number | null;
  examples: Array<{
    chinese: string;
    pinyin: string;
    english: string;
  }>;
}

export function MiningModal({
  isOpen,
  onClose,
  word,
  sentence,
  sourceTitle,
  sourceTimestamp,
}: MiningModalProps) {
  const { addWord, addCard, isWordKnown, markAsKnown } = useVocabularyStore();
  const [wordInfo, setWordInfo] = useState<WordInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editedSentence, setEditedSentence] = useState(sentence);

  const isKnown = isWordKnown(word);

  useEffect(() => {
    if (isOpen && word) {
      setEditedSentence(sentence);
      setSaved(false);
      fetchWordInfo(word);
    }
  }, [isOpen, word, sentence]);

  const fetchWordInfo = async (w: string) => {
    setLoading(true);
    try {
      // In a real app, this would call the API
      // For now, simulate with basic info
      setWordInfo({
        word: w,
        pinyin: null,
        definitions: [],
        hskLevel: null,
        examples: [],
      });
    } catch (error) {
      console.error('Failed to fetch word info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!wordInfo) return;

    // Add to vocabulary
    addWord({
      word: wordInfo.word,
      pinyin: wordInfo.pinyin,
      definitions: wordInfo.definitions,
      hskLevel: wordInfo.hskLevel,
      status: 'new',
      sentence: editedSentence,
      sourceTitle,
    });

    // Create flashcard
    addCard({
      word: wordInfo.word,
      sentence: editedSentence,
      pinyin: wordInfo.pinyin || undefined,
      definitions: wordInfo.definitions,
      sourceTitle,
      sourceTimestamp,
    });

    setSaved(true);
    setTimeout(onClose, 1000);
  };

  const handleMarkKnown = () => {
    markAsKnown(word);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <BookOpen size={20} className="text-kairos-500" />
            Mine Word
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={32} className="animate-spin text-kairos-500" />
            </div>
          ) : saved ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <Check size={32} className="text-green-500" />
              </div>
              <p className="text-lg font-medium">Card Created!</p>
              <p className="text-sm text-gray-400">Added "{word}" to your deck</p>
            </div>
          ) : (
            <>
              {/* Word display */}
              <div className="text-center py-4">
                <p className="text-4xl mb-2">{word}</p>
                {wordInfo?.pinyin && (
                  <p className="text-gray-400">{wordInfo.pinyin}</p>
                )}
                {wordInfo?.hskLevel && (
                  <span className="inline-block mt-2 text-xs px-2 py-1 bg-kairos-600 rounded">
                    HSK {wordInfo.hskLevel}
                  </span>
                )}
              </div>

              {/* Definitions */}
              {wordInfo?.definitions && wordInfo.definitions.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Definitions</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {wordInfo.definitions.map((def, i) => (
                      <li key={i}>{def}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sentence */}
              <div>
                <p className="text-sm text-gray-400 mb-2">Context Sentence</p>
                <textarea
                  value={editedSentence}
                  onChange={(e) => setEditedSentence(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-kairos-600 resize-none"
                  rows={3}
                />
              </div>

              {/* Source info */}
              {sourceTitle && (
                <div className="text-sm text-gray-400">
                  <span>From: {sourceTitle}</span>
                  {sourceTimestamp && <span> at {sourceTimestamp}</span>}
                </div>
              )}

              {/* Known word indicator */}
              {isKnown && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-sm text-yellow-400">
                    This word is already marked as known.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !saved && (
          <div className="flex items-center justify-between p-4 border-t border-gray-800">
            <button
              onClick={handleMarkKnown}
              className={clsx(
                'px-4 py-2 rounded-lg transition-colors',
                isKnown
                  ? 'bg-gray-800 text-gray-400'
                  : 'bg-gray-800 hover:bg-gray-700'
              )}
            >
              {isKnown ? 'Already Known' : 'Mark as Known'}
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-kairos-600 hover:bg-kairos-500 rounded-lg transition-colors"
              >
                Create Card
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
