import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface VocabularyWord {
  id: string;
  word: string;
  pinyin: string | null;
  definitions: string[];
  hskLevel: number | null;
  status: 'new' | 'learning' | 'known';
  encounters: number;
  lastSeen: Date;
  addedAt: Date;
  sentence?: string;
  sourceTitle?: string;
}

export interface Card {
  id: string;
  word: string;
  sentence: string;
  simplifiedSentence?: string;
  pinyin?: string;
  definitions: string[];
  sourceTitle?: string;
  sourceTimestamp?: string;
  createdAt: Date;
  nextReview?: Date;
  interval: number;
  easeFactor: number;
  repetitions: number;
}

interface VocabularyState {
  words: VocabularyWord[];
  cards: Card[];
  knownWords: Set<string>;

  addWord: (word: Omit<VocabularyWord, 'id' | 'encounters' | 'lastSeen' | 'addedAt'>) => void;
  updateWordStatus: (id: string, status: VocabularyWord['status']) => void;
  incrementEncounter: (word: string) => void;
  removeWord: (id: string) => void;

  addCard: (card: Omit<Card, 'id' | 'createdAt' | 'interval' | 'easeFactor' | 'repetitions'>) => void;
  updateCardReview: (id: string, quality: number) => void;
  removeCard: (id: string) => void;
  getDueCards: () => Card[];

  markAsKnown: (word: string) => void;
  markAsUnknown: (word: string) => void;
  isWordKnown: (word: string) => boolean;

  getStats: () => {
    totalWords: number;
    knownWords: number;
    learningWords: number;
    newWords: number;
    totalCards: number;
    dueCards: number;
  };
}

export const useVocabularyStore = create<VocabularyState>()(
  persist(
    (set, get) => ({
      words: [],
      cards: [],
      knownWords: new Set<string>(),

      addWord: (wordData) => {
        const id = `word-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const now = new Date();
        set((state) => ({
          words: [
            ...state.words.filter((w) => w.word !== wordData.word),
            {
              ...wordData,
              id,
              encounters: 1,
              lastSeen: now,
              addedAt: now,
            },
          ],
        }));
      },

      updateWordStatus: (id, status) => {
        set((state) => {
          const word = state.words.find((w) => w.id === id);
          const newKnownWords = new Set(state.knownWords);

          if (word) {
            if (status === 'known') {
              newKnownWords.add(word.word);
            } else {
              newKnownWords.delete(word.word);
            }
          }

          return {
            words: state.words.map((w) =>
              w.id === id ? { ...w, status } : w
            ),
            knownWords: newKnownWords,
          };
        });
      },

      incrementEncounter: (word) => {
        set((state) => ({
          words: state.words.map((w) =>
            w.word === word
              ? { ...w, encounters: w.encounters + 1, lastSeen: new Date() }
              : w
          ),
        }));
      },

      removeWord: (id) => {
        set((state) => ({
          words: state.words.filter((w) => w.id !== id),
        }));
      },

      addCard: (cardData) => {
        const id = `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          cards: [
            ...state.cards,
            {
              ...cardData,
              id,
              createdAt: new Date(),
              interval: 1,
              easeFactor: 2.5,
              repetitions: 0,
            },
          ],
        }));
      },

      updateCardReview: (id, quality) => {
        set((state) => ({
          cards: state.cards.map((card) => {
            if (card.id !== id) return card;

            // SM-2 algorithm
            let { interval, easeFactor, repetitions } = card;

            if (quality >= 3) {
              if (repetitions === 0) {
                interval = 1;
              } else if (repetitions === 1) {
                interval = 6;
              } else {
                interval = Math.round(interval * easeFactor);
              }
              repetitions++;
            } else {
              repetitions = 0;
              interval = 1;
            }

            easeFactor = Math.max(
              1.3,
              easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
            );

            const nextReview = new Date();
            nextReview.setDate(nextReview.getDate() + interval);

            return {
              ...card,
              interval,
              easeFactor,
              repetitions,
              nextReview,
            };
          }),
        }));
      },

      removeCard: (id) => {
        set((state) => ({
          cards: state.cards.filter((c) => c.id !== id),
        }));
      },

      getDueCards: () => {
        const now = new Date();
        return get().cards.filter(
          (card) => !card.nextReview || card.nextReview <= now
        );
      },

      markAsKnown: (word) => {
        set((state) => {
          const newKnownWords = new Set(state.knownWords);
          newKnownWords.add(word);
          return { knownWords: newKnownWords };
        });
      },

      markAsUnknown: (word) => {
        set((state) => {
          const newKnownWords = new Set(state.knownWords);
          newKnownWords.delete(word);
          return { knownWords: newKnownWords };
        });
      },

      isWordKnown: (word) => get().knownWords.has(word),

      getStats: () => {
        const state = get();
        const now = new Date();
        return {
          totalWords: state.words.length,
          knownWords: state.words.filter((w) => w.status === 'known').length,
          learningWords: state.words.filter((w) => w.status === 'learning').length,
          newWords: state.words.filter((w) => w.status === 'new').length,
          totalCards: state.cards.length,
          dueCards: state.cards.filter(
            (c) => !c.nextReview || c.nextReview <= now
          ).length,
        };
      },
    }),
    {
      name: 'kairos-vocabulary-storage',
      partialize: (state) => ({
        words: state.words,
        cards: state.cards,
        knownWords: Array.from(state.knownWords),
      }),
      merge: (persistedState: unknown, currentState) => {
        const persisted = persistedState as {
          words?: VocabularyWord[];
          cards?: Card[];
          knownWords?: string[];
        };
        return {
          ...currentState,
          words: persisted?.words || [],
          cards: persisted?.cards || [],
          knownWords: new Set(persisted?.knownWords || []),
        };
      },
    }
  )
);
