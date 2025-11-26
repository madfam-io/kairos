import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Settings {
  targetHskLevel: number;
  showPinyin: boolean;
  dailyReminder: boolean;
  reminderTime: string;
  theme: 'dark' | 'light' | 'system';
  autoPlayAudio: boolean;
  newCardsPerDay: number;
  reviewsPerDay: number;
}

interface SettingsState {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  targetHskLevel: 4,
  showPinyin: true,
  dailyReminder: true,
  reminderTime: '09:00',
  theme: 'dark',
  autoPlayAudio: true,
  newCardsPerDay: 10,
  reviewsPerDay: 50,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      resetSettings: () =>
        set({ settings: defaultSettings }),
    }),
    {
      name: 'kairos-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export function useSettings() {
  const store = useSettingsStore();

  return {
    settings: store.settings,
    updateSettings: store.updateSettings,
    resetSettings: store.resetSettings,
  };
}
