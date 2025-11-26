import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type SubtitlePosition = 'bottom' | 'top' | 'side';
export type HSKLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface SettingsState {
  // Appearance
  theme: Theme;
  fontSize: number;
  subtitlePosition: SubtitlePosition;

  // Learning
  targetHSKLevel: HSKLevel;
  showPinyin: boolean;
  showDefinitions: boolean;
  autoSimplify: boolean;
  highlightUnknown: boolean;

  // Playback
  autoPause: boolean;
  pauseOnUnknown: boolean;
  repeatCount: number;

  // Sync
  apiUrl: string;
  accessToken: string | null;

  // Actions
  setTheme: (theme: Theme) => void;
  setFontSize: (size: number) => void;
  setSubtitlePosition: (position: SubtitlePosition) => void;
  setTargetHSKLevel: (level: HSKLevel) => void;
  setShowPinyin: (show: boolean) => void;
  setShowDefinitions: (show: boolean) => void;
  setAutoSimplify: (auto: boolean) => void;
  setHighlightUnknown: (highlight: boolean) => void;
  setAutoPause: (auto: boolean) => void;
  setPauseOnUnknown: (pause: boolean) => void;
  setRepeatCount: (count: number) => void;
  setApiUrl: (url: string) => void;
  setAccessToken: (token: string | null) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  theme: 'dark' as Theme,
  fontSize: 24,
  subtitlePosition: 'bottom' as SubtitlePosition,
  targetHSKLevel: 3 as HSKLevel,
  showPinyin: true,
  showDefinitions: true,
  autoSimplify: true,
  highlightUnknown: true,
  autoPause: false,
  pauseOnUnknown: false,
  repeatCount: 1,
  apiUrl: 'https://api.kairos.dev',
  accessToken: null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize: Math.max(12, Math.min(48, fontSize)) }),
      setSubtitlePosition: (subtitlePosition) => set({ subtitlePosition }),
      setTargetHSKLevel: (targetHSKLevel) => set({ targetHSKLevel }),
      setShowPinyin: (showPinyin) => set({ showPinyin }),
      setShowDefinitions: (showDefinitions) => set({ showDefinitions }),
      setAutoSimplify: (autoSimplify) => set({ autoSimplify }),
      setHighlightUnknown: (highlightUnknown) => set({ highlightUnknown }),
      setAutoPause: (autoPause) => set({ autoPause }),
      setPauseOnUnknown: (pauseOnUnknown) => set({ pauseOnUnknown }),
      setRepeatCount: (repeatCount) => set({ repeatCount: Math.max(1, Math.min(10, repeatCount)) }),
      setApiUrl: (apiUrl) => set({ apiUrl }),
      setAccessToken: (accessToken) => set({ accessToken }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'kairos-settings-storage',
    }
  )
);
