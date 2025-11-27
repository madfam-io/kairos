/**
 * Gamification Service
 * Handles achievements, XP, challenges, and social features
 */

import { eq, and, sql, desc, asc, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import {
  achievementDefinitions,
  userAchievements,
  userXp,
  xpTransactions,
  challengeDefinitions,
  userChallenges,
  leaderboardEntries,
  activityFeed,
  dailyGoals,
  userStats,
  vocabulary,
} from '../db/schema';
import { log } from '../lib/logger';

interface XpGain {
  amount: number;
  category: 'learning' | 'consistency' | 'mastery' | 'social' | 'achievement';
  source: string;
  sourceId?: string;
  description?: string;
}

// XP required for each level (exponential growth)
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

/**
 * Get or initialize user XP record
 */
export async function getUserXp(userId: string) {
  let xp = await db.query.userXp.findFirst({
    where: eq(userXp.userId, userId),
  });

  if (!xp) {
    [xp] = await db
      .insert(userXp)
      .values({
        userId,
        totalXp: 0,
        level: 1,
        xpToNextLevel: xpForLevel(2),
      })
      .returning();
  }

  return xp;
}

/**
 * Award XP to a user
 */
export async function awardXp(userId: string, gain: XpGain): Promise<{
  newTotalXp: number;
  newLevel: number;
  leveledUp: boolean;
  previousLevel: number;
}> {
  const currentXp = await getUserXp(userId);
  const previousLevel = currentXp.level;
  let newTotalXp = currentXp.totalXp + gain.amount;

  // Calculate new level
  let newLevel = currentXp.level;
  let xpNeeded = currentXp.xpToNextLevel;

  // Check for level ups
  while (newTotalXp >= xpNeeded) {
    newLevel++;
    xpNeeded = xpForLevel(newLevel + 1);
  }

  const leveledUp = newLevel > previousLevel;

  // Update category XP
  const categoryUpdates: Record<string, number> = {};
  switch (gain.category) {
    case 'learning':
      categoryUpdates.learningXp = sql`${userXp.learningXp} + ${gain.amount}`;
      break;
    case 'consistency':
      categoryUpdates.consistencyXp = sql`${userXp.consistencyXp} + ${gain.amount}`;
      break;
    case 'mastery':
      categoryUpdates.masteryXp = sql`${userXp.masteryXp} + ${gain.amount}`;
      break;
    case 'social':
      categoryUpdates.socialXp = sql`${userXp.socialXp} + ${gain.amount}`;
      break;
  }

  // Update user XP
  await db
    .update(userXp)
    .set({
      totalXp: newTotalXp,
      level: newLevel,
      xpToNextLevel: xpNeeded,
      ...categoryUpdates,
      updatedAt: new Date(),
    })
    .where(eq(userXp.userId, userId));

  // Record transaction
  await db.insert(xpTransactions).values({
    userId,
    amount: gain.amount,
    category: gain.category,
    source: gain.source,
    sourceId: gain.sourceId,
    description: gain.description,
  });

  // Create activity feed entry for level up
  if (leveledUp) {
    await createActivity(userId, 'level_up', `Reached Level ${newLevel}!`, null, {
      previousLevel,
      newLevel,
      totalXp: newTotalXp,
    });

    log.info('User leveled up', { userId, newLevel, previousLevel });
  }

  return { newTotalXp, newLevel, leveledUp, previousLevel };
}

/**
 * Check and award achievements based on user actions
 */
export async function checkAchievements(
  userId: string,
  context: {
    action: string;
    data?: Record<string, unknown>;
  }
): Promise<string[]> {
  const earnedAchievements: string[] = [];

  // Get all active achievement definitions
  const definitions = await db.query.achievementDefinitions.findMany({
    where: eq(achievementDefinitions.isActive, true),
  });

  // Get user's existing achievements
  const existingAchievements = await db.query.userAchievements.findMany({
    where: eq(userAchievements.userId, userId),
  });

  const existingIds = new Set(existingAchievements.map(a => a.achievementId));

  // Get user stats for checking requirements
  const stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, userId),
  });

  const vocabCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId));

  const totalWords = vocabCount[0]?.count || 0;
  const knownWords = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(and(eq(vocabulary.userId, userId), eq(vocabulary.status, 'known')));

  // Check each achievement
  for (const def of definitions) {
    if (existingIds.has(def.id)) continue;

    const requirements = def.requirements as Record<string, unknown>;
    let earned = false;

    // Check requirements based on achievement type
    switch (def.id) {
      // Learning achievements
      case 'first_word':
        earned = totalWords >= 1;
        break;
      case 'words_10':
        earned = totalWords >= 10;
        break;
      case 'words_50':
        earned = totalWords >= 50;
        break;
      case 'words_100':
        earned = totalWords >= 100;
        break;
      case 'words_500':
        earned = totalWords >= 500;
        break;
      case 'words_1000':
        earned = totalWords >= 1000;
        break;

      // Mastery achievements
      case 'master_10':
        earned = (knownWords[0]?.count || 0) >= 10;
        break;
      case 'master_50':
        earned = (knownWords[0]?.count || 0) >= 50;
        break;
      case 'master_100':
        earned = (knownWords[0]?.count || 0) >= 100;
        break;

      // Streak achievements
      case 'streak_3':
        earned = (stats?.currentStreak || 0) >= 3;
        break;
      case 'streak_7':
        earned = (stats?.currentStreak || 0) >= 7;
        break;
      case 'streak_30':
        earned = (stats?.currentStreak || 0) >= 30;
        break;
      case 'streak_100':
        earned = (stats?.currentStreak || 0) >= 100;
        break;

      // Custom requirement checks
      default:
        if (requirements.minWords) {
          earned = totalWords >= (requirements.minWords as number);
        }
        if (requirements.minStreak) {
          earned = earned && (stats?.currentStreak || 0) >= (requirements.minStreak as number);
        }
        break;
    }

    if (earned) {
      // Award the achievement
      await db.insert(userAchievements).values({
        userId,
        achievementId: def.id,
        context: context.data || {},
      });

      earnedAchievements.push(def.id);

      // Award XP for achievement
      await awardXp(userId, {
        amount: def.xpReward,
        category: 'achievement',
        source: 'achievement',
        sourceId: def.id,
        description: `Earned achievement: ${def.name}`,
      });

      // Create activity feed entry
      await createActivity(userId, 'achievement', `Earned ${def.name}!`, def.description, {
        achievementId: def.id,
        rarity: def.rarity,
        icon: def.icon,
      });

      log.info('Achievement earned', { userId, achievementId: def.id });
    }
  }

  return earnedAchievements;
}

/**
 * Get user's achievements
 */
export async function getUserAchievements(userId: string) {
  const achievements = await db
    .select({
      achievement: achievementDefinitions,
      userAchievement: userAchievements,
    })
    .from(userAchievements)
    .innerJoin(
      achievementDefinitions,
      eq(userAchievements.achievementId, achievementDefinitions.id)
    )
    .where(eq(userAchievements.userId, userId))
    .orderBy(desc(userAchievements.earnedAt));

  return achievements;
}

/**
 * Get all available achievements (with earned status)
 */
export async function getAllAchievements(userId: string) {
  const definitions = await db.query.achievementDefinitions.findMany({
    where: eq(achievementDefinitions.isActive, true),
    orderBy: [asc(achievementDefinitions.sortOrder)],
  });

  const earned = await db.query.userAchievements.findMany({
    where: eq(userAchievements.userId, userId),
  });

  const earnedMap = new Map(earned.map(e => [e.achievementId, e]));

  return definitions.map(def => ({
    ...def,
    earned: earnedMap.has(def.id),
    earnedAt: earnedMap.get(def.id)?.earnedAt,
    isHidden: def.isHidden && !earnedMap.has(def.id),
  }));
}

/**
 * Get or create daily goals for user
 */
export async function getDailyGoals(userId: string) {
  let goals = await db.query.dailyGoals.findFirst({
    where: eq(dailyGoals.userId, userId),
  });

  if (!goals) {
    [goals] = await db
      .insert(dailyGoals)
      .values({ userId })
      .returning();
  }

  return goals;
}

/**
 * Update daily goals
 */
export async function updateDailyGoals(
  userId: string,
  updates: {
    wordsTarget?: number;
    reviewTarget?: number;
    studyMinutesTarget?: number;
    reminderEnabled?: boolean;
    reminderTime?: string;
    autoAdjust?: boolean;
  }
) {
  const [updated] = await db
    .update(dailyGoals)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(dailyGoals.userId, userId))
    .returning();

  return updated;
}

/**
 * Get daily progress
 */
export async function getDailyProgress(userId: string) {
  const goals = await getDailyGoals(userId);

  // Get today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, userId),
  });

  // Get words learned today
  const wordsToday = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, userId),
        gte(vocabulary.createdAt, today)
      )
    );

  // TODO: Get reviews today and study time from review sessions

  return {
    goals,
    progress: {
      wordsLearned: wordsToday[0]?.count || 0,
      wordsTarget: goals.wordsTarget,
      wordsProgress: Math.min(100, Math.round(((wordsToday[0]?.count || 0) / goals.wordsTarget) * 100)),
      reviewsCompleted: 0, // TODO: Calculate from review sessions
      reviewTarget: goals.reviewTarget,
      reviewProgress: 0,
      studyMinutes: 0, // TODO: Calculate from review sessions
      studyMinutesTarget: goals.studyMinutesTarget,
      studyProgress: 0,
    },
    streak: stats?.currentStreak || 0,
  };
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(
  periodType: 'daily' | 'weekly' | 'monthly' | 'all_time',
  category: string = 'global',
  limit: number = 50
) {
  // Calculate period dates
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date = now;

  switch (periodType) {
    case 'daily':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - dayOfWeek);
      periodStart.setHours(0, 0, 0, 0);
      break;
    case 'monthly':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'all_time':
      periodStart = new Date(0);
      break;
  }

  const entries = await db.query.leaderboardEntries.findMany({
    where: and(
      eq(leaderboardEntries.periodType, periodType),
      eq(leaderboardEntries.category, category),
      gte(leaderboardEntries.periodStart, periodStart),
      lte(leaderboardEntries.periodEnd, periodEnd)
    ),
    orderBy: [desc(leaderboardEntries.score)],
    limit,
  });

  return entries;
}

/**
 * Update user's leaderboard entry
 */
export async function updateLeaderboardEntry(
  userId: string,
  periodType: 'daily' | 'weekly' | 'monthly' | 'all_time',
  stats: {
    wordsLearned?: number;
    wordsReviewed?: number;
    studyMinutes?: number;
    streakDays?: number;
    xpEarned?: number;
  }
) {
  // Calculate period dates
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;

  switch (periodType) {
    case 'daily':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 1);
      break;
    case 'weekly':
      const dayOfWeek = now.getDay();
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - dayOfWeek);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 7);
      break;
    case 'monthly':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'all_time':
      periodStart = new Date(0);
      periodEnd = new Date(9999, 11, 31);
      break;
  }

  // Calculate score (weighted combination of stats)
  const score =
    (stats.wordsLearned || 0) * 10 +
    (stats.wordsReviewed || 0) * 2 +
    (stats.studyMinutes || 0) * 5 +
    (stats.streakDays || 0) * 20 +
    (stats.xpEarned || 0);

  await db
    .insert(leaderboardEntries)
    .values({
      userId,
      periodType,
      periodStart,
      periodEnd,
      score,
      wordsLearned: stats.wordsLearned || 0,
      wordsReviewed: stats.wordsReviewed || 0,
      studyMinutes: stats.studyMinutes || 0,
      streakDays: stats.streakDays || 0,
      xpEarned: stats.xpEarned || 0,
      category: 'global',
    })
    .onConflictDoUpdate({
      target: [leaderboardEntries.userId, leaderboardEntries.periodType, leaderboardEntries.periodStart],
      set: {
        score,
        wordsLearned: stats.wordsLearned || 0,
        wordsReviewed: stats.wordsReviewed || 0,
        studyMinutes: stats.studyMinutes || 0,
        streakDays: stats.streakDays || 0,
        xpEarned: stats.xpEarned || 0,
        updatedAt: new Date(),
      },
    });
}

/**
 * Create an activity feed entry
 */
export async function createActivity(
  userId: string,
  activityType: string,
  title: string,
  description: string | null,
  data: Record<string, unknown> = {},
  visibility: 'public' | 'friends' | 'private' = 'public'
) {
  const [activity] = await db
    .insert(activityFeed)
    .values({
      userId,
      activityType,
      title,
      description,
      data,
      visibility,
    })
    .returning();

  return activity;
}

/**
 * Get user's activity feed (from people they follow + their own)
 */
export async function getActivityFeed(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
    includeOwn?: boolean;
  } = {}
) {
  const { limit = 20, offset = 0, includeOwn = true } = options;

  // Get followed users
  const { userFollows } = await import('../db/schema');

  const following = await db.query.userFollows.findMany({
    where: eq(userFollows.followerId, userId),
  });

  const followingIds = following.map(f => f.followingId);
  if (includeOwn) {
    followingIds.push(userId);
  }

  if (followingIds.length === 0) {
    return [];
  }

  const activities = await db
    .select()
    .from(activityFeed)
    .where(
      and(
        sql`${activityFeed.userId} = ANY(${followingIds})`,
        sql`(${activityFeed.visibility} = 'public' OR ${activityFeed.userId} = ${userId})`
      )
    )
    .orderBy(desc(activityFeed.createdAt))
    .limit(limit)
    .offset(offset);

  return activities;
}

/**
 * Initialize default achievements
 */
export async function seedAchievements() {
  const achievements = [
    // Learning achievements
    { id: 'first_word', name: 'First Step', description: 'Learn your first word', category: 'learning', icon: '🌱', rarity: 'common', xpReward: 10, sortOrder: 1 },
    { id: 'words_10', name: 'Vocabulary Builder', description: 'Learn 10 words', category: 'learning', icon: '📚', rarity: 'common', xpReward: 25, sortOrder: 2 },
    { id: 'words_50', name: 'Word Collector', description: 'Learn 50 words', category: 'learning', icon: '📖', rarity: 'uncommon', xpReward: 50, sortOrder: 3 },
    { id: 'words_100', name: 'Century Club', description: 'Learn 100 words', category: 'learning', icon: '💯', rarity: 'uncommon', xpReward: 100, sortOrder: 4 },
    { id: 'words_500', name: 'Word Master', description: 'Learn 500 words', category: 'learning', icon: '🎓', rarity: 'rare', xpReward: 250, sortOrder: 5 },
    { id: 'words_1000', name: 'Vocabulary Champion', description: 'Learn 1000 words', category: 'learning', icon: '🏆', rarity: 'epic', xpReward: 500, sortOrder: 6 },

    // Mastery achievements
    { id: 'master_10', name: 'Quick Learner', description: 'Master 10 words', category: 'mastery', icon: '⭐', rarity: 'common', xpReward: 30, sortOrder: 10 },
    { id: 'master_50', name: 'Memory Expert', description: 'Master 50 words', category: 'mastery', icon: '🧠', rarity: 'uncommon', xpReward: 75, sortOrder: 11 },
    { id: 'master_100', name: 'Knowledge Keeper', description: 'Master 100 words', category: 'mastery', icon: '💎', rarity: 'rare', xpReward: 150, sortOrder: 12 },

    // Streak achievements
    { id: 'streak_3', name: 'Getting Started', description: '3-day study streak', category: 'consistency', icon: '🔥', rarity: 'common', xpReward: 20, sortOrder: 20 },
    { id: 'streak_7', name: 'Week Warrior', description: '7-day study streak', category: 'consistency', icon: '🔥', rarity: 'uncommon', xpReward: 50, sortOrder: 21 },
    { id: 'streak_30', name: 'Monthly Master', description: '30-day study streak', category: 'consistency', icon: '🔥', rarity: 'rare', xpReward: 200, sortOrder: 22 },
    { id: 'streak_100', name: 'Dedication Legend', description: '100-day study streak', category: 'consistency', icon: '🔥', rarity: 'legendary', xpReward: 1000, sortOrder: 23 },

    // Special achievements
    { id: 'early_bird', name: 'Early Bird', description: 'Study before 7 AM', category: 'special', icon: '🌅', rarity: 'uncommon', xpReward: 30, sortOrder: 30 },
    { id: 'night_owl', name: 'Night Owl', description: 'Study after 11 PM', category: 'special', icon: '🦉', rarity: 'uncommon', xpReward: 30, sortOrder: 31 },
    { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Study on both Saturday and Sunday', category: 'special', icon: '💪', rarity: 'uncommon', xpReward: 40, sortOrder: 32 },
  ];

  for (const achievement of achievements) {
    await db
      .insert(achievementDefinitions)
      .values({
        ...achievement,
        requirements: {},
        badgeColor: '#4CAF50',
        isHidden: false,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  log.info('Achievements seeded', { count: achievements.length });
}
