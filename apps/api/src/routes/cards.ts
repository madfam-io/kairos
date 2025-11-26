import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';

export const cardsRoutes = new Hono<AuthenticatedEnv>();

cardsRoutes.use('*', requireAuth());

const cardQuerySchema = z.object({
  exportedToAnki: z.coerce.boolean().optional(),
  search: z.string().optional(),
  sourceTitle: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'word']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const createCardSchema = z.object({
  word: z.string().min(1),
  sentence: z.string().min(1),
  simplifiedSentence: z.string().optional(),
  sourceTitle: z.string().optional(),
  sourceTimestamp: z.string().optional(),
});

const exportSchema = z.object({
  format: z.enum(['anki', 'csv', 'json']).default('anki'),
  includeAudio: z.boolean().default(true),
  includeScreenshot: z.boolean().default(true),
  includeSimplified: z.boolean().default(true),
  cardIds: z.array(z.string().uuid()).optional(),
});

/**
 * GET /api/v1/cards
 */
cardsRoutes.get('/', zValidator('query', cardQuerySchema), async (c) => {
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
 * POST /api/v1/cards
 */
cardsRoutes.post('/', zValidator('json', createCardSchema), async (c) => {
  const cardData = c.req.valid('json');
  const user = c.get('user');

  // TODO: Check daily limit for free tier
  // TODO: Insert into database

  return c.json({
    success: true,
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      ...cardData,
      audioUrl: null,
      screenshotUrl: null,
      exportedToAnki: false,
      createdAt: new Date(),
    },
  });
});

/**
 * GET /api/v1/cards/:id
 */
cardsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  // TODO: Fetch from database
  return c.json({
    success: true,
    data: null,
  });
});

/**
 * DELETE /api/v1/cards/:id
 */
cardsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  // TODO: Delete from database
  return c.json({
    success: true,
    data: { deleted: true },
  });
});

/**
 * POST /api/v1/cards/export
 */
cardsRoutes.post('/export', zValidator('json', exportSchema), async (c) => {
  const options = c.req.valid('json');
  const user = c.get('user');

  // TODO: Generate export file
  return c.json({
    success: true,
    data: {
      deckName: 'Kairos Export',
      cardCount: 0,
      downloadUrl: null,
      format: options.format,
    },
  });
});

/**
 * POST /api/v1/cards/:id/upload-audio
 */
cardsRoutes.post('/:id/upload-audio', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  // TODO: Handle audio upload to storage
  return c.json({
    success: true,
    data: {
      audioUrl: null,
    },
  });
});

/**
 * POST /api/v1/cards/:id/upload-screenshot
 */
cardsRoutes.post('/:id/upload-screenshot', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  // TODO: Handle screenshot upload to storage
  return c.json({
    success: true,
    data: {
      screenshotUrl: null,
    },
  });
});
