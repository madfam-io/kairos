import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthenticatedEnv } from '../types';
import { requireAuth, requireSubscription } from '../middleware/auth';

export const syncRoutes = new Hono<AuthenticatedEnv>();

syncRoutes.use('*', requireAuth());
syncRoutes.use('*', requireSubscription('learner')); // Sync requires paid tier

const vectorClockSchema = z.record(z.string(), z.number());

const syncChangeSchema = z.object({
  id: z.string().uuid(),
  collection: z.enum(['vocabulary', 'cards', 'settings']),
  operation: z.enum(['create', 'update', 'delete']),
  documentId: z.string().uuid(),
  data: z.record(z.unknown()).nullable(),
  timestamp: z.string().datetime(),
  clientId: z.string(),
  vectorClock: vectorClockSchema,
});

const pushSchema = z.object({
  clientId: z.string(),
  lastSyncTimestamp: z.string().datetime().nullable(),
  changes: z.array(syncChangeSchema).max(100),
});

const pullSchema = z.object({
  clientId: z.string(),
  lastSyncTimestamp: z.string().datetime().nullable(),
  collections: z.array(z.enum(['vocabulary', 'cards', 'settings'])).optional(),
});

const resolveSchema = z.object({
  resolutions: z.array(
    z.object({
      conflictId: z.string().uuid(),
      resolution: z.discriminatedUnion('type', [
        z.object({ type: z.literal('use_client') }),
        z.object({ type: z.literal('use_server') }),
        z.object({ type: z.literal('merge'), mergedData: z.record(z.unknown()) }),
      ]),
    })
  ),
});

/**
 * POST /api/v1/sync/push
 * Push local changes to server
 */
syncRoutes.post('/push', zValidator('json', pushSchema), async (c) => {
  const { clientId, lastSyncTimestamp, changes } = c.req.valid('json');
  const user = c.get('user');

  // TODO: Process changes, detect conflicts, apply accepted changes
  const accepted: string[] = [];
  const conflicts: unknown[] = [];

  for (const change of changes) {
    // TODO: Check for conflicts using vector clocks
    // TODO: Apply change to database
    accepted.push(change.id);
  }

  return c.json({
    success: true,
    data: {
      accepted,
      conflicts,
      serverTimestamp: new Date(),
    },
  });
});

/**
 * GET /api/v1/sync/pull
 * Pull server changes to client
 */
syncRoutes.post('/pull', zValidator('json', pullSchema), async (c) => {
  const { clientId, lastSyncTimestamp, collections } = c.req.valid('json');
  const user = c.get('user');

  // TODO: Fetch changes since lastSyncTimestamp
  const changes: unknown[] = [];

  return c.json({
    success: true,
    data: {
      changes,
      serverTimestamp: new Date(),
      hasMore: false,
    },
  });
});

/**
 * POST /api/v1/sync/resolve
 * Resolve sync conflicts
 */
syncRoutes.post('/resolve', zValidator('json', resolveSchema), async (c) => {
  const { resolutions } = c.req.valid('json');
  const user = c.get('user');

  // TODO: Apply conflict resolutions
  const resolved: string[] = [];

  for (const resolution of resolutions) {
    // TODO: Apply resolution
    resolved.push(resolution.conflictId);
  }

  return c.json({
    success: true,
    data: {
      resolved,
      serverTimestamp: new Date(),
    },
  });
});

/**
 * GET /api/v1/sync/status
 * Get current sync status
 */
syncRoutes.get('/status', async (c) => {
  const user = c.get('user');

  // TODO: Fetch sync status from database
  return c.json({
    success: true,
    data: {
      lastSyncTimestamp: null,
      pendingCount: 0,
      conflictCount: 0,
      syncStatus: 'idle',
    },
  });
});
