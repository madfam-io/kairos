import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSettings, SubscriptionTier, Card } from '@kairos/types';

interface AuthState {
  isLoggedIn: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  userEmail: string | null;
  subscriptionTier: SubscriptionTier;
  setAuth: (
    accessToken: string,
    refreshToken: string,
    email: string,
    tier: SubscriptionTier
  ) => void;
  clearAuth: () => void;
}

interface SettingsState {
  settings: UserSettings;
  updateSettings: (partial: Partial<UserSettings>) => void;
  resetSettings: () => void;
}

interface MiningState {
  localCards: Card[];
  addCard: (card: Card) => void;
  removeCard: (id: string) => void;
  clearCards: () => void;
  pendingSyncCount: number;
}

interface StatsState {
  wordsLearnedToday: number;
  cardsMinedToday: number;
  currentStreak: number;
  lastActiveDate: string | null;
  incrementWordsLearned: () => void;
  incrementCardsMined: () => void;
  checkAndUpdateStreak: () => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  hskLevel: 4,
  showPinyin: true,
  autoPlayAudio: true,
  theme: 'dark',
  fontSize: 'medium',
  simplificationEnabled: false,
  knownWordsHidden: true,
  keyboardShortcutsEnabled: true,
  locale: 'en',
};

// Auth store
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      accessToken: null,
      refreshToken: null,
      userEmail: null,
      subscriptionTier: 'free',
      setAuth: (accessToken, refreshToken, email, tier) =>
        set({
          isLoggedIn: true,
          accessToken,
          refreshToken,
          userEmail: email,
          subscriptionTier: tier,
        }),
      clearAuth: () =>
        set({
          isLoggedIn: false,
          accessToken: null,
          refreshToken: null,
          userEmail: null,
          subscriptionTier: 'free',
        }),
    }),
    { name: 'kairos-auth' }
  )
);

// Settings store
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    { name: 'kairos-settings' }
  )
);

// Mining store
export const useMiningStore = create<MiningState>()(
  persist(
    (set, get) => ({
      localCards: [],
      pendingSyncCount: 0,
      addCard: (card) =>
        set((state) => ({
          localCards: [...state.localCards, card],
          pendingSyncCount: state.pendingSyncCount + 1,
        })),
      removeCard: (id) =>
        set((state) => ({
          localCards: state.localCards.filter((c) => c.id !== id),
        })),
      clearCards: () => set({ localCards: [], pendingSyncCount: 0 }),
    }),
    { name: 'kairos-mining' }
  )
);

// Stats store
export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      wordsLearnedToday: 0,
      cardsMinedToday: 0,
      currentStreak: 0,
      lastActiveDate: null,
      incrementWordsLearned: () =>
        set((state) => ({ wordsLearnedToday: state.wordsLearnedToday + 1 })),
      incrementCardsMined: () =>
        set((state) => ({ cardsMinedToday: state.cardsMinedToday + 1 })),
      checkAndUpdateStreak: () => {
        const today = new Date().toISOString().split('T')[0];
        const state = get();

        if (state.lastActiveDate === today) {
          // Already active today, no change
          return;
        }

        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        if (state.lastActiveDate === yesterday) {
          // Continuing streak
          set({
            currentStreak: state.currentStreak + 1,
            lastActiveDate: today,
            wordsLearnedToday: 0,
            cardsMinedToday: 0,
          });
        } else {
          // Streak broken or first day
          set({
            currentStreak: 1,
            lastActiveDate: today,
            wordsLearnedToday: 0,
            cardsMinedToday: 0,
          });
        }
      },
    }),
    { name: 'kairos-stats' }
  )
);

// Vocabulary store for known words
interface VocabularyState {
  knownWords: Set<string>;
  learningWords: Set<string>;
  addKnownWord: (word: string) => void;
  addLearningWord: (word: string) => void;
  removeWord: (word: string) => void;
  isKnown: (word: string) => boolean;
}

export const useVocabularyStore = create<VocabularyState>()(
  persist(
    (set, get) => ({
      knownWords: new Set(),
      learningWords: new Set(),
      addKnownWord: (word) =>
        set((state) => ({
          knownWords: new Set([...state.knownWords, word]),
          learningWords: new Set([...state.learningWords].filter((w) => w !== word)),
        })),
      addLearningWord: (word) =>
        set((state) => ({
          learningWords: new Set([...state.learningWords, word]),
        })),
      removeWord: (word) =>
        set((state) => ({
          knownWords: new Set([...state.knownWords].filter((w) => w !== word)),
          learningWords: new Set([...state.learningWords].filter((w) => w !== word)),
        })),
      isKnown: (word) => get().knownWords.has(word),
    }),
    {
      name: 'kairos-vocabulary',
      // Custom serialization for Set
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          return {
            ...data,
            state: {
              ...data.state,
              knownWords: new Set(data.state.knownWords || []),
              learningWords: new Set(data.state.learningWords || []),
            },
          };
        },
        setItem: (name, value) => {
          const data = {
            ...value,
            state: {
              ...value.state,
              knownWords: [...value.state.knownWords],
              learningWords: [...value.state.learningWords],
            },
          };
          localStorage.setItem(name, JSON.stringify(data));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
