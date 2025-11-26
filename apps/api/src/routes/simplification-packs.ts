/**
 * Pre-computed Simplification Packs Routes
 * API for accessing pre-simplified show content
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requireAuth, requireSubscription, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import {
  getAvailablePacks,
  getSimplification,
  getEpisodeSimplifications,
  batchGetSimplifications,
  getPackStats,
  getCachedSimplification,
  cacheSimplification,
  saveSimplification,
  batchSaveSimplifications,
  verifySimplification,
} from '../services/simplification-packs';

export const simplificationPacksRoutes = new Hono<AppEnv>();

const getSimplificationSchema = z.object({
  showId: z.string().min(1),
  episode: z.coerce.number().int().positive(),
  subtitleIndex: z.coerce.number().int().min(0),
  hskLevel: z.coerce.number().int().min(3).max(5) as z.ZodType<3 | 4 | 5>,
});

const batchGetSchema = z.object({
  showId: z.string().min(1),
  episode: z.number().int().positive(),
  subtitleIndices: z.array(z.number().int().min(0)).min(1).max(100),
  hskLevel: z.number().int().min(3).max(5) as z.ZodType<3 | 4 | 5>,
});

const episodeQuerySchema = z.object({
  showId: z.string().min(1),
  episode: z.coerce.number().int().positive(),
});

const saveSchema = z.object({
  showId: z.string().min(1),
  episode: z.number().int().positive(),
  subtitleIndex: z.number().int().min(0),
  originalText: z.string().min(1),
  simplifications: z.object({
    hsk3: z.string().optional(),
    hsk4: z.string().optional(),
    hsk5: z.string().optional(),
  }),
  verified: z.boolean().optional(),
});

const batchSaveSchema = z.object({
  showId: z.string().min(1),
  episode: z.number().int().positive(),
  simplifications: z
    .array(
      z.object({
        subtitleIndex: z.number().int().min(0),
        originalText: z.string().min(1),
        hsk3: z.string().optional(),
        hsk4: z.string().optional(),
        hsk5: z.string().optional(),
      })
    )
    .min(1)
    .max(500),
});

/**
 * GET /api/v1/packs
 * List available simplification packs
 */
simplificationPacksRoutes.get('/', optionalAuth(), async (c) => {
  const packs = getAvailablePacks();

  return c.json({
    success: true,
    data: packs,
  });
});

/**
 * GET /api/v1/packs/:showId
 * Get pack details and stats
 */
simplificationPacksRoutes.get('/:showId', optionalAuth(), async (c) => {
  const showId = c.req.param('showId');
  const packs = getAvailablePacks();
  const pack = packs.find((p) => p.showId === showId);

  if (!pack) {
    throw new AppError('Pack not found', 404);
  }

  const stats = await getPackStats(showId);

  return c.json({
    success: true,
    data: {
      ...pack,
      stats,
    },
  });
});

/**
 * GET /api/v1/packs/simplification
 * Get a single simplification
 */
simplificationPacksRoutes.get(
  '/simplification',
  requireAuth(),
  requireSubscription('learner'),
  zValidator('query', getSimplificationSchema),
  async (c) => {
    const { showId, episode, subtitleIndex, hskLevel } = c.req.valid('query');

    const simplification = await getSimplification(showId, episode, subtitleIndex, hskLevel);

    return c.json({
      success: true,
      data: {
        showId,
        episode,
        subtitleIndex,
        hskLevel,
        simplifiedText: simplification,
        found: !!simplification,
      },
    });
  }
);

/**
 * POST /api/v1/packs/batch
 * Batch get simplifications for multiple subtitles
 */
simplificationPacksRoutes.post(
  '/batch',
  requireAuth(),
  requireSubscription('learner'),
  zValidator('json', batchGetSchema),
  async (c) => {
    const { showId, episode, subtitleIndices, hskLevel } = c.req.valid('json');

    const simplifications = await batchGetSimplifications(showId, episode, subtitleIndices, hskLevel);

    return c.json({
      success: true,
      data: {
        showId,
        episode,
        hskLevel,
        simplifications: Object.fromEntries(simplifications),
        found: simplifications.size,
        total: subtitleIndices.length,
      },
    });
  }
);

/**
 * GET /api/v1/packs/episode
 * Get all simplifications for an episode
 */
simplificationPacksRoutes.get(
  '/episode',
  requireAuth(),
  requireSubscription('learner'),
  zValidator('query', episodeQuerySchema),
  async (c) => {
    const { showId, episode } = c.req.valid('query');

    const simplifications = await getEpisodeSimplifications(showId, episode);

    return c.json({
      success: true,
      data: {
        showId,
        episode,
        subtitles: simplifications,
        count: simplifications.length,
      },
    });
  }
);

/**
 * POST /api/v1/packs/cache/check
 * Check cache for a simplification
 */
simplificationPacksRoutes.post(
  '/cache/check',
  requireAuth(),
  requireSubscription('learner'),
  zValidator(
    'json',
    z.object({
      text: z.string().min(1).max(1000),
      hskLevel: z.number().int().min(1).max(6),
    })
  ),
  async (c) => {
    const { text, hskLevel } = c.req.valid('json');

    const cached = await getCachedSimplification(text, hskLevel);

    return c.json({
      success: true,
      data: {
        cached: !!cached,
        simplifiedText: cached,
      },
    });
  }
);

/**
 * POST /api/v1/packs/cache/save
 * Save a simplification to cache (called after LLM simplification)
 */
simplificationPacksRoutes.post(
  '/cache/save',
  requireAuth(),
  requireSubscription('learner'),
  zValidator(
    'json',
    z.object({
      originalText: z.string().min(1).max(1000),
      hskLevel: z.number().int().min(1).max(6),
      simplifiedText: z.string().min(1).max(1000),
      modelVersion: z.string().optional(),
    })
  ),
  async (c) => {
    const { originalText, hskLevel, simplifiedText, modelVersion } = c.req.valid('json');

    await cacheSimplification(originalText, hskLevel, simplifiedText, modelVersion);

    return c.json({
      success: true,
      data: { saved: true },
    });
  }
);

// Admin routes for managing packs

/**
 * POST /api/v1/packs/admin/save
 * Save a pre-computed simplification (admin only)
 */
simplificationPacksRoutes.post(
  '/admin/save',
  requireAuth(),
  zValidator('json', saveSchema),
  async (c) => {
    const user = c.get('user');

    if (user.role !== 'admin') {
      throw new AppError('Forbidden', 403);
    }

    const { showId, episode, subtitleIndex, originalText, simplifications, verified } =
      c.req.valid('json');

    await saveSimplification(showId, episode, subtitleIndex, originalText, simplifications, verified);

    return c.json({
      success: true,
      data: { saved: true },
    });
  }
);

/**
 * POST /api/v1/packs/admin/batch-save
 * Batch save pre-computed simplifications (admin only)
 */
simplificationPacksRoutes.post(
  '/admin/batch-save',
  requireAuth(),
  zValidator('json', batchSaveSchema),
  async (c) => {
    const user = c.get('user');

    if (user.role !== 'admin') {
      throw new AppError('Forbidden', 403);
    }

    const { showId, episode, simplifications } = c.req.valid('json');

    const saved = await batchSaveSimplifications(showId, episode, simplifications);

    return c.json({
      success: true,
      data: { saved },
    });
  }
);

/**
 * POST /api/v1/packs/admin/verify
 * Mark a simplification as verified (admin only)
 */
simplificationPacksRoutes.post(
  '/admin/verify',
  requireAuth(),
  zValidator(
    'json',
    z.object({
      showId: z.string().min(1),
      episode: z.number().int().positive(),
      subtitleIndex: z.number().int().min(0),
    })
  ),
  async (c) => {
    const user = c.get('user');

    if (user.role !== 'admin') {
      throw new AppError('Forbidden', 403);
    }

    const { showId, episode, subtitleIndex } = c.req.valid('json');

    await verifySimplification(showId, episode, subtitleIndex);

    return c.json({
      success: true,
      data: { verified: true },
    });
  }
);
