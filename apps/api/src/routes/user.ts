import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, count, sql } from 'drizzle-orm';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { DEFAULT_USER_SETTINGS } from '@kairos/types';
import { db } from '../db';
import { users, userStats, vocabulary, cards, syncChanges, analyticsEvents } from '../db/schema';
import { getSubscription, cancelSubscription } from '../services/billing';
import { log } from '../lib/logger';
import { AppError } from '../middleware/error-handler';

export const userRoutes = new Hono<AuthenticatedEnv>();

// All user routes require authentication
userRoutes.use('*', requireAuth());

const updateSettingsSchema = z.object({
  hskLevel: z.number().int().min(1).max(6).optional(),
  showPinyin: z.boolean().optional(),
  autoPlayAudio: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
  simplificationEnabled: z.boolean().optional(),
  knownWordsHidden: z.boolean().optional(),
  keyboardShortcutsEnabled: z.boolean().optional(),
  locale: z.enum(['en', 'zh-Hans', 'zh-Hant']).optional(),
});

/**
 * GET /api/v1/user/profile
 * Get user profile with settings and stats
 */
userRoutes.get('/profile', async (c) => {
  const user = c.get('user');

  // Fetch stats from database (or create if not exists)
  let stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, user.id),
  });

  // If no stats exist, create default stats
  if (!stats) {
    // Get actual counts from data tables
    const [vocabCount, cardsCount] = await Promise.all([
      db.select({ count: count() })
        .from(vocabulary)
        .where(eq(vocabulary.userId, user.id)),
      db.select({ count: count() })
        .from(cards)
        .where(eq(cards.userId, user.id)),
    ]);

    [stats] = await db
      .insert(userStats)
      .values({
        userId: user.id,
        totalWordsLearned: vocabCount[0].count,
        totalCardsMined: cardsCount[0].count,
        currentStreak: 0,
        longestStreak: 0,
        totalStudyTimeMinutes: 0,
        lastActiveAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: {
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
  }

  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      settings: { ...DEFAULT_USER_SETTINGS, ...user.settings },
      stats: {
        totalWordsLearned: stats?.totalWordsLearned ?? 0,
        totalCardsMined: stats?.totalCardsMined ?? 0,
        currentStreak: stats?.currentStreak ?? 0,
        longestStreak: stats?.longestStreak ?? 0,
        totalStudyTimeMinutes: stats?.totalStudyTimeMinutes ?? 0,
        lastActiveAt: stats?.lastActiveAt ?? null,
      },
    },
  });
});

/**
 * PATCH /api/v1/user/profile
 * Update user settings
 */
userRoutes.patch('/profile', zValidator('json', updateSettingsSchema), async (c) => {
  const user = c.get('user');
  const updates = c.req.valid('json');

  // Merge with existing settings
  const currentSettings = user.settings || {};
  const updatedSettings = {
    ...DEFAULT_USER_SETTINGS,
    ...currentSettings,
    ...updates,
  };

  // Update in database
  const [updatedUser] = await db
    .update(users)
    .set({
      settings: updatedSettings,
    })
    .where(eq(users.id, user.id))
    .returning();

  log.info('User settings updated', { userId: user.id, updates: Object.keys(updates) });

  return c.json({
    success: true,
    data: {
      settings: updatedSettings,
    },
  });
});

/**
 * GET /api/v1/user/subscription
 * Get subscription details
 */
userRoutes.get('/subscription', async (c) => {
  const user = c.get('user');

  // Try to get subscription from billing service
  let subscription = null;
  try {
    subscription = await getSubscription(user.id);
  } catch {
    // Fall back to user record
  }

  return c.json({
    success: true,
    data: {
      tier: user.subscriptionTier,
      status: subscription?.status || (user.subscriptionTier === 'free' ? 'free' : 'active'),
      currentPeriodEnd: user.subscriptionExpiresAt,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
      customerId: user.stripeCustomerId,
    },
  });
});

/**
 * GET /api/v1/user/usage
 * Get usage statistics for billing limits
 */
userRoutes.get('/usage', async (c) => {
  const user = c.get('user');

  // Calculate period (current month)
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Get usage counts
  const [cardsToday, aiUsageThisMonth] = await Promise.all([
    // Cards mined today
    db.select({ count: count() })
      .from(cards)
      .where(
        sql`${cards.userId} = ${user.id} AND ${cards.createdAt}::date = CURRENT_DATE`
      ),
    // AI sentences this month (from analytics events)
    db.select({ count: count() })
      .from(analyticsEvents)
      .where(
        sql`${analyticsEvents.userId} = ${user.id}
            AND ${analyticsEvents.eventName} = 'ai_sentence_generated'
            AND ${analyticsEvents.createdAt} >= ${periodStart}
            AND ${analyticsEvents.createdAt} <= ${periodEnd}`
      ),
  ]);

  return c.json({
    success: true,
    data: {
      cardsMinedToday: cardsToday[0].count,
      aiSentencesThisMonth: aiUsageThisMonth[0].count,
      periodStart,
      periodEnd,
    },
  });
});

/**
 * POST /api/v1/user/activity
 * Record user activity for streak tracking
 */
userRoutes.post('/activity', async (c) => {
  const user = c.get('user');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get current stats
  const stats = await db.query.userStats.findFirst({
    where: eq(userStats.userId, user.id),
  });

  let currentStreak = stats?.currentStreak || 0;
  let longestStreak = stats?.longestStreak || 0;

  if (stats?.lastStreakDate) {
    const lastDate = new Date(stats.lastStreakDate);
    const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      // Consecutive day - increment streak
      currentStreak++;
    } else if (daysDiff > 1) {
      // Streak broken - reset
      currentStreak = 1;
    }
    // If daysDiff === 0, same day, don't change streak
  } else {
    // First activity
    currentStreak = 1;
  }

  longestStreak = Math.max(longestStreak, currentStreak);

  // Update stats
  await db
    .insert(userStats)
    .values({
      userId: user.id,
      currentStreak,
      longestStreak,
      lastActiveAt: now,
      lastStreakDate: today,
    })
    .onConflictDoUpdate({
      target: userStats.userId,
      set: {
        currentStreak,
        longestStreak,
        lastActiveAt: now,
        lastStreakDate: today,
        updatedAt: now,
      },
    });

  return c.json({
    success: true,
    data: {
      currentStreak,
      longestStreak,
    },
  });
});

/**
 * DELETE /api/v1/user/account
 * Delete user account and all associated data
 */
userRoutes.delete('/account', async (c) => {
  const user = c.get('user');

  log.warn('Account deletion requested', { userId: user.id, email: user.email });

  // Cancel any active subscriptions
  if (user.stripeSubscriptionId) {
    try {
      await cancelSubscription(user.stripeSubscriptionId, 'stripe', true);
      log.info('Subscription cancelled during account deletion', { userId: user.id });
    } catch (error) {
      log.error('Failed to cancel subscription during deletion', error as Error, {
        userId: user.id,
      });
      // Continue with deletion even if subscription cancel fails
    }
  }

  // Delete all user data in a transaction
  // Note: CASCADE should handle most of this, but being explicit
  await db.transaction(async (tx) => {
    // Delete in order of dependencies
    await tx.delete(syncChanges).where(eq(syncChanges.userId, user.id));
    await tx.delete(analyticsEvents).where(eq(analyticsEvents.userId, user.id));
    await tx.delete(userStats).where(eq(userStats.userId, user.id));
    await tx.delete(cards).where(eq(cards.userId, user.id));
    await tx.delete(vocabulary).where(eq(vocabulary.userId, user.id));

    // Finally delete the user (this should cascade remaining data)
    await tx.delete(users).where(eq(users.id, user.id));
  });

  log.info('Account deleted successfully', { userId: user.id });

  return c.json({
    success: true,
    data: { message: 'Account deleted successfully' },
  });
});

/**
 * GET /api/v1/user/export
 * Export all user data as JSON
 */
userRoutes.get('/export', async (c) => {
  const user = c.get('user');

  // Fetch all user data in parallel
  const [
    userData,
    userVocabulary,
    userCards,
    stats,
  ] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        id: true,
        email: true,
        createdAt: true,
        subscriptionTier: true,
        settings: true,
      },
    }),
    db.select().from(vocabulary).where(eq(vocabulary.userId, user.id)),
    db.select().from(cards).where(eq(cards.userId, user.id)),
    db.query.userStats.findFirst({
      where: eq(userStats.userId, user.id),
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: userData,
    stats,
    vocabulary: userVocabulary,
    cards: userCards,
  };

  log.info('Data export generated', {
    userId: user.id,
    vocabularyCount: userVocabulary.length,
    cardsCount: userCards.length,
  });

  // Return as downloadable JSON
  c.header('Content-Type', 'application/json');
  c.header('Content-Disposition', `attachment; filename="kairos-export-${user.id}.json"`);

  return c.json({
    success: true,
    data: exportData,
  });
});
