import { useState, useCallback } from 'react';
import { useAuthStore } from './useAuth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface DailyStat {
  date: string;
  wordsLearned: number;
  wordsReviewed: number;
  cardsMined: number;
  studyTimeMinutes: number;
  sessionsCount: number;
}

export interface ProgressData {
  wordsLearned: DailyStat[];
  hskProgress: Array<{
    date: string;
    level: number;
    vocabularySize: number;
  }>;
  reviewAccuracy: Array<{
    date: string;
    correct: number;
    total: number;
    accuracy: number;
  }>;
  streakHistory: Array<{
    startDate: string;
    endDate: string;
    length: number;
  }>;
}

export interface SummaryStats {
  today: {
    wordsLearned: number;
    wordsReviewed: number;
    cardsMined: number;
    studyTimeMinutes: number;
    simplificationsUsed: number;
    reviewAccuracy: number;
  };
  thisWeek: {
    wordsLearned: number;
    wordsReviewed: number;
    cardsMined: number;
    studyTimeMinutes: number;
    averageSessionMinutes: number;
    averageAccuracy: number;
  };
  thisMonth: {
    wordsLearned: number;
    wordsReviewed: number;
    cardsMined: number;
    studyTimeMinutes: number;
    daysActive: number;
  };
  allTime: {
    totalWordsLearned: number;
    totalWordsReviewed: number;
    totalCardsMined: number;
    totalStudyTimeHours: number;
    longestStreak: number;
    currentStreak: number;
    accountAgeInDays: number;
  };
  streakStatus: {
    current: number;
    longest: number;
    todayCompleted: boolean;
    nextMilestone: number;
  };
  hskLevel: {
    current: number;
    progress: number;
    vocabularySize: number;
  };
}

export interface HeatmapData {
  days: Record<string, number>;
  maxActivity: number;
  totalActiveDays: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  progress: number;
  target: number;
  icon: string;
}

export type EventType =
  | 'session_start'
  | 'session_end'
  | 'video_play'
  | 'video_pause'
  | 'word_lookup'
  | 'card_mined'
  | 'card_exported'
  | 'simplification_used'
  | 'pitch_practice'
  | 'settings_changed'
  | 'error_occurred'
  | 'reader_opened'
  | 'shadowing_completed';

interface UseAnalyticsReturn {
  // Data fetching
  getSummary: () => Promise<SummaryStats>;
  getProgress: (options?: {
    startDate?: string;
    endDate?: string;
    granularity?: 'day' | 'week' | 'month';
  }) => Promise<ProgressData>;
  getHeatmap: () => Promise<HeatmapData>;
  getMilestones: () => Promise<Milestone[]>;

  // Event tracking
  trackEvent: (eventType: EventType, eventData?: Record<string, unknown>) => Promise<void>;

  // State
  summary: SummaryStats | null;
  progress: ProgressData | null;
  heatmap: HeatmapData | null;
  milestones: Milestone[];
  loading: boolean;
  error: string | null;
}

export function useAnalytics(): UseAnalyticsReturn {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authStore = useAuthStore();

  const getAuthHeaders = useCallback(() => {
    if (!authStore.session?.accessToken) {
      throw new Error('Not authenticated');
    }
    return {
      Authorization: `Bearer ${authStore.session.accessToken}`,
      'Content-Type': 'application/json',
    };
  }, [authStore.session?.accessToken]);

  /**
   * Get summary stats
   */
  const getSummary = useCallback(async (): Promise<SummaryStats> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/analytics/summary`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get summary: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get summary');
      }

      setSummary(result.data);
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get summary';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  /**
   * Get progress data
   */
  const getProgress = useCallback(async (options?: {
    startDate?: string;
    endDate?: string;
    granularity?: 'day' | 'week' | 'month';
  }): Promise<ProgressData> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options?.startDate) params.set('startDate', options.startDate);
      if (options?.endDate) params.set('endDate', options.endDate);
      if (options?.granularity) params.set('granularity', options.granularity);

      const response = await fetch(
        `${API_URL}/api/v1/analytics/progress?${params.toString()}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get progress: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get progress');
      }

      setProgress(result.data);
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get progress';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  /**
   * Get heatmap data
   */
  const getHeatmap = useCallback(async (): Promise<HeatmapData> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/analytics/heatmap`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get heatmap: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get heatmap');
      }

      setHeatmap(result.data);
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get heatmap';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  /**
   * Get milestones
   */
  const getMilestones = useCallback(async (): Promise<Milestone[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/v1/analytics/milestones`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get milestones: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get milestones');
      }

      setMilestones(result.data.milestones);
      return result.data.milestones;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get milestones';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  /**
   * Track an event
   */
  const trackEvent = useCallback(async (
    eventType: EventType,
    eventData?: Record<string, unknown>
  ): Promise<void> => {
    try {
      await fetch(`${API_URL}/api/v1/analytics/event`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          eventType,
          eventData,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      // Silent fail for analytics tracking
      console.warn('Failed to track event:', err);
    }
  }, [getAuthHeaders]);

  return {
    getSummary,
    getProgress,
    getHeatmap,
    getMilestones,
    trackEvent,
    summary,
    progress,
    heatmap,
    milestones,
    loading,
    error,
  };
}

export default useAnalytics;
