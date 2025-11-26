/**
 * Analytics Service
 *
 * Provides learning progress tracking and analytics data
 */

export interface DailyStat {
  date: string; // YYYY-MM-DD
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
    progress: number; // % towards next level
    vocabularySize: number;
  };
}

export interface HeatmapData {
  days: Record<string, number>; // date -> activity level (0-4)
  maxActivity: number;
  totalActiveDays: number;
}

/**
 * Generate mock progress data for development
 * In production, this would query the database
 */
export function generateMockProgressData(
  startDate: Date,
  endDate: Date,
  granularity: 'day' | 'week' | 'month'
): ProgressData {
  const wordsLearned: DailyStat[] = [];
  const hskProgress: ProgressData['hskProgress'] = [];
  const reviewAccuracy: ProgressData['reviewAccuracy'] = [];

  const currentDate = new Date(startDate);
  let cumulativeVocab = 150; // Starting vocabulary
  let currentHSK = 1.5;

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // More activity on weekdays, less on weekends
    const baseActivity = isWeekend ? 0.6 : 1.0;
    const randomFactor = 0.5 + Math.random();

    const dailyWords = Math.round(8 * baseActivity * randomFactor);
    const studyTime = Math.round(25 * baseActivity * randomFactor);
    const reviewedWords = Math.round(30 * baseActivity * randomFactor);
    const correctReviews = Math.round(reviewedWords * (0.75 + Math.random() * 0.2));

    wordsLearned.push({
      date: dateStr,
      wordsLearned: dailyWords,
      wordsReviewed: reviewedWords,
      cardsMined: Math.round(dailyWords * 0.3),
      studyTimeMinutes: studyTime,
      sessionsCount: studyTime > 0 ? Math.ceil(studyTime / 20) : 0,
    });

    cumulativeVocab += dailyWords;
    currentHSK = Math.min(6, 1 + cumulativeVocab / 500);

    hskProgress.push({
      date: dateStr,
      level: Math.round(currentHSK * 10) / 10,
      vocabularySize: cumulativeVocab,
    });

    reviewAccuracy.push({
      date: dateStr,
      correct: correctReviews,
      total: reviewedWords,
      accuracy: reviewedWords > 0 ? Math.round((correctReviews / reviewedWords) * 100) : 0,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Generate streak history
  const streakHistory: ProgressData['streakHistory'] = [
    { startDate: '2024-01-01', endDate: '2024-01-15', length: 15 },
    { startDate: '2024-01-20', endDate: '2024-02-05', length: 17 },
    { startDate: '2024-02-10', endDate: new Date().toISOString().split('T')[0], length: 30 },
  ];

  return {
    wordsLearned,
    hskProgress,
    reviewAccuracy,
    streakHistory,
  };
}

/**
 * Generate mock summary stats
 */
export function generateMockSummary(): SummaryStats {
  const today = new Date();
  const random = () => 0.7 + Math.random() * 0.6;

  return {
    today: {
      wordsLearned: Math.round(12 * random()),
      wordsReviewed: Math.round(45 * random()),
      cardsMined: Math.round(4 * random()),
      studyTimeMinutes: Math.round(35 * random()),
      simplificationsUsed: Math.round(8 * random()),
      reviewAccuracy: Math.round(85 * random()),
    },
    thisWeek: {
      wordsLearned: Math.round(75 * random()),
      wordsReviewed: Math.round(280 * random()),
      cardsMined: Math.round(25 * random()),
      studyTimeMinutes: Math.round(210 * random()),
      averageSessionMinutes: Math.round(22 * random()),
      averageAccuracy: Math.round(82 * random()),
    },
    thisMonth: {
      wordsLearned: Math.round(320 * random()),
      wordsReviewed: Math.round(1200 * random()),
      cardsMined: Math.round(95 * random()),
      studyTimeMinutes: Math.round(920 * random()),
      daysActive: Math.round(22 * random()),
    },
    allTime: {
      totalWordsLearned: Math.round(1850 * random()),
      totalWordsReviewed: Math.round(12500 * random()),
      totalCardsMined: Math.round(580 * random()),
      totalStudyTimeHours: Math.round(125 * random()),
      longestStreak: 47,
      currentStreak: Math.round(18 * random()),
      accountAgeInDays: 127,
    },
    streakStatus: {
      current: Math.round(18 * random()),
      longest: 47,
      todayCompleted: Math.random() > 0.3,
      nextMilestone: 30,
    },
    hskLevel: {
      current: 2.8,
      progress: 65,
      vocabularySize: Math.round(850 * random()),
    },
  };
}

/**
 * Generate heatmap data for activity visualization
 */
export function generateMockHeatmap(days: number = 365): HeatmapData {
  const heatmapDays: Record<string, number> = {};
  const today = new Date();
  let maxActivity = 0;
  let totalActiveDays = 0;

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Generate activity level (0-4)
    // More likely to be active on recent days
    const recencyBonus = (days - i) / days;
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseChance = isWeekend ? 0.4 : 0.7;

    if (Math.random() < baseChance * (0.5 + recencyBonus * 0.5)) {
      // Active day
      const activity = Math.min(4, Math.ceil(Math.random() * 4 * (0.5 + recencyBonus * 0.5)));
      heatmapDays[dateStr] = activity;
      maxActivity = Math.max(maxActivity, activity);
      totalActiveDays++;
    } else {
      heatmapDays[dateStr] = 0;
    }
  }

  return {
    days: heatmapDays,
    maxActivity,
    totalActiveDays,
  };
}

/**
 * Calculate milestone achievements
 */
export function calculateMilestones(stats: SummaryStats): Array<{
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  progress: number;
  target: number;
  icon: string;
}> {
  return [
    {
      id: 'first-100-words',
      title: 'First 100 Words',
      description: 'Learn 100 words',
      achieved: stats.allTime.totalWordsLearned >= 100,
      progress: Math.min(100, stats.allTime.totalWordsLearned),
      target: 100,
      icon: '📚',
    },
    {
      id: 'week-streak',
      title: 'Week Warrior',
      description: '7 day streak',
      achieved: stats.allTime.longestStreak >= 7,
      progress: Math.min(7, stats.streakStatus.current),
      target: 7,
      icon: '🔥',
    },
    {
      id: 'month-streak',
      title: 'Dedicated Learner',
      description: '30 day streak',
      achieved: stats.allTime.longestStreak >= 30,
      progress: Math.min(30, stats.streakStatus.current),
      target: 30,
      icon: '⭐',
    },
    {
      id: 'hsk-2',
      title: 'HSK 2 Ready',
      description: 'Reach HSK 2 vocabulary',
      achieved: stats.hskLevel.current >= 2,
      progress: Math.min(300, stats.hskLevel.vocabularySize),
      target: 300,
      icon: '📈',
    },
    {
      id: 'review-master',
      title: 'Review Master',
      description: 'Complete 1000 reviews',
      achieved: stats.allTime.totalWordsReviewed >= 1000,
      progress: Math.min(1000, stats.allTime.totalWordsReviewed),
      target: 1000,
      icon: '🎯',
    },
    {
      id: 'time-invested',
      title: 'Time Invested',
      description: 'Study for 50 hours',
      achieved: stats.allTime.totalStudyTimeHours >= 50,
      progress: Math.min(50, stats.allTime.totalStudyTimeHours),
      target: 50,
      icon: '⏱️',
    },
  ];
}

export default {
  generateMockProgressData,
  generateMockSummary,
  generateMockHeatmap,
  calculateMilestones,
};
