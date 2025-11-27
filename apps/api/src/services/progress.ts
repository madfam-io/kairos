/**
 * Progress Visualization Service
 * Provides comprehensive progress data for visualization components
 */

import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  vocabulary,
  userStats,
  dailyStats,
  wordMastery,
  reviewSessions,
  userXp,
} from '../db/schema';
import { log } from '../lib/logger';

// HSK vocabulary counts (official numbers)
const HSK_VOCAB_COUNTS = {
  1: 150,
  2: 150,
  3: 300,
  4: 600,
  5: 1300,
  6: 2500,
};

interface HskProgress {
  level: number;
  wordsLearned: number;
  wordsKnown: number;
  totalWords: number;
  progress: number; // 0-100
  isComplete: boolean;
}

interface VocabularyTreeNode {
  id: string;
  name: string;
  type: 'root' | 'hsk' | 'category' | 'word';
  count: number;
  mastered: number;
  children?: VocabularyTreeNode[];
}

interface LearningVelocity {
  date: string;
  wordsLearned: number;
  wordsReviewed: number;
  studyMinutes: number;
  accuracy: number;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  icon: string;
  achievedAt?: Date;
  isAchieved: boolean;
  progress: number;
  target: number;
}

/**
 * Get HSK progress breakdown
 */
export async function getHskProgress(userId: string): Promise<HskProgress[]> {
  const result: HskProgress[] = [];

  for (let level = 1; level <= 6; level++) {
    const stats = await db
      .select({
        learned: sql<number>`count(*) filter (where ${vocabulary.status} != 'new')`,
        known: sql<number>`count(*) filter (where ${vocabulary.status} = 'known')`,
        total: sql<number>`count(*)`,
      })
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.userId, userId),
          eq(vocabulary.hskLevel, level)
        )
      );

    const totalWords = HSK_VOCAB_COUNTS[level as keyof typeof HSK_VOCAB_COUNTS];
    const learned = stats[0]?.learned || 0;
    const known = stats[0]?.known || 0;

    result.push({
      level,
      wordsLearned: learned,
      wordsKnown: known,
      totalWords,
      progress: Math.min(100, Math.round((learned / totalWords) * 100)),
      isComplete: learned >= totalWords,
    });
  }

  return result;
}

/**
 * Get vocabulary tree for visualization
 */
export async function getVocabularyTree(userId: string): Promise<VocabularyTreeNode> {
  // Get vocabulary grouped by HSK level
  const byLevel = await db
    .select({
      hskLevel: vocabulary.hskLevel,
      status: vocabulary.status,
      count: sql<number>`count(*)`,
    })
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId))
    .groupBy(vocabulary.hskLevel, vocabulary.status);

  // Build tree structure
  const levelNodes: VocabularyTreeNode[] = [];

  for (let level = 1; level <= 6; level++) {
    const levelData = byLevel.filter(b => b.hskLevel === level);
    const total = levelData.reduce((sum, d) => sum + d.count, 0);
    const mastered = levelData.filter(d => d.status === 'known').reduce((sum, d) => sum + d.count, 0);

    if (total > 0) {
      levelNodes.push({
        id: `hsk-${level}`,
        name: `HSK ${level}`,
        type: 'hsk',
        count: total,
        mastered,
        children: [
          {
            id: `hsk-${level}-new`,
            name: 'New',
            type: 'category',
            count: levelData.filter(d => d.status === 'new').reduce((sum, d) => sum + d.count, 0),
            mastered: 0,
          },
          {
            id: `hsk-${level}-learning`,
            name: 'Learning',
            type: 'category',
            count: levelData.filter(d => d.status === 'learning').reduce((sum, d) => sum + d.count, 0),
            mastered: 0,
          },
          {
            id: `hsk-${level}-known`,
            name: 'Mastered',
            type: 'category',
            count: mastered,
            mastered,
          },
        ],
      });
    }
  }

  // Add words without HSK level
  const noLevel = byLevel.filter(b => !b.hskLevel);
  if (noLevel.length > 0) {
    const total = noLevel.reduce((sum, d) => sum + d.count, 0);
    const mastered = noLevel.filter(d => d.status === 'known').reduce((sum, d) => sum + d.count, 0);

    levelNodes.push({
      id: 'other',
      name: 'Other',
      type: 'hsk',
      count: total,
      mastered,
    });
  }

  const totalCount = levelNodes.reduce((sum, n) => sum + n.count, 0);
  const totalMastered = levelNodes.reduce((sum, n) => sum + n.mastered, 0);

  return {
    id: 'root',
    name: 'Vocabulary',
    type: 'root',
    count: totalCount,
    mastered: totalMastered,
    children: levelNodes,
  };
}

/**
 * Get learning velocity over time
 */
export async function getLearningVelocity(
  userId: string,
  days: number = 30
): Promise<LearningVelocity[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const stats = await db
    .select()
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.userId, userId),
        gte(dailyStats.date, startDate)
      )
    )
    .orderBy(dailyStats.date);

  // Fill in missing days with zeros
  const result: LearningVelocity[] = [];
  const currentDate = new Date(startDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const statsMap = new Map(
    stats.map(s => [new Date(s.date).toISOString().split('T')[0], s])
  );

  while (currentDate <= today) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayStat = statsMap.get(dateStr);

    result.push({
      date: dateStr,
      wordsLearned: dayStat?.wordsLearned || 0,
      wordsReviewed: dayStat?.wordsReviewed || 0,
      studyMinutes: dayStat?.studyTimeMinutes || 0,
      accuracy: dayStat?.totalReviews
        ? Math.round((dayStat.correctReviews / dayStat.totalReviews) * 100)
        : 0,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

/**
 * Get milestone progress
 */
export async function getMilestones(userId: string): Promise<Milestone[]> {
  const stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, userId),
  });

  const vocabCount = await db
    .select({
      total: sql<number>`count(*)`,
      known: sql<number>`count(*) filter (where ${vocabulary.status} = 'known')`,
    })
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId));

  const xp = await db.query.userXp.findFirst({
    where: eq(userXp.userId, userId),
  });

  const totalWords = vocabCount[0]?.total || 0;
  const knownWords = vocabCount[0]?.known || 0;
  const streak = stats?.currentStreak || 0;
  const level = xp?.level || 1;

  const milestones: Milestone[] = [
    // Word count milestones
    {
      id: 'words-10',
      title: 'First 10 Words',
      description: 'Learn your first 10 words',
      icon: '📚',
      isAchieved: totalWords >= 10,
      achievedAt: totalWords >= 10 ? new Date() : undefined,
      progress: Math.min(totalWords, 10),
      target: 10,
    },
    {
      id: 'words-100',
      title: 'Century Club',
      description: 'Learn 100 words',
      icon: '💯',
      isAchieved: totalWords >= 100,
      progress: Math.min(totalWords, 100),
      target: 100,
    },
    {
      id: 'words-500',
      title: 'Half a Thousand',
      description: 'Learn 500 words',
      icon: '🌟',
      isAchieved: totalWords >= 500,
      progress: Math.min(totalWords, 500),
      target: 500,
    },
    {
      id: 'words-1000',
      title: 'Word Master',
      description: 'Learn 1000 words',
      icon: '🏆',
      isAchieved: totalWords >= 1000,
      progress: Math.min(totalWords, 1000),
      target: 1000,
    },

    // Mastery milestones
    {
      id: 'mastered-50',
      title: 'Master 50',
      description: 'Master 50 words',
      icon: '⭐',
      isAchieved: knownWords >= 50,
      progress: Math.min(knownWords, 50),
      target: 50,
    },
    {
      id: 'mastered-200',
      title: 'Memory Champion',
      description: 'Master 200 words',
      icon: '🧠',
      isAchieved: knownWords >= 200,
      progress: Math.min(knownWords, 200),
      target: 200,
    },

    // Streak milestones
    {
      id: 'streak-7',
      title: 'Week Warrior',
      description: '7-day streak',
      icon: '🔥',
      isAchieved: streak >= 7,
      progress: Math.min(streak, 7),
      target: 7,
    },
    {
      id: 'streak-30',
      title: 'Monthly Master',
      description: '30-day streak',
      icon: '🔥',
      isAchieved: streak >= 30,
      progress: Math.min(streak, 30),
      target: 30,
    },
    {
      id: 'streak-100',
      title: 'Century Streak',
      description: '100-day streak',
      icon: '🏅',
      isAchieved: streak >= 100,
      progress: Math.min(streak, 100),
      target: 100,
    },

    // Level milestones
    {
      id: 'level-5',
      title: 'Rising Star',
      description: 'Reach Level 5',
      icon: '⬆️',
      isAchieved: level >= 5,
      progress: Math.min(level, 5),
      target: 5,
    },
    {
      id: 'level-10',
      title: 'Dedicated Learner',
      description: 'Reach Level 10',
      icon: '🌟',
      isAchieved: level >= 10,
      progress: Math.min(level, 10),
      target: 10,
    },

    // HSK milestones
    {
      id: 'hsk1-complete',
      title: 'HSK 1 Complete',
      description: 'Learn all HSK 1 vocabulary',
      icon: '1️⃣',
      isAchieved: await checkHskComplete(userId, 1),
      progress: await getHskLearnedCount(userId, 1),
      target: HSK_VOCAB_COUNTS[1],
    },
    {
      id: 'hsk2-complete',
      title: 'HSK 2 Complete',
      description: 'Learn all HSK 2 vocabulary',
      icon: '2️⃣',
      isAchieved: await checkHskComplete(userId, 2),
      progress: await getHskLearnedCount(userId, 2),
      target: HSK_VOCAB_COUNTS[2],
    },
  ];

  return milestones;
}

/**
 * Check if HSK level is complete
 */
async function checkHskComplete(userId: string, level: number): Promise<boolean> {
  const count = await getHskLearnedCount(userId, level);
  return count >= HSK_VOCAB_COUNTS[level as keyof typeof HSK_VOCAB_COUNTS];
}

/**
 * Get HSK level learned count
 */
async function getHskLearnedCount(userId: string, level: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, userId),
        eq(vocabulary.hskLevel, level),
        sql`${vocabulary.status} != 'new'`
      )
    );

  return result[0]?.count || 0;
}

/**
 * Get overall progress summary
 */
export async function getProgressSummary(userId: string) {
  const [hskProgress, stats, xp, vocabStats] = await Promise.all([
    getHskProgress(userId),
    db.query.userStats.findFirst({
      where: eq(userStats.userId, userId),
    }),
    db.query.userXp.findFirst({
      where: eq(userXp.userId, userId),
    }),
    db
      .select({
        total: sql<number>`count(*)`,
        new: sql<number>`count(*) filter (where ${vocabulary.status} = 'new')`,
        learning: sql<number>`count(*) filter (where ${vocabulary.status} = 'learning')`,
        known: sql<number>`count(*) filter (where ${vocabulary.status} = 'known')`,
      })
      .from(vocabulary)
      .where(eq(vocabulary.userId, userId)),
  ]);

  // Calculate estimated HSK level
  let estimatedHskLevel = 1;
  for (const level of hskProgress) {
    if (level.progress >= 80) {
      estimatedHskLevel = level.level;
    } else {
      break;
    }
  }

  const total = vocabStats[0]?.total || 0;
  const known = vocabStats[0]?.known || 0;

  return {
    estimatedHskLevel,
    hskProgress,
    vocabulary: {
      total,
      new: vocabStats[0]?.new || 0,
      learning: vocabStats[0]?.learning || 0,
      known,
      masteryRate: total > 0 ? Math.round((known / total) * 100) : 0,
    },
    streak: {
      current: stats?.currentStreak || 0,
      longest: stats?.longestStreak || 0,
    },
    level: xp?.level || 1,
    totalXp: xp?.totalXp || 0,
    totalStudyTime: stats?.totalStudyTimeMinutes || 0,
  };
}

/**
 * Get retention curve data (for forgetting curve visualization)
 */
export async function getRetentionCurve(userId: string) {
  // Get word mastery data grouped by days since last review
  const now = new Date();

  const masteryData = await db
    .select({
      daysSinceReview: sql<number>`EXTRACT(DAY FROM ${now} - ${wordMastery.lastReviewedAt})::int`,
      avgRetention: sql<number>`avg(${wordMastery.retentionScore})`,
      count: sql<number>`count(*)`,
    })
    .from(wordMastery)
    .where(
      and(
        eq(wordMastery.userId, userId),
        sql`${wordMastery.lastReviewedAt} IS NOT NULL`
      )
    )
    .groupBy(sql`EXTRACT(DAY FROM ${now} - ${wordMastery.lastReviewedAt})::int`)
    .orderBy(sql`EXTRACT(DAY FROM ${now} - ${wordMastery.lastReviewedAt})::int`);

  return masteryData.map(d => ({
    daysSinceReview: d.daysSinceReview || 0,
    retention: Math.round(d.avgRetention || 0),
    wordCount: d.count,
  }));
}

/**
 * Get study time distribution by hour
 */
export async function getStudyTimeDistribution(userId: string) {
  const sessions = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${reviewSessions.startedAt})::int`,
      count: sql<number>`count(*)`,
      totalMinutes: sql<number>`sum(EXTRACT(EPOCH FROM (COALESCE(${reviewSessions.endedAt}, NOW()) - ${reviewSessions.startedAt})) / 60)`,
    })
    .from(reviewSessions)
    .where(eq(reviewSessions.userId, userId))
    .groupBy(sql`EXTRACT(HOUR FROM ${reviewSessions.startedAt})::int`);

  // Fill in all hours
  const distribution = [];
  for (let hour = 0; hour < 24; hour++) {
    const hourData = sessions.find(s => s.hour === hour);
    distribution.push({
      hour,
      sessions: hourData?.count || 0,
      minutes: Math.round(hourData?.totalMinutes || 0),
    });
  }

  return distribution;
}
