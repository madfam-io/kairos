/**
 * Advanced Analytics Dashboard Service
 * Real database queries for comprehensive learning analytics
 */

import { eq, and, gte, lte, desc, asc, sql, count, sum, avg } from 'drizzle-orm';
import {
  db,
  vocabulary,
  cards,
  analyticsEvents,
  userStats,
  dailyStats,
  reviewSessions,
  wordMastery,
  learningGoals,
  contentConsumption,
  learningInsights,
  users,
} from '../db';

// Types
export interface DashboardSummary {
  today: TodayStats;
  thisWeek: WeekStats;
  thisMonth: MonthStats;
  allTime: AllTimeStats;
  streakStatus: StreakStatus;
  hskProgress: HskProgress;
  learningVelocity: LearningVelocity;
}

export interface TodayStats {
  wordsLearned: number;
  wordsReviewed: number;
  cardsMined: number;
  studyTimeMinutes: number;
  simplificationsUsed: number;
  reviewAccuracy: number;
  goalProgress: number;
}

export interface WeekStats {
  wordsLearned: number;
  wordsReviewed: number;
  cardsMined: number;
  studyTimeMinutes: number;
  averageSessionMinutes: number;
  averageAccuracy: number;
  daysActive: number;
}

export interface MonthStats {
  wordsLearned: number;
  wordsReviewed: number;
  cardsMined: number;
  studyTimeMinutes: number;
  daysActive: number;
  retentionRate: number;
}

export interface AllTimeStats {
  totalWordsLearned: number;
  totalWordsReviewed: number;
  totalCardsMined: number;
  totalStudyTimeHours: number;
  longestStreak: number;
  currentStreak: number;
  accountAgeDays: number;
}

export interface StreakStatus {
  current: number;
  longest: number;
  todayCompleted: boolean;
  nextMilestone: number;
  daysUntilMilestone: number;
}

export interface HskProgress {
  currentLevel: number;
  vocabularyByLevel: Record<number, number>;
  totalVocabulary: number;
  progressToNextLevel: number;
  estimatedDaysToNextLevel: number;
}

export interface LearningVelocity {
  wordsPerDay7d: number;
  wordsPerDay30d: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  trendPercent: number;
}

export interface ProgressDataPoint {
  date: string;
  wordsLearned: number;
  wordsReviewed: number;
  cardsMined: number;
  studyTimeMinutes: number;
  accuracy: number;
}

export interface VocabularyGrowthPoint {
  date: string;
  total: number;
  hsk1: number;
  hsk2: number;
  hsk3: number;
  hsk4: number;
  hsk5: number;
  hsk6: number;
}

export interface RetentionData {
  masteryDistribution: {
    mastered: number; // 80-100%
    learning: number; // 40-79%
    struggling: number; // 0-39%
  };
  averageRetention: number;
  wordsDueToday: number;
  overdueWords: number;
}

export interface LearningInsight {
  id: string;
  type: 'strength' | 'weakness' | 'recommendation' | 'milestone' | 'trend';
  title: string;
  description: string;
  priority: number;
  data?: Record<string, unknown>;
  createdAt: Date;
}

// Helper functions
function getDateRange(days: number): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function getTodayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Main service functions

/**
 * Get comprehensive dashboard summary
 */
export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const [today, week, month, allTime, streak, hsk, velocity] = await Promise.all([
    getTodayStats(userId),
    getWeekStats(userId),
    getMonthStats(userId),
    getAllTimeStats(userId),
    getStreakStatus(userId),
    getHskProgress(userId),
    getLearningVelocity(userId),
  ]);

  return {
    today,
    thisWeek: week,
    thisMonth: month,
    allTime,
    streakStatus: streak,
    hskProgress: hsk,
    learningVelocity: velocity,
  };
}

/**
 * Get today's statistics
 */
export async function getTodayStats(userId: string): Promise<TodayStats> {
  const { start, end } = getTodayRange();

  // Get from daily_stats or calculate from events
  const [stats] = await db
    .select()
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start), lte(dailyStats.date, end)))
    .limit(1);

  if (stats) {
    const accuracy =
      stats.totalReviews > 0 ? Math.round((stats.correctReviews / stats.totalReviews) * 100) : 0;

    // Check goal progress
    const [goal] = await db
      .select()
      .from(learningGoals)
      .where(
        and(
          eq(learningGoals.userId, userId),
          eq(learningGoals.goalType, 'daily_words'),
          eq(learningGoals.isActive, true)
        )
      )
      .limit(1);

    const goalProgress = goal ? Math.min(100, (stats.wordsLearned / goal.targetValue) * 100) : 0;

    return {
      wordsLearned: stats.wordsLearned,
      wordsReviewed: stats.wordsReviewed,
      cardsMined: stats.cardsMined,
      studyTimeMinutes: stats.studyTimeMinutes,
      simplificationsUsed: stats.simplificationsUsed,
      reviewAccuracy: accuracy,
      goalProgress,
    };
  }

  // Fallback: calculate from raw data
  const [vocabCount] = await db
    .select({ count: count() })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), gte(vocabulary.createdAt, start)));

  const [cardsCount] = await db
    .select({ count: count() })
    .from(cards)
    .where(and(eq(cards.userId, userId), gte(cards.createdAt, start)));

  return {
    wordsLearned: vocabCount?.count || 0,
    wordsReviewed: 0,
    cardsMined: cardsCount?.count || 0,
    studyTimeMinutes: 0,
    simplificationsUsed: 0,
    reviewAccuracy: 0,
    goalProgress: 0,
  };
}

/**
 * Get this week's statistics
 */
export async function getWeekStats(userId: string): Promise<WeekStats> {
  const { start, end } = getDateRange(7);

  const stats = await db
    .select({
      wordsLearned: sum(dailyStats.wordsLearned),
      wordsReviewed: sum(dailyStats.wordsReviewed),
      cardsMined: sum(dailyStats.cardsMined),
      studyTimeMinutes: sum(dailyStats.studyTimeMinutes),
      sessionsCount: sum(dailyStats.sessionsCount),
      correctReviews: sum(dailyStats.correctReviews),
      totalReviews: sum(dailyStats.totalReviews),
      daysActive: count(),
    })
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start), lte(dailyStats.date, end)));

  const s = stats[0];
  const sessionsCount = Number(s?.sessionsCount) || 1;
  const totalReviews = Number(s?.totalReviews) || 0;
  const correctReviews = Number(s?.correctReviews) || 0;

  return {
    wordsLearned: Number(s?.wordsLearned) || 0,
    wordsReviewed: Number(s?.wordsReviewed) || 0,
    cardsMined: Number(s?.cardsMined) || 0,
    studyTimeMinutes: Number(s?.studyTimeMinutes) || 0,
    averageSessionMinutes: Math.round((Number(s?.studyTimeMinutes) || 0) / sessionsCount),
    averageAccuracy: totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0,
    daysActive: Number(s?.daysActive) || 0,
  };
}

/**
 * Get this month's statistics
 */
export async function getMonthStats(userId: string): Promise<MonthStats> {
  const { start, end } = getDateRange(30);

  const stats = await db
    .select({
      wordsLearned: sum(dailyStats.wordsLearned),
      wordsReviewed: sum(dailyStats.wordsReviewed),
      cardsMined: sum(dailyStats.cardsMined),
      studyTimeMinutes: sum(dailyStats.studyTimeMinutes),
      daysActive: count(),
    })
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start), lte(dailyStats.date, end)));

  // Calculate retention rate from word mastery
  const retention = await db
    .select({
      avgRetention: avg(wordMastery.retentionScore),
    })
    .from(wordMastery)
    .where(eq(wordMastery.userId, userId));

  const s = stats[0];

  return {
    wordsLearned: Number(s?.wordsLearned) || 0,
    wordsReviewed: Number(s?.wordsReviewed) || 0,
    cardsMined: Number(s?.cardsMined) || 0,
    studyTimeMinutes: Number(s?.studyTimeMinutes) || 0,
    daysActive: Number(s?.daysActive) || 0,
    retentionRate: Math.round(Number(retention[0]?.avgRetention) || 0),
  };
}

/**
 * Get all-time statistics
 */
export async function getAllTimeStats(userId: string): Promise<AllTimeStats> {
  // Get from user_stats table
  const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1);

  // Get account creation date
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  const accountAgeDays = user
    ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  if (stats) {
    return {
      totalWordsLearned: stats.totalWordsLearned,
      totalWordsReviewed: 0, // Would need to track this
      totalCardsMined: stats.totalCardsMined,
      totalStudyTimeHours: Math.round(stats.totalStudyTimeMinutes / 60),
      longestStreak: stats.longestStreak,
      currentStreak: stats.currentStreak,
      accountAgeDays,
    };
  }

  // Fallback: calculate from vocabulary and cards
  const [vocabCount] = await db
    .select({ count: count() })
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId));

  const [cardsCount] = await db
    .select({ count: count() })
    .from(cards)
    .where(eq(cards.userId, userId));

  return {
    totalWordsLearned: vocabCount?.count || 0,
    totalWordsReviewed: 0,
    totalCardsMined: cardsCount?.count || 0,
    totalStudyTimeHours: 0,
    longestStreak: 0,
    currentStreak: 0,
    accountAgeDays,
  };
}

/**
 * Get streak status
 */
export async function getStreakStatus(userId: string): Promise<StreakStatus> {
  const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId)).limit(1);

  const current = stats?.currentStreak || 0;
  const longest = stats?.longestStreak || 0;

  // Check if user has studied today
  const { start } = getTodayRange();
  const [todayStats] = await db
    .select()
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start)))
    .limit(1);

  const todayCompleted = (todayStats?.wordsLearned || 0) > 0 || (todayStats?.wordsReviewed || 0) > 0;

  // Calculate next milestone
  const milestones = [7, 14, 30, 60, 90, 180, 365];
  const nextMilestone = milestones.find((m) => m > current) || current + 100;

  return {
    current,
    longest,
    todayCompleted,
    nextMilestone,
    daysUntilMilestone: nextMilestone - current,
  };
}

/**
 * Get HSK progress breakdown
 */
export async function getHskProgress(userId: string): Promise<HskProgress> {
  // Count vocabulary by HSK level
  const levelCounts = await db
    .select({
      level: vocabulary.hskLevel,
      count: count(),
    })
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId))
    .groupBy(vocabulary.hskLevel);

  const vocabularyByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let total = 0;

  for (const lc of levelCounts) {
    if (lc.level && lc.level >= 1 && lc.level <= 6) {
      vocabularyByLevel[lc.level] = lc.count;
      total += lc.count;
    }
  }

  // Estimate current level based on vocabulary distribution
  // HSK levels have roughly: 150, 150, 300, 600, 1300, 2500 words
  const hskThresholds = [150, 300, 600, 1200, 2500, 5000];
  let currentLevel = 1;
  for (let i = 0; i < hskThresholds.length; i++) {
    if (total >= hskThresholds[i]) {
      currentLevel = i + 2;
    }
  }
  currentLevel = Math.min(currentLevel, 6);

  const currentThreshold = hskThresholds[currentLevel - 1] || 150;
  const nextThreshold = hskThresholds[currentLevel] || 5000;
  const progressToNext = Math.round(((total - currentThreshold) / (nextThreshold - currentThreshold)) * 100);

  // Estimate days to next level based on learning velocity
  const { start } = getDateRange(30);
  const [monthlyLearned] = await db
    .select({ total: sum(dailyStats.wordsLearned) })
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start)));

  const wordsPerDay = (Number(monthlyLearned?.total) || 0) / 30;
  const wordsNeeded = nextThreshold - total;
  const estimatedDays = wordsPerDay > 0 ? Math.ceil(wordsNeeded / wordsPerDay) : 999;

  return {
    currentLevel,
    vocabularyByLevel,
    totalVocabulary: total,
    progressToNextLevel: Math.max(0, Math.min(100, progressToNext)),
    estimatedDaysToNextLevel: estimatedDays,
  };
}

/**
 * Get learning velocity metrics
 */
export async function getLearningVelocity(userId: string): Promise<LearningVelocity> {
  const { start: start7d } = getDateRange(7);
  const { start: start30d } = getDateRange(30);
  const { start: prevStart } = getDateRange(60);

  // Last 7 days
  const [recent7d] = await db
    .select({ total: sum(dailyStats.wordsLearned) })
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start7d)));

  // Last 30 days
  const [recent30d] = await db
    .select({ total: sum(dailyStats.wordsLearned) })
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start30d)));

  // Previous 30 days (for trend)
  const [prev30d] = await db
    .select({ total: sum(dailyStats.wordsLearned) })
    .from(dailyStats)
    .where(
      and(eq(dailyStats.userId, userId), gte(dailyStats.date, prevStart), lte(dailyStats.date, start30d))
    );

  const wordsPerDay7d = Math.round((Number(recent7d?.total) || 0) / 7);
  const wordsPerDay30d = Math.round((Number(recent30d?.total) || 0) / 30);
  const prevWordsPerDay = Math.round((Number(prev30d?.total) || 0) / 30);

  let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  let trendPercent = 0;

  if (prevWordsPerDay > 0) {
    trendPercent = Math.round(((wordsPerDay30d - prevWordsPerDay) / prevWordsPerDay) * 100);
    if (trendPercent > 10) trend = 'increasing';
    else if (trendPercent < -10) trend = 'decreasing';
  }

  return {
    wordsPerDay7d,
    wordsPerDay30d,
    trend,
    trendPercent,
  };
}

/**
 * Get progress data for charts
 */
export async function getProgressData(
  userId: string,
  days: number = 30
): Promise<ProgressDataPoint[]> {
  const { start, end } = getDateRange(days);

  const stats = await db
    .select()
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start), lte(dailyStats.date, end)))
    .orderBy(asc(dailyStats.date));

  return stats.map((s) => ({
    date: s.date.toISOString().split('T')[0],
    wordsLearned: s.wordsLearned,
    wordsReviewed: s.wordsReviewed,
    cardsMined: s.cardsMined,
    studyTimeMinutes: s.studyTimeMinutes,
    accuracy: s.totalReviews > 0 ? Math.round((s.correctReviews / s.totalReviews) * 100) : 0,
  }));
}

/**
 * Get vocabulary growth data
 */
export async function getVocabularyGrowth(
  userId: string,
  days: number = 90
): Promise<VocabularyGrowthPoint[]> {
  const { start, end } = getDateRange(days);

  // Get cumulative vocabulary counts over time
  const dailyNew = await db
    .select({
      date: sql<string>`date_trunc('day', ${vocabulary.createdAt})::date`,
      hskLevel: vocabulary.hskLevel,
      count: count(),
    })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), gte(vocabulary.createdAt, start)))
    .groupBy(sql`date_trunc('day', ${vocabulary.createdAt})::date`, vocabulary.hskLevel)
    .orderBy(sql`date_trunc('day', ${vocabulary.createdAt})::date`);

  // Build cumulative data
  const dataMap = new Map<string, VocabularyGrowthPoint>();
  let cumulative = { total: 0, hsk1: 0, hsk2: 0, hsk3: 0, hsk4: 0, hsk5: 0, hsk6: 0 };

  // Get initial count before period
  const [initial] = await db
    .select({ count: count() })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), lte(vocabulary.createdAt, start)));

  cumulative.total = initial?.count || 0;

  for (const row of dailyNew) {
    const date = row.date;
    if (!dataMap.has(date)) {
      dataMap.set(date, { date, ...cumulative });
    }

    const point = dataMap.get(date)!;
    point.total += row.count;
    cumulative.total += row.count;

    if (row.hskLevel && row.hskLevel >= 1 && row.hskLevel <= 6) {
      const key = `hsk${row.hskLevel}` as keyof typeof cumulative;
      point[key] += row.count;
      cumulative[key] += row.count;
    }
  }

  return Array.from(dataMap.values());
}

/**
 * Get retention/mastery data
 */
export async function getRetentionData(userId: string): Promise<RetentionData> {
  // Get mastery distribution
  const mastery = await db
    .select({
      masteryLevel: wordMastery.masteryLevel,
      count: count(),
    })
    .from(wordMastery)
    .where(eq(wordMastery.userId, userId))
    .groupBy(wordMastery.masteryLevel);

  let mastered = 0;
  let learning = 0;
  let struggling = 0;
  let totalRetention = 0;
  let totalWords = 0;

  for (const m of mastery) {
    const level = m.masteryLevel;
    totalWords += m.count;
    totalRetention += level * m.count;

    if (level >= 80) mastered += m.count;
    else if (level >= 40) learning += m.count;
    else struggling += m.count;
  }

  // Get words due today
  const today = new Date();
  const [dueCount] = await db
    .select({ count: count() })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), lte(vocabulary.nextReview, today)));

  // Get overdue words (due before today)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const [overdueCount] = await db
    .select({ count: count() })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), lte(vocabulary.nextReview, yesterday)));

  return {
    masteryDistribution: { mastered, learning, struggling },
    averageRetention: totalWords > 0 ? Math.round(totalRetention / totalWords) : 0,
    wordsDueToday: dueCount?.count || 0,
    overdueWords: overdueCount?.count || 0,
  };
}

/**
 * Get activity heatmap data
 */
export async function getHeatmapData(
  userId: string,
  days: number = 365
): Promise<{ days: Record<string, number>; maxActivity: number; totalActiveDays: number }> {
  const { start, end } = getDateRange(days);

  const stats = await db
    .select({
      date: dailyStats.date,
      activity: sql<number>`${dailyStats.wordsLearned} + ${dailyStats.wordsReviewed}`,
    })
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start), lte(dailyStats.date, end)));

  const heatmapDays: Record<string, number> = {};
  let maxActivity = 0;
  let totalActiveDays = 0;

  for (const s of stats) {
    const dateStr = s.date.toISOString().split('T')[0];
    const activity = s.activity || 0;

    // Normalize to 0-4 scale
    let level = 0;
    if (activity > 0) {
      totalActiveDays++;
      level = Math.min(4, Math.ceil(activity / 20));
    }

    heatmapDays[dateStr] = level;
    maxActivity = Math.max(maxActivity, level);
  }

  return { days: heatmapDays, maxActivity, totalActiveDays };
}

/**
 * Get learning insights and recommendations
 */
export async function getLearningInsights(userId: string): Promise<LearningInsight[]> {
  // Get stored insights
  const stored = await db
    .select()
    .from(learningInsights)
    .where(
      and(
        eq(learningInsights.userId, userId),
        eq(learningInsights.isDismissed, false),
        sql`${learningInsights.expiresAt} IS NULL OR ${learningInsights.expiresAt} > NOW()`
      )
    )
    .orderBy(desc(learningInsights.priority), desc(learningInsights.createdAt))
    .limit(10);

  return stored.map((i) => ({
    id: i.id,
    type: i.insightType as LearningInsight['type'],
    title: i.title,
    description: i.description,
    priority: i.priority,
    data: i.data as Record<string, unknown>,
    createdAt: i.createdAt,
  }));
}

/**
 * Generate new insights based on user data
 */
export async function generateInsights(userId: string): Promise<number> {
  const [velocity, streak, retention, hsk] = await Promise.all([
    getLearningVelocity(userId),
    getStreakStatus(userId),
    getRetentionData(userId),
    getHskProgress(userId),
  ]);

  const insights: Array<Omit<typeof learningInsights.$inferInsert, 'id'>> = [];

  // Streak milestone approaching
  if (streak.daysUntilMilestone <= 3 && streak.daysUntilMilestone > 0) {
    insights.push({
      userId,
      insightType: 'milestone',
      title: `${streak.daysUntilMilestone} days until ${streak.nextMilestone}-day streak!`,
      description: `Keep going! You're almost at your next streak milestone.`,
      priority: 8,
      data: { currentStreak: streak.current, nextMilestone: streak.nextMilestone },
    });
  }

  // Learning velocity trend
  if (velocity.trend === 'decreasing' && velocity.trendPercent < -20) {
    insights.push({
      userId,
      insightType: 'trend',
      title: 'Learning pace has slowed down',
      description: `Your learning rate has decreased by ${Math.abs(velocity.trendPercent)}% compared to last month. Try setting smaller daily goals to get back on track.`,
      priority: 6,
      data: { trendPercent: velocity.trendPercent },
    });
  } else if (velocity.trend === 'increasing' && velocity.trendPercent > 20) {
    insights.push({
      userId,
      insightType: 'strength',
      title: 'Great momentum!',
      description: `Your learning pace is up ${velocity.trendPercent}% compared to last month. Keep it up!`,
      priority: 4,
      data: { trendPercent: velocity.trendPercent },
    });
  }

  // Retention issues
  if (retention.overdueWords > 50) {
    insights.push({
      userId,
      insightType: 'recommendation',
      title: `${retention.overdueWords} words need review`,
      description: `You have overdue vocabulary items. Consider a review session to maintain retention.`,
      priority: 7,
      data: { overdueWords: retention.overdueWords },
    });
  }

  // HSK progress
  if (hsk.progressToNextLevel >= 90) {
    insights.push({
      userId,
      insightType: 'milestone',
      title: `Almost at HSK ${hsk.currentLevel + 1}!`,
      description: `You're ${hsk.progressToNextLevel}% of the way to the next HSK level. Just ${100 - hsk.progressToNextLevel}% more to go!`,
      priority: 5,
      data: { currentLevel: hsk.currentLevel, progress: hsk.progressToNextLevel },
    });
  }

  // Insert new insights
  for (const insight of insights) {
    await db.insert(learningInsights).values(insight).onConflictDoNothing();
  }

  return insights.length;
}

/**
 * Record daily stats (called at end of day or on activity)
 */
export async function updateDailyStats(
  userId: string,
  updates: Partial<{
    wordsLearned: number;
    wordsReviewed: number;
    cardsMined: number;
    cardsExported: number;
    studyTimeMinutes: number;
    simplificationsUsed: number;
    correctReviews: number;
    totalReviews: number;
  }>
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db
    .insert(dailyStats)
    .values({
      userId,
      date: today,
      ...updates,
    })
    .onConflictDoUpdate({
      target: [dailyStats.userId, dailyStats.date],
      set: {
        wordsLearned: updates.wordsLearned
          ? sql`${dailyStats.wordsLearned} + ${updates.wordsLearned}`
          : undefined,
        wordsReviewed: updates.wordsReviewed
          ? sql`${dailyStats.wordsReviewed} + ${updates.wordsReviewed}`
          : undefined,
        cardsMined: updates.cardsMined
          ? sql`${dailyStats.cardsMined} + ${updates.cardsMined}`
          : undefined,
        cardsExported: updates.cardsExported
          ? sql`${dailyStats.cardsExported} + ${updates.cardsExported}`
          : undefined,
        studyTimeMinutes: updates.studyTimeMinutes
          ? sql`${dailyStats.studyTimeMinutes} + ${updates.studyTimeMinutes}`
          : undefined,
        simplificationsUsed: updates.simplificationsUsed
          ? sql`${dailyStats.simplificationsUsed} + ${updates.simplificationsUsed}`
          : undefined,
        correctReviews: updates.correctReviews
          ? sql`${dailyStats.correctReviews} + ${updates.correctReviews}`
          : undefined,
        totalReviews: updates.totalReviews
          ? sql`${dailyStats.totalReviews} + ${updates.totalReviews}`
          : undefined,
      },
    });
}
