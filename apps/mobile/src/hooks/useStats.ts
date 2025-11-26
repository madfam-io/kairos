import { create } from 'zustand';
import { useEffect, useCallback } from 'react';
import { useAuthStore } from './useAuth';

export interface RecentWord {
  word: string;
  pinyin?: string;
  status: string;
}

export interface Stats {
  dueCards: number;
  reviewedToday: number;
  streak: number;
  knownWords: number;
  weeklyCards: number;
  totalCards: number;
  recentWords: RecentWord[];
}

interface StatsState {
  stats: Stats;
  loading: boolean;
  error: string | null;

  // Actions
  setStats: (stats: Stats) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const defaultStats: Stats = {
  dueCards: 0,
  reviewedToday: 0,
  streak: 0,
  knownWords: 0,
  weeklyCards: 0,
  totalCards: 0,
  recentWords: [],
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const useStatsStore = create<StatsState>((set) => ({
  stats: defaultStats,
  loading: false,
  error: null,

  setStats: (stats) => set({ stats }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

export function useStats() {
  const store = useStatsStore();
  const authStore = useAuthStore();

  const fetchStats = useCallback(async () => {
    if (!authStore.session?.accessToken) {
      return;
    }

    store.setLoading(true);
    store.setError(null);

    try {
      const response = await fetch(`${API_URL}/api/stats`, {
        headers: {
          Authorization: `Bearer ${authStore.session.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      store.setStats({
        dueCards: data.dueCards ?? 0,
        reviewedToday: data.reviewedToday ?? 0,
        streak: data.streak ?? 0,
        knownWords: data.knownWords ?? 0,
        weeklyCards: data.weeklyCards ?? 0,
        totalCards: data.totalCards ?? 0,
        recentWords: data.recentWords ?? [],
      });
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to fetch stats');
      // Set default stats on error
      store.setStats(defaultStats);
    } finally {
      store.setLoading(false);
    }
  }, [authStore.session?.accessToken]);

  useEffect(() => {
    if (authStore.isAuthenticated) {
      fetchStats();
    } else {
      store.setStats(defaultStats);
    }
  }, [authStore.isAuthenticated, fetchStats]);

  return {
    stats: store.stats,
    loading: store.loading,
    error: store.error,
    refresh: fetchStats,
  };
}
