/**
 * Offline Mode Routes
 * APIs for downloading offline data and syncing changes
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requireAuth, requireSubscription } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import {
  generateVocabularyPack,
  generateCardsPack,
  generateDeckPack,
  generateSimplificationsPack,
  processSyncQueue,
  getChangesSince,
  calculateChecksum,
  SyncQueueItem,
} from '../services/offline';
import { getAvailablePacks } from '../services/simplification-packs';

export const offlineRoutes = new Hono<AppEnv>();

// Require auth for all routes
offlineRoutes.use('*', requireAuth());

const syncQueueSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      operation: z.enum(['create', 'update', 'delete']),
      collection: z.enum(['vocabulary', 'cards', 'settings']),
      documentId: z.string(),
      data: z.record(z.unknown()),
      timestamp: z.number(),
      retryCount: z.number().default(0),
    })
  ),
});

const deltaSchema = z.object({
  collection: z.enum(['vocabulary', 'cards']),
  sinceVersion: z.number(),
});

/**
 * GET /api/v1/offline/status
 * Get offline mode status and available packs
 */
offlineRoutes.get('/status', async (c) => {
  const user = c.get('user');

  // Check subscription for offline access
  const hasOfflineAccess = user.subscriptionTier === 'immersion';

  const availableShowPacks = getAvailablePacks();

  return c.json({
    success: true,
    data: {
      offlineEnabled: hasOfflineAccess,
      subscriptionTier: user.subscriptionTier,
      availablePacks: {
        personal: ['vocabulary', 'cards'],
        shows: availableShowPacks.map((p) => ({
          showId: p.showId,
          showName: p.showName,
          episodes: p.totalEpisodes,
          verified: p.verified,
        })),
      },
      requiredTier: 'immersion',
    },
  });
});

/**
 * GET /api/v1/offline/vocabulary
 * Download user's vocabulary for offline use
 */
offlineRoutes.get('/vocabulary', requireSubscription('immersion'), async (c) => {
  const user = c.get('user');

  const pack = await generateVocabularyPack(user.id);
  const checksum = calculateChecksum(pack);

  return c.json({
    success: true,
    data: {
      ...pack,
      checksum,
      type: 'vocabulary',
      userId: user.id,
    },
  });
});

/**
 * GET /api/v1/offline/cards
 * Download user's cards for offline use
 */
offlineRoutes.get('/cards', requireSubscription('immersion'), async (c) => {
  const user = c.get('user');

  const pack = await generateCardsPack(user.id);
  const checksum = calculateChecksum(pack);

  return c.json({
    success: true,
    data: {
      ...pack,
      checksum,
      type: 'cards',
      userId: user.id,
    },
  });
});

/**
 * GET /api/v1/offline/deck/:deckId
 * Download a deck for offline use
 */
offlineRoutes.get('/deck/:deckId', requireSubscription('immersion'), async (c) => {
  const deckId = c.req.param('deckId');

  const pack = await generateDeckPack(deckId);

  if (!pack) {
    throw new AppError('Deck not found', 404);
  }

  const checksum = calculateChecksum(pack);

  return c.json({
    success: true,
    data: {
      ...pack,
      checksum,
      type: 'deck',
    },
  });
});

/**
 * GET /api/v1/offline/show/:showId
 * Download pre-computed simplifications for offline use
 */
offlineRoutes.get('/show/:showId', requireSubscription('immersion'), async (c) => {
  const showId = c.req.param('showId');

  const availablePacks = getAvailablePacks();
  const packInfo = availablePacks.find((p) => p.showId === showId);

  if (!packInfo) {
    throw new AppError('Show pack not found', 404);
  }

  const pack = await generateSimplificationsPack(showId, packInfo.showName);
  const checksum = calculateChecksum(pack);

  return c.json({
    success: true,
    data: {
      ...pack,
      checksum,
      type: 'simplifications',
    },
  });
});

/**
 * POST /api/v1/offline/sync
 * Sync offline changes to server
 */
offlineRoutes.post('/sync', zValidator('json', syncQueueSchema), async (c) => {
  const user = c.get('user');
  const { items } = c.req.valid('json');

  if (items.length === 0) {
    return c.json({
      success: true,
      data: {
        processed: 0,
        failed: [],
      },
    });
  }

  // Sort items by timestamp to maintain order
  const sortedItems = [...items].sort((a, b) => a.timestamp - b.timestamp);

  const result = await processSyncQueue(user.id, sortedItems as SyncQueueItem[]);

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/v1/offline/delta
 * Get changes since a specific version (for incremental sync)
 */
offlineRoutes.post('/delta', zValidator('json', deltaSchema), async (c) => {
  const user = c.get('user');
  const { collection, sinceVersion } = c.req.valid('json');

  const result = await getChangesSince(user.id, collection, sinceVersion);

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/v1/offline/manifest
 * Get manifest of all available offline data
 */
offlineRoutes.get('/manifest', requireSubscription('immersion'), async (c) => {
  const user = c.get('user');
  const availablePacks = getAvailablePacks();

  // Get current versions of user data
  const vocabPack = await generateVocabularyPack(user.id);
  const cardsPack = await generateCardsPack(user.id);

  return c.json({
    success: true,
    data: {
      personal: {
        vocabulary: {
          version: vocabPack.version,
          itemCount: vocabPack.words.length,
          checksum: calculateChecksum(vocabPack),
        },
        cards: {
          version: cardsPack.version,
          itemCount: cardsPack.cards.length,
          checksum: calculateChecksum(cardsPack),
        },
      },
      shows: availablePacks.map((p) => ({
        showId: p.showId,
        showName: p.showName,
        totalEpisodes: p.totalEpisodes,
        totalSubtitles: p.totalSubtitles,
        availableLevels: p.availableLevels,
        verified: p.verified,
      })),
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * POST /api/v1/offline/verify
 * Verify offline data integrity
 */
offlineRoutes.post(
  '/verify',
  zValidator(
    'json',
    z.object({
      type: z.enum(['vocabulary', 'cards', 'deck', 'show']),
      checksum: z.string(),
      id: z.string().optional(), // For deck/show
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { type, checksum, id } = c.req.valid('json');

    let serverChecksum: string;

    switch (type) {
      case 'vocabulary': {
        const pack = await generateVocabularyPack(user.id);
        serverChecksum = calculateChecksum(pack);
        break;
      }
      case 'cards': {
        const pack = await generateCardsPack(user.id);
        serverChecksum = calculateChecksum(pack);
        break;
      }
      case 'deck': {
        if (!id) throw new AppError('Deck ID required', 400);
        const pack = await generateDeckPack(id);
        if (!pack) throw new AppError('Deck not found', 404);
        serverChecksum = calculateChecksum(pack);
        break;
      }
      case 'show': {
        if (!id) throw new AppError('Show ID required', 400);
        const availablePacks = getAvailablePacks();
        const packInfo = availablePacks.find((p) => p.showId === id);
        if (!packInfo) throw new AppError('Show not found', 404);
        const pack = await generateSimplificationsPack(id, packInfo.showName);
        serverChecksum = calculateChecksum(pack);
        break;
      }
      default:
        throw new AppError('Invalid type', 400);
    }

    const valid = checksum === serverChecksum;

    return c.json({
      success: true,
      data: {
        valid,
        serverChecksum,
        clientChecksum: checksum,
        needsUpdate: !valid,
      },
    });
  }
);
