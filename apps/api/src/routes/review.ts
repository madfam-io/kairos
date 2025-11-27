import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { CARD_TYPES, REVIEW_MODES } from '../db/schema';
import {
  getReviewPreferences,
  updateReviewPreferences,
  startReviewSession,
  submitReviewResponse,
  endReviewSession,
  getReviewHistory,
  generateReviewCards,
} from '../services/review';
import { AppError } from '../middleware/error-handler';
import { log } from '../lib/logger';

export const reviewRoutes = new Hono<AuthenticatedEnv>();

// All review routes require authentication
reviewRoutes.use('*', requireAuth());

/**
 * GET /api/v1/review/preferences
 * Get user's review preferences
 */
reviewRoutes.get('/preferences', async (c) => {
  const user = c.get('user');

  const preferences = await getReviewPreferences(user.id);

  return c.json({
    success: true,
    data: preferences,
  });
});

const updatePreferencesSchema = z.object({
  defaultMode: z.enum(REVIEW_MODES).optional(),
  cardTypeWeights: z
    .object({
      standard: z.number().min(0).max(100).optional(),
      reverse: z.number().min(0).max(100).optional(),
      cloze: z.number().min(0).max(100).optional(),
      audio: z.number().min(0).max(100).optional(),
      typing: z.number().min(0).max(100).optional(),
      tone: z.number().min(0).max(100).optional(),
      sentence: z.number().min(0).max(100).optional(),
      multiple_choice: z.number().min(0).max(100).optional(),
    })
    .optional(),
  cardsPerSession: z.number().int().min(5).max(100).optional(),
  sessionDurationMinutes: z.number().int().min(5).max(60).optional(),
  enableTimer: z.boolean().optional(),
  timerSecondsPerCard: z.number().int().min(5).max(60).optional(),
  autoPlayAudio: z.boolean().optional(),
  playbackSpeed: z.number().min(0.5).max(2.0).optional(),
  showPinyinHint: z.boolean().optional(),
  showExampleSentence: z.boolean().optional(),
  shuffleCards: z.boolean().optional(),
  adaptiveDifficulty: z.boolean().optional(),
});

/**
 * PATCH /api/v1/review/preferences
 * Update user's review preferences
 */
reviewRoutes.patch('/preferences', zValidator('json', updatePreferencesSchema), async (c) => {
  const user = c.get('user');
  const updates = c.req.valid('json');

  const preferences = await updateReviewPreferences(user.id, updates);

  log.info('Review preferences updated', { userId: user.id });

  return c.json({
    success: true,
    data: preferences,
  });
});

const startSessionSchema = z.object({
  mode: z.enum(REVIEW_MODES).default('spaced_repetition'),
  cardCount: z.number().int().min(1).max(100).default(20),
  cardTypes: z.array(z.enum(CARD_TYPES)).optional(),
  timerEnabled: z.boolean().optional(),
  timerSeconds: z.number().int().min(5).max(60).optional(),
});

/**
 * POST /api/v1/review/session/start
 * Start a new review session
 */
reviewRoutes.post('/session/start', zValidator('json', startSessionSchema), async (c) => {
  const user = c.get('user');
  const config = c.req.valid('json');

  try {
    const { sessionId, cards } = await startReviewSession(user.id, config);

    return c.json({
      success: true,
      data: {
        sessionId,
        cards,
        totalCards: cards.length,
        mode: config.mode,
      },
    });
  } catch (error) {
    if ((error as Error).message === 'No vocabulary available for review') {
      throw new AppError('NO_VOCABULARY', 'No vocabulary available for review', 400);
    }
    throw error;
  }
});

const submitResponseSchema = z.object({
  reviewCardId: z.string().uuid(),
  vocabularyId: z.string().uuid(),
  cardType: z.enum(CARD_TYPES),
  userAnswer: z.string(),
  correctAnswer: z.string(),
  isCorrect: z.boolean(),
  quality: z.number().int().min(0).max(5),
  responseTimeMs: z.number().int().min(0).optional(),
  hintsUsed: z.number().int().min(0).optional(),
  audioPlayed: z.boolean().optional(),
  wasSkipped: z.boolean().optional(),
  wasTimedOut: z.boolean().optional(),
});

/**
 * POST /api/v1/review/session/:sessionId/response
 * Submit a response for a card in a session
 */
reviewRoutes.post(
  '/session/:sessionId/response',
  zValidator('json', submitResponseSchema),
  async (c) => {
    const user = c.get('user');
    const sessionId = c.req.param('sessionId');
    const response = c.req.valid('json');

    const result = await submitReviewResponse(user.id, sessionId, response);

    return c.json({
      success: true,
      data: result,
    });
  }
);

/**
 * POST /api/v1/review/session/:sessionId/end
 * End a review session
 */
reviewRoutes.post('/session/:sessionId/end', async (c) => {
  const user = c.get('user');
  const sessionId = c.req.param('sessionId');

  const result = await endReviewSession(user.id, sessionId);

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/v1/review/session/:sessionId
 * Get a specific session's details
 */
reviewRoutes.get('/session/:sessionId', async (c) => {
  const user = c.get('user');
  const sessionId = c.req.param('sessionId');

  const { db } = await import('../db');
  const { reviewSessionsV2 } = await import('../db/schema');
  const { eq, and } = await import('drizzle-orm');

  const session = await db.query.reviewSessionsV2.findFirst({
    where: and(
      eq(reviewSessionsV2.id, sessionId),
      eq(reviewSessionsV2.userId, user.id)
    ),
  });

  if (!session) {
    throw new AppError('NOT_FOUND', 'Session not found', 404);
  }

  return c.json({
    success: true,
    data: session,
  });
});

/**
 * GET /api/v1/review/history
 * Get user's review session history
 */
reviewRoutes.get('/history', async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50);

  const history = await getReviewHistory(user.id, limit);

  return c.json({
    success: true,
    data: history,
  });
});

/**
 * GET /api/v1/review/stats
 * Get user's review statistics
 */
reviewRoutes.get('/stats', async (c) => {
  const user = c.get('user');

  const { db } = await import('../db');
  const { reviewSessionsV2, reviewResponses, cardTypePerformance } = await import('../db/schema');
  const { eq, sql, desc } = await import('drizzle-orm');

  // Get overall stats
  const [sessionStats, cardTypeStats, recentPerformance] = await Promise.all([
    // Total sessions and cards reviewed
    db
      .select({
        totalSessions: sql<number>`count(*)`,
        totalCards: sql<number>`sum(${reviewSessionsV2.completedCards})`,
        totalCorrect: sql<number>`sum(${reviewSessionsV2.correctCards})`,
        avgAccuracy: sql<number>`avg(${reviewSessionsV2.correctCards}::float / NULLIF(${reviewSessionsV2.completedCards}, 0) * 100)`,
        totalTimeSeconds: sql<number>`sum(EXTRACT(EPOCH FROM (${reviewSessionsV2.endedAt} - ${reviewSessionsV2.startedAt})))`,
      })
      .from(reviewSessionsV2)
      .where(eq(reviewSessionsV2.userId, user.id)),

    // Card type performance
    db.query.cardTypePerformance.findMany({
      where: eq(cardTypePerformance.userId, user.id),
    }),

    // Recent 7 days performance
    db
      .select({
        date: sql<string>`DATE(${reviewSessionsV2.startedAt})`,
        cardsReviewed: sql<number>`sum(${reviewSessionsV2.completedCards})`,
        accuracy: sql<number>`avg(${reviewSessionsV2.correctCards}::float / NULLIF(${reviewSessionsV2.completedCards}, 0) * 100)`,
      })
      .from(reviewSessionsV2)
      .where(
        sql`${reviewSessionsV2.userId} = ${user.id} AND ${reviewSessionsV2.startedAt} >= NOW() - INTERVAL '7 days'`
      )
      .groupBy(sql`DATE(${reviewSessionsV2.startedAt})`)
      .orderBy(sql`DATE(${reviewSessionsV2.startedAt})`),
  ]);

  const stats = sessionStats[0] || {
    totalSessions: 0,
    totalCards: 0,
    totalCorrect: 0,
    avgAccuracy: 0,
    totalTimeSeconds: 0,
  };

  return c.json({
    success: true,
    data: {
      overall: {
        totalSessions: stats.totalSessions || 0,
        totalCardsReviewed: stats.totalCards || 0,
        totalCorrect: stats.totalCorrect || 0,
        averageAccuracy: Math.round(stats.avgAccuracy || 0),
        totalStudyTimeMinutes: Math.round((stats.totalTimeSeconds || 0) / 60),
      },
      cardTypePerformance: cardTypeStats,
      recentPerformance,
    },
  });
});

/**
 * GET /api/v1/review/cards/:vocabularyId
 * Get all card variations for a vocabulary item
 */
reviewRoutes.get('/cards/:vocabularyId', async (c) => {
  const user = c.get('user');
  const vocabularyId = c.req.param('vocabularyId');

  const cards = await generateReviewCards(user.id, vocabularyId);

  return c.json({
    success: true,
    data: cards,
  });
});

/**
 * GET /api/v1/review/modes
 * Get available review modes
 */
reviewRoutes.get('/modes', async (c) => {
  return c.json({
    success: true,
    data: {
      modes: [
        {
          id: 'spaced_repetition',
          name: 'Spaced Repetition',
          description: 'Standard SRS review with varied card types',
          icon: '🎯',
        },
        {
          id: 'speed_drill',
          name: 'Speed Drill',
          description: 'Timed quick recall for building automaticity',
          icon: '⚡',
        },
        {
          id: 'deep_practice',
          name: 'Deep Practice',
          description: 'Mixed card types for thorough understanding',
          icon: '🧠',
        },
        {
          id: 'listening_focus',
          name: 'Listening Focus',
          description: 'Audio-heavy review for pronunciation and comprehension',
          icon: '👂',
        },
        {
          id: 'writing_focus',
          name: 'Writing Focus',
          description: 'Typing and character practice',
          icon: '✍️',
        },
      ],
      cardTypes: [
        { id: 'standard', name: 'Standard', description: 'Word → Meaning' },
        { id: 'reverse', name: 'Reverse', description: 'Meaning → Word' },
        { id: 'cloze', name: 'Cloze', description: 'Fill in the blank' },
        { id: 'audio', name: 'Audio', description: 'Listen and identify' },
        { id: 'typing', name: 'Typing', description: 'Type the characters' },
        { id: 'tone', name: 'Tone', description: 'Identify correct tones' },
        { id: 'multiple_choice', name: 'Multiple Choice', description: 'Select the answer' },
      ],
    },
  });
});
