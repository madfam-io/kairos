import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';

export const vocabularyRoutes = new Hono<AuthenticatedEnv>();

vocabularyRoutes.use('*', requireAuth());

const vocabularyQuerySchema = z.object({
  status: z.enum(['new', 'learning', 'known']).optional(),
  hskLevel: z.coerce.number().int().min(1).max(6).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'updatedAt', 'nextReview', 'word']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const batchCreateSchema = z.object({
  words: z
    .array(
      z.object({
        word: z.string().min(1),
        pinyin: z.string().optional(),
        definition: z.string().optional(),
        status: z.enum(['new', 'learning', 'known']).optional(),
      })
    )
    .min(1)
    .max(100),
});

const updateSchema = z.object({
  pinyin: z.string().optional(),
  definition: z.string().optional(),
  status: z.enum(['new', 'learning', 'known']).optional(),
  easeFactor: z.number().min(1.3).max(2.5).optional(),
  nextReview: z.string().datetime().optional(),
});

/**
 * GET /api/v1/vocabulary
 */
vocabularyRoutes.get('/', zValidator('query', vocabularyQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user');

  // TODO: Fetch from database
  return c.json({
    success: true,
    data: [],
    meta: {
      pagination: {
        page: Math.floor(query.offset / query.limit) + 1,
        limit: query.limit,
        total: 0,
        totalPages: 0,
        hasMore: false,
      },
    },
  });
});

/**
 * POST /api/v1/vocabulary/batch
 */
vocabularyRoutes.post('/batch', zValidator('json', batchCreateSchema), async (c) => {
  const { words } = c.req.valid('json');
  const user = c.get('user');

  // TODO: Insert into database
  return c.json({
    success: true,
    data: {
      created: words.length,
      duplicates: 0,
    },
  });
});

/**
 * GET /api/v1/vocabulary/stats
 */
vocabularyRoutes.get('/stats', async (c) => {
  const user = c.get('user');

  // TODO: Aggregate from database
  return c.json({
    success: true,
    data: {
      total: 0,
      new: 0,
      learning: 0,
      known: 0,
      dueForReview: 0,
      byHskLevel: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    },
  });
});

/**
 * GET /api/v1/vocabulary/due
 */
vocabularyRoutes.get('/due', async (c) => {
  const user = c.get('user');

  // TODO: Fetch words due for review
  return c.json({
    success: true,
    data: [],
  });
});

/**
 * PATCH /api/v1/vocabulary/:id
 */
vocabularyRoutes.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const id = c.req.param('id');
  const updates = c.req.valid('json');
  const user = c.get('user');

  // TODO: Update in database
  return c.json({
    success: true,
    data: { id, ...updates },
  });
});

/**
 * DELETE /api/v1/vocabulary/:id
 */
vocabularyRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  // TODO: Delete from database
  return c.json({
    success: true,
    data: { deleted: true },
  });
});

/**
 * POST /api/v1/vocabulary/:id/review
 */
vocabularyRoutes.post(
  '/:id/review',
  zValidator('json', z.object({ quality: z.number().int().min(0).max(5) })),
  async (c) => {
    const id = c.req.param('id');
    const { quality } = c.req.valid('json');
    const user = c.get('user');

    // TODO: Apply SRS algorithm and update
    return c.json({
      success: true,
      data: {
        id,
        newEaseFactor: 2.5,
        newInterval: 1,
        nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }
);
