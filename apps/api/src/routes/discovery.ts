import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import {
  searchContent,
  getTopics,
  getContentByTopic,
  getPersonalizedRecommendations,
  getContentDetails,
  trackContentInteraction,
  calculateComprehensibility,
} from '../services/discovery';
import { AppError } from '../middleware/error-handler';

export const discoveryRoutes = new Hono<AuthenticatedEnv>();

// All discovery routes require authentication
discoveryRoutes.use('*', requireAuth());

const searchSchema = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
  hskMin: z.coerce.number().min(1).max(6).optional(),
  hskMax: z.coerce.number().min(1).max(6).optional(),
  topics: z.string().optional(), // comma-separated
  genre: z.string().optional(), // comma-separated
  source: z.string().optional(),
  comprehensibilityMin: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/v1/discovery/search
 * Search content with filters
 */
discoveryRoutes.get('/search', zValidator('query', searchSchema), async (c) => {
  const user = c.get('user');
  const query = c.req.valid('query');

  const filters = {
    type: query.type,
    hskMin: query.hskMin,
    hskMax: query.hskMax,
    topics: query.topics?.split(','),
    genre: query.genre?.split(','),
    source: query.source,
    comprehensibilityMin: query.comprehensibilityMin,
  };

  const result = await searchContent(user.id, query.q || '', filters, {
    limit: query.limit,
    offset: query.offset,
  });

  return c.json({
    success: true,
    data: result.results,
    meta: {
      pagination: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + result.results.length < result.total,
      },
    },
  });
});

/**
 * GET /api/v1/discovery/recommendations
 * Get personalized content recommendations
 */
discoveryRoutes.get('/recommendations', async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 30);

  const recommendations = await getPersonalizedRecommendations(user.id, limit);

  return c.json({
    success: true,
    data: recommendations,
  });
});

/**
 * GET /api/v1/discovery/topics
 * Get all topics for browsing
 */
discoveryRoutes.get('/topics', async (c) => {
  const parentId = c.req.query('parent');

  const topics = await getTopics(parentId);

  return c.json({
    success: true,
    data: topics,
  });
});

/**
 * GET /api/v1/discovery/topics/:id/content
 * Get content for a specific topic
 */
discoveryRoutes.get('/topics/:id/content', async (c) => {
  const user = c.get('user');
  const topicId = c.req.param('id');
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const content = await getContentByTopic(user.id, topicId, { limit, offset });

  return c.json({
    success: true,
    data: content,
  });
});

/**
 * GET /api/v1/discovery/content/:id
 * Get content details with comprehensibility
 */
discoveryRoutes.get('/content/:id', async (c) => {
  const user = c.get('user');
  const contentId = c.req.param('id');

  try {
    const content = await getContentDetails(user.id, contentId);

    return c.json({
      success: true,
      data: content,
    });
  } catch (error) {
    if ((error as Error).message === 'Content not found') {
      throw new AppError('NOT_FOUND', 'Content not found', 404);
    }
    throw error;
  }
});

/**
 * GET /api/v1/discovery/content/:id/comprehensibility
 * Get detailed comprehensibility analysis for content
 */
discoveryRoutes.get('/content/:id/comprehensibility', async (c) => {
  const user = c.get('user');
  const contentId = c.req.param('id');

  const analysis = await calculateComprehensibility(user.id, contentId);

  return c.json({
    success: true,
    data: analysis,
  });
});

const trackInteractionSchema = z.object({
  status: z.enum(['discovered', 'started', 'in_progress', 'completed', 'dropped']),
  progress: z.number().min(0).max(100).optional(),
  comprehensibility: z.number().min(0).max(100).optional(),
  difficulty: z.enum(['too_easy', 'just_right', 'challenging', 'too_hard']).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/v1/discovery/content/:id/track
 * Track content interaction
 */
discoveryRoutes.post(
  '/content/:id/track',
  zValidator('json', trackInteractionSchema),
  async (c) => {
    const user = c.get('user');
    const contentId = c.req.param('id');
    const data = c.req.valid('json');

    await trackContentInteraction(user.id, contentId, data.status, {
      progress: data.progress,
      comprehensibility: data.comprehensibility,
      difficulty: data.difficulty,
      rating: data.rating,
      notes: data.notes,
    });

    return c.json({
      success: true,
      data: { message: 'Interaction tracked' },
    });
  }
);

/**
 * GET /api/v1/discovery/in-progress
 * Get user's in-progress content
 */
discoveryRoutes.get('/in-progress', async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 30);

  const { db } = await import('../db');
  const { userContentInteractions, contentCatalog } = await import('../db/schema');
  const { eq, and, desc } = await import('drizzle-orm');

  const interactions = await db
    .select({
      interaction: userContentInteractions,
      content: contentCatalog,
    })
    .from(userContentInteractions)
    .innerJoin(contentCatalog, eq(userContentInteractions.contentId, contentCatalog.id))
    .where(
      and(
        eq(userContentInteractions.userId, user.id),
        eq(userContentInteractions.status, 'in_progress')
      )
    )
    .orderBy(desc(userContentInteractions.lastAccessedAt))
    .limit(limit);

  return c.json({
    success: true,
    data: interactions.map((i) => ({
      ...i.content,
      progress: i.interaction.progress,
      lastAccessedAt: i.interaction.lastAccessedAt,
    })),
  });
});

/**
 * GET /api/v1/discovery/completed
 * Get user's completed content
 */
discoveryRoutes.get('/completed', async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const { db } = await import('../db');
  const { userContentInteractions, contentCatalog } = await import('../db/schema');
  const { eq, and, desc, sql } = await import('drizzle-orm');

  const [results, [{ total }]] = await Promise.all([
    db
      .select({
        interaction: userContentInteractions,
        content: contentCatalog,
      })
      .from(userContentInteractions)
      .innerJoin(contentCatalog, eq(userContentInteractions.contentId, contentCatalog.id))
      .where(
        and(
          eq(userContentInteractions.userId, user.id),
          eq(userContentInteractions.status, 'completed')
        )
      )
      .orderBy(desc(userContentInteractions.completedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(userContentInteractions)
      .where(
        and(
          eq(userContentInteractions.userId, user.id),
          eq(userContentInteractions.status, 'completed')
        )
      ),
  ]);

  return c.json({
    success: true,
    data: results.map((i) => ({
      ...i.content,
      rating: i.interaction.rating,
      completedAt: i.interaction.completedAt,
      wordsLearned: i.interaction.wordsLearned,
    })),
    meta: {
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + results.length < total,
      },
    },
  });
});

/**
 * GET /api/v1/discovery/featured
 * Get featured content
 */
discoveryRoutes.get('/featured', async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 20);

  const { db } = await import('../db');
  const { contentCatalog } = await import('../db/schema');
  const { eq, and, desc } = await import('drizzle-orm');

  const featured = await db.query.contentCatalog.findMany({
    where: and(
      eq(contentCatalog.isActive, true),
      eq(contentCatalog.isFeatured, true)
    ),
    orderBy: [desc(contentCatalog.avgRating)],
    limit,
  });

  return c.json({
    success: true,
    data: featured,
  });
});

/**
 * GET /api/v1/discovery/types
 * Get available content types
 */
discoveryRoutes.get('/types', async (c) => {
  return c.json({
    success: true,
    data: [
      { id: 'show', name: 'TV Shows', icon: '📺' },
      { id: 'movie', name: 'Movies', icon: '🎬' },
      { id: 'book', name: 'Books', icon: '📚' },
      { id: 'article', name: 'Articles', icon: '📰' },
      { id: 'podcast', name: 'Podcasts', icon: '🎙️' },
      { id: 'course', name: 'Courses', icon: '🎓' },
    ],
  });
});
