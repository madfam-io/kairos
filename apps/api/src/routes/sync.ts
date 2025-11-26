import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { eq, and, gt } from 'drizzle-orm';

export const syncRoutes = new Hono<AuthenticatedEnv>();

syncRoutes.use('*', requireAuth());

// HLC timestamp schema
const hlcTimestampSchema = z.object({
  time: z.number(),
  counter: z.number(),
  node: z.string(),
});

// Operation schema matching the CRDT package
const operationSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  entityType: z.enum(['vocabulary', 'cards']),
  type: z.enum(['create', 'update', 'delete']),
  data: z.record(z.unknown()).nullable(),
  timestamp: hlcTimestampSchema,
  userId: z.string(),
});

const pushSchema = z.object({
  operations: z.array(operationSchema).max(100),
});

/**
 * POST /api/v1/sync/push
 * Push local changes to server using HLC timestamps
 */
syncRoutes.post('/push', zValidator('json', pushSchema), async (c) => {
  const { operations } = c.req.valid('json');
  const user = c.get('user');
  const startTime = Date.now();

  const accepted: string[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];

  // TODO: Implement database operations
  // For each operation:
  // 1. Check if entity exists
  // 2. Compare HLC timestamps (LWW)
  // 3. Apply if newer, reject if older
  // 4. Store in sync_changes table for other clients

  for (const op of operations) {
    try {
      // Validate operation belongs to this user
      if (op.userId !== user.id && !op.userId.startsWith(user.id.slice(0, 8))) {
        rejected.push({ id: op.id, reason: 'Unauthorized' });
        continue;
      }

      // TODO: Actual database operation
      // For now, accept all valid operations
      accepted.push(op.id);

      // Store operation for other clients to pull
      // await db.insert(syncChanges).values({
      //   id: op.id,
      //   userId: user.id,
      //   entityId: op.entityId,
      //   entityType: op.entityType,
      //   operationType: op.type,
      //   data: op.data,
      //   hlcTime: op.timestamp.time,
      //   hlcCounter: op.timestamp.counter,
      //   hlcNode: op.timestamp.node,
      //   createdAt: new Date(),
      // });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      rejected.push({ id: op.id, reason: message });
    }
  }

  // Generate server timestamp for client to use as lastSync
  const serverTimestamp = serializeHLC({
    time: Date.now(),
    counter: 0,
    node: 'server',
  });

  return c.json({
    success: true,
    data: {
      accepted: accepted.length,
      acceptedIds: accepted,
      rejected,
      timestamp: serverTimestamp,
      processingTimeMs: Date.now() - startTime,
    },
  });
});

/**
 * GET /api/v1/sync/pull
 * Pull server changes since last sync
 */
syncRoutes.get('/pull', async (c) => {
  const user = c.get('user');
  const sinceParam = c.req.query('since');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100'), 500);

  let since: { time: number; counter: number; node: string } | null = null;
  if (sinceParam) {
    since = parseHLC(sinceParam);
  }

  // TODO: Fetch operations from database
  // const operations = await db.select()
  //   .from(syncChanges)
  //   .where(
  //     and(
  //       eq(syncChanges.userId, user.id),
  //       since ? gt(syncChanges.hlcTime, since.time) : undefined
  //     )
  //   )
  //   .orderBy(syncChanges.hlcTime, syncChanges.hlcCounter)
  //   .limit(limit + 1);

  const operations: any[] = []; // Placeholder

  const hasMore = operations.length > limit;
  const resultOps = hasMore ? operations.slice(0, limit) : operations;

  // Convert DB records to operations
  const formattedOps = resultOps.map((op: any) => ({
    id: op.id,
    entityId: op.entityId,
    entityType: op.entityType,
    type: op.operationType,
    data: op.data,
    timestamp: serializeHLC({
      time: op.hlcTime,
      counter: op.hlcCounter,
      node: op.hlcNode,
    }),
    userId: op.userId,
  }));

  const serverTimestamp = serializeHLC({
    time: Date.now(),
    counter: 0,
    node: 'server',
  });

  return c.json({
    success: true,
    data: {
      operations: formattedOps,
      timestamp: serverTimestamp,
      hasMore,
    },
  });
});

/**
 * GET /api/v1/sync/status
 * Get current sync status for the user
 */
syncRoutes.get('/status', async (c) => {
  const user = c.get('user');

  // TODO: Fetch actual status from database
  // const pendingCount = await db.select({ count: count() })
  //   .from(syncChanges)
  //   .where(eq(syncChanges.userId, user.id));

  return c.json({
    success: true,
    data: {
      lastSyncTimestamp: null,
      pendingChanges: 0,
      totalVocabulary: 0,
      totalCards: 0,
      serverTime: Date.now(),
    },
  });
});

/**
 * POST /api/v1/sync/full
 * Full sync - get all data (for initial sync or recovery)
 */
syncRoutes.post('/full', async (c) => {
  const user = c.get('user');

  // TODO: Fetch all user data
  // const vocabulary = await db.select().from(vocabularyTable).where(eq(...));
  // const cards = await db.select().from(cardsTable).where(eq(...));

  return c.json({
    success: true,
    data: {
      vocabulary: [],
      cards: [],
      timestamp: serializeHLC({
        time: Date.now(),
        counter: 0,
        node: 'server',
      }),
    },
  });
});

// Helper functions for HLC serialization
function serializeHLC(ts: { time: number; counter: number; node: string }): string {
  return `${ts.time.toString(36)}-${ts.counter.toString(36)}-${ts.node}`;
}

function parseHLC(str: string): { time: number; counter: number; node: string } {
  const [time, counter, node] = str.split('-');
  return {
    time: parseInt(time, 36),
    counter: parseInt(counter, 36),
    node,
  };
}
