import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import {
  getDashboardSummary,
  getProgressData,
  getVocabularyGrowth,
  getRetentionData,
  getHeatmapData,
  getLearningInsights,
  generateInsights,
  updateDailyStats,
} from '../services/analytics-dashboard';
import { db, learningGoals, analyticsEvents } from '../db';
import { eq, and } from 'drizzle-orm';
import { log } from '../lib/logger';

export const analyticsRoutes = new Hono<AuthenticatedEnv>();

analyticsRoutes.use('*', requireAuth());

const eventSchema = z.object({
  eventType: z.enum([
    'session_start',
    'session_end',
    'video_play',
    'video_pause',
    'word_lookup',
    'card_mined',
    'card_exported',
    'simplification_used',
    'pitch_practice',
    'settings_changed',
    'error_occurred',
    'reader_opened',
    'shadowing_completed',
  ]),
  eventData: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

const batchEventSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

const progressQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
});

/**
 * POST /api/v1/analytics/event
 * Track a single analytics event
 */
analyticsRoutes.post('/event', zValidator('json', eventSchema), async (c) => {
  const event = c.req.valid('json');
  const user = c.get('user');

  try {
    // Insert event into analytics_events table
    await db.insert(analyticsEvents).values({
      userId: user.id,
      eventType: event.eventType,
      eventData: event.eventData ?? {},
      createdAt: event.timestamp ? new Date(event.timestamp) : new Date(),
    });

    // Update daily stats based on event type
    switch (event.eventType) {
      case 'word_lookup':
        await updateDailyStats(user.id, { wordsLearned: 1 });
        break;
      case 'card_mined':
        await updateDailyStats(user.id, { cardsMined: 1 });
        break;
      case 'card_exported':
        await updateDailyStats(user.id, { cardsExported: 1 });
        break;
      case 'simplification_used':
        await updateDailyStats(user.id, { simplificationsUsed: 1 });
        break;
      case 'session_end':
        const duration = (event.eventData?.durationMinutes as number) || 0;
        if (duration > 0) {
          await updateDailyStats(user.id, { studyTimeMinutes: duration });
        }
        break;
    }

    return c.json({
      success: true,
      data: { recorded: true },
    });
  } catch (error) {
    log.error('Failed to record event', error instanceof Error ? error : new Error(String(error)), {
      userId: user.id,
      eventType: event.eventType,
    });

    // Still return success to not block the client
    // Events can be retried or lost gracefully
    return c.json({
      success: true,
      data: { recorded: false, warning: 'Event may not have been persisted' },
    });
  }
});

/**
 * POST /api/v1/analytics/events
 * Track multiple analytics events in batch
 */
analyticsRoutes.post('/events', zValidator('json', batchEventSchema), async (c) => {
  const { events } = c.req.valid('json');
  const user = c.get('user');

  try {
    // Prepare batch insert values
    const insertValues = events.map((event) => ({
      userId: user.id,
      eventType: event.eventType,
      eventData: event.eventData ?? {},
      createdAt: event.timestamp ? new Date(event.timestamp) : new Date(),
    }));

    // Batch insert into analytics_events table
    await db.insert(analyticsEvents).values(insertValues);

    // Also update daily stats for relevant event types
    const statsUpdates: Record<string, number> = {};

    for (const event of events) {
      switch (event.eventType) {
        case 'word_lookup':
          statsUpdates.wordsLearned = (statsUpdates.wordsLearned || 0) + 1;
          break;
        case 'card_mined':
          statsUpdates.cardsMined = (statsUpdates.cardsMined || 0) + 1;
          break;
        case 'card_exported':
          statsUpdates.cardsExported = (statsUpdates.cardsExported || 0) + 1;
          break;
        case 'simplification_used':
          statsUpdates.simplificationsUsed = (statsUpdates.simplificationsUsed || 0) + 1;
          break;
        case 'session_end':
          const duration = (event.eventData?.durationMinutes as number) || 0;
          if (duration > 0) {
            statsUpdates.studyTimeMinutes = (statsUpdates.studyTimeMinutes || 0) + duration;
          }
          break;
      }
    }

    // Apply aggregated stats updates
    if (Object.keys(statsUpdates).length > 0) {
      await updateDailyStats(user.id, statsUpdates);
    }

    log.info('Batch analytics events recorded', {
      userId: user.id,
      eventCount: events.length,
      eventTypes: [...new Set(events.map((e) => e.eventType))],
    });

    return c.json({
      success: true,
      data: { recorded: events.length },
    });
  } catch (error) {
    log.error('Failed to record batch events', error instanceof Error ? error : new Error(String(error)), {
      userId: user.id,
      eventCount: events.length,
    });

    return c.json({
      success: false,
      error: {
        code: 'BATCH_INSERT_FAILED',
        message: 'Failed to record analytics events',
      },
    }, 500);
  }
});

/**
 * GET /api/v1/analytics/progress
 * Get learning progress over time
 */
analyticsRoutes.get('/progress', zValidator('query', progressQuerySchema), async (c) => {
  const { startDate, endDate } = c.req.valid('query');
  const user = c.get('user');

  // Calculate days from date range
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const progressData = await getProgressData(user.id, days);

  return c.json({
    success: true,
    data: progressData,
  });
});

/**
 * GET /api/v1/analytics/summary
 * Get comprehensive dashboard summary
 */
analyticsRoutes.get('/summary', async (c) => {
  const user = c.get('user');

  const summary = await getDashboardSummary(user.id);

  return c.json({
    success: true,
    data: summary,
  });
});

/**
 * GET /api/v1/analytics/heatmap
 * Get activity heatmap data (GitHub-style)
 */
analyticsRoutes.get('/heatmap', async (c) => {
  const user = c.get('user');

  const heatmap = await getHeatmapData(user.id, 365);

  return c.json({
    success: true,
    data: heatmap,
  });
});

/**
 * GET /api/v1/analytics/vocabulary-growth
 * Get vocabulary growth over time with HSK breakdown
 */
analyticsRoutes.get('/vocabulary-growth', async (c) => {
  const user = c.get('user');
  const days = parseInt(c.req.query('days') || '90', 10);

  const growth = await getVocabularyGrowth(user.id, Math.min(365, Math.max(7, days)));

  return c.json({
    success: true,
    data: growth,
  });
});

/**
 * GET /api/v1/analytics/retention
 * Get vocabulary retention and mastery data
 */
analyticsRoutes.get('/retention', async (c) => {
  const user = c.get('user');

  const retention = await getRetentionData(user.id);

  return c.json({
    success: true,
    data: retention,
  });
});

/**
 * GET /api/v1/analytics/insights
 * Get personalized learning insights and recommendations
 */
analyticsRoutes.get('/insights', async (c) => {
  const user = c.get('user');

  // Generate new insights if needed, then fetch all
  await generateInsights(user.id);
  const insights = await getLearningInsights(user.id);

  return c.json({
    success: true,
    data: insights,
  });
});

/**
 * POST /api/v1/analytics/insights/:id/dismiss
 * Dismiss a learning insight
 */
analyticsRoutes.post('/insights/:id/dismiss', async (c) => {
  const user = c.get('user');
  const insightId = c.req.param('id');

  const { learningInsights } = await import('../db');

  await db
    .update(learningInsights)
    .set({ isDismissed: true })
    .where(and(eq(learningInsights.id, insightId), eq(learningInsights.userId, user.id)));

  return c.json({
    success: true,
    data: { dismissed: true },
  });
});

const goalSchema = z.object({
  goalType: z.enum(['daily_words', 'daily_reviews', 'daily_time', 'weekly_words', 'streak']),
  targetValue: z.number().min(1),
});

/**
 * GET /api/v1/analytics/goals
 * Get user's learning goals
 */
analyticsRoutes.get('/goals', async (c) => {
  const user = c.get('user');

  const goals = await db
    .select()
    .from(learningGoals)
    .where(and(eq(learningGoals.userId, user.id), eq(learningGoals.isActive, true)));

  return c.json({
    success: true,
    data: goals.map((g) => ({
      id: g.id,
      goalType: g.goalType,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      startDate: g.startDate,
      endDate: g.endDate,
      isActive: g.isActive,
      progress: Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)),
    })),
  });
});

/**
 * POST /api/v1/analytics/goals
 * Create or update a learning goal
 */
analyticsRoutes.post('/goals', zValidator('json', goalSchema), async (c) => {
  const user = c.get('user');
  const { goalType, targetValue } = c.req.valid('json');

  // Deactivate existing goal of same type
  await db
    .update(learningGoals)
    .set({ isActive: false })
    .where(and(eq(learningGoals.userId, user.id), eq(learningGoals.goalType, goalType)));

  // Create new goal
  const [goal] = await db
    .insert(learningGoals)
    .values({
      userId: user.id,
      goalType,
      targetValue,
      currentValue: 0,
      startDate: new Date(),
      isActive: true,
    })
    .returning();

  return c.json({
    success: true,
    data: {
      id: goal.id,
      goalType: goal.goalType,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      startDate: goal.startDate,
      isActive: goal.isActive,
      progress: 0,
    },
  });
});

/**
 * DELETE /api/v1/analytics/goals/:id
 * Delete/deactivate a learning goal
 */
analyticsRoutes.delete('/goals/:id', async (c) => {
  const user = c.get('user');
  const goalId = c.req.param('id');

  await db
    .update(learningGoals)
    .set({ isActive: false })
    .where(and(eq(learningGoals.id, goalId), eq(learningGoals.userId, user.id)));

  return c.json({
    success: true,
    data: { deleted: true },
  });
});

/**
 * GET /api/v1/analytics/milestones
 * Get achievement milestones based on real data
 */
analyticsRoutes.get('/milestones', async (c) => {
  const user = c.get('user');

  const summary = await getDashboardSummary(user.id);

  // Calculate milestones from real data
  const milestones = [
    {
      id: 'first_word',
      name: 'First Word',
      description: 'Add your first vocabulary word',
      achieved: summary.allTime.totalWordsLearned >= 1,
      progress: Math.min(100, summary.allTime.totalWordsLearned * 100),
    },
    {
      id: 'vocab_100',
      name: 'Vocabulary Builder',
      description: 'Learn 100 words',
      achieved: summary.allTime.totalWordsLearned >= 100,
      progress: Math.min(100, summary.allTime.totalWordsLearned),
    },
    {
      id: 'vocab_500',
      name: 'Word Collector',
      description: 'Learn 500 words',
      achieved: summary.allTime.totalWordsLearned >= 500,
      progress: Math.min(100, Math.round((summary.allTime.totalWordsLearned / 500) * 100)),
    },
    {
      id: 'vocab_1000',
      name: 'Thousand Words',
      description: 'Learn 1,000 words',
      achieved: summary.allTime.totalWordsLearned >= 1000,
      progress: Math.min(100, Math.round((summary.allTime.totalWordsLearned / 1000) * 100)),
    },
    {
      id: 'streak_7',
      name: 'Week Warrior',
      description: 'Maintain a 7-day streak',
      achieved: summary.allTime.longestStreak >= 7,
      progress: Math.min(100, Math.round((summary.streakStatus.current / 7) * 100)),
    },
    {
      id: 'streak_30',
      name: 'Monthly Master',
      description: 'Maintain a 30-day streak',
      achieved: summary.allTime.longestStreak >= 30,
      progress: Math.min(100, Math.round((summary.streakStatus.current / 30) * 100)),
    },
    {
      id: 'streak_100',
      name: 'Centurion',
      description: 'Maintain a 100-day streak',
      achieved: summary.allTime.longestStreak >= 100,
      progress: Math.min(100, Math.round((summary.streakStatus.current / 100) * 100)),
    },
    {
      id: 'cards_50',
      name: 'Card Creator',
      description: 'Mine 50 cards',
      achieved: summary.allTime.totalCardsMined >= 50,
      progress: Math.min(100, Math.round((summary.allTime.totalCardsMined / 50) * 100)),
    },
    {
      id: 'hsk2',
      name: 'HSK 2 Ready',
      description: 'Reach HSK 2 vocabulary level',
      achieved: summary.hskProgress.currentLevel >= 2,
      progress: summary.hskProgress.currentLevel >= 2 ? 100 : summary.hskProgress.progressToNextLevel,
    },
    {
      id: 'hsk3',
      name: 'HSK 3 Ready',
      description: 'Reach HSK 3 vocabulary level',
      achieved: summary.hskProgress.currentLevel >= 3,
      progress: summary.hskProgress.currentLevel >= 3 ? 100 :
        summary.hskProgress.currentLevel === 2 ? summary.hskProgress.progressToNextLevel : 0,
    },
    {
      id: 'hsk4',
      name: 'HSK 4 Ready',
      description: 'Reach HSK 4 vocabulary level',
      achieved: summary.hskProgress.currentLevel >= 4,
      progress: summary.hskProgress.currentLevel >= 4 ? 100 :
        summary.hskProgress.currentLevel === 3 ? summary.hskProgress.progressToNextLevel : 0,
    },
  ];

  return c.json({
    success: true,
    data: {
      milestones,
      achievedCount: milestones.filter((m) => m.achieved).length,
      totalCount: milestones.length,
    },
  });
});
