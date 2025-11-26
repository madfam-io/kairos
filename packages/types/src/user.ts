/**
 * User-related type definitions
 */

export interface User {
  id: string;
  email: string;
  createdAt: Date;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: Date | null;
  settings: UserSettings;
}

export type SubscriptionTier = 'free' | 'learner' | 'immersion';

export interface UserSettings {
  hskLevel: HSKLevel;
  showPinyin: boolean;
  autoPlayAudio: boolean;
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  simplificationEnabled: boolean;
  knownWordsHidden: boolean;
  keyboardShortcutsEnabled: boolean;
  locale: 'en' | 'zh-Hans' | 'zh-Hant';
}

export type HSKLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  subscriptionTier: SubscriptionTier;
  subscriptionExpiresAt: Date | null;
  settings: UserSettings;
  stats: UserStats;
}

export interface UserStats {
  totalWordsLearned: number;
  totalCardsMined: number;
  currentStreak: number;
  longestStreak: number;
  totalStudyTimeMinutes: number;
  lastActiveAt: Date | null;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  hskLevel: 4,
  showPinyin: true,
  autoPlayAudio: true,
  theme: 'system',
  fontSize: 'medium',
  simplificationEnabled: false,
  knownWordsHidden: true,
  keyboardShortcutsEnabled: true,
  locale: 'en',
};
