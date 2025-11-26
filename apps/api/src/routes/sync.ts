import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, gt, count, desc, asc } from 'drizzle-orm';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { syncChanges, vocabulary, cards } from '../db/schema';
import { log } from '../lib/logger';

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
  clientId: z.string().optional(),
});

const pushSchema = z.object({
  operations: z.array(operationSchema).max(100),
  clientId: z.string(),
});

/**
 * POST /api/v1/sync/push
 * Push local changes to server using HLC timestamps (Last-Write-Wins)
 */
syncRoutes.post('/push', zValidator('json', pushSchema), async (c) => {
  const { operations, clientId } = c.req.valid('json');
  const user = c.get('user');
  const startTime = Date.now();

  const accepted: string[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];

  // Process operations in a transaction
  await db.transaction(async (tx) => {
    for (const op of operations) {
      try {
        // Create vector clock from HLC timestamp
        const vectorClock = {
          [op.timestamp.node]: {
            time: op.timestamp.time,
            counter: op.timestamp.counter,
          },
        };

        // Store the sync change for other clients to pull
        await tx.insert(syncChanges).values({
          userId: user.id,
          clientId: op.clientId || clientId,
          collection: op.entityType,
          operation: op.type,
          documentId: op.entityId,
          data: op.data,
          vectorClock,
          appliedAt: new Date(),
        });

        // Apply the operation to the actual data tables
        if (op.entityType === 'vocabulary') {
          await applyVocabularyOperation(tx, user.id, op);
        } else if (op.entityType === 'cards') {
          await applyCardsOperation(tx, user.id, op);
        }

        accepted.push(op.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error('Sync operation failed', error as Error, { opId: op.id });
        rejected.push({ id: op.id, reason: message });
      }
    }
  });

  // Generate server timestamp for client to use as lastSync
  const serverTimestamp = serializeHLC({
    time: Date.now(),
    counter: 0,
    node: 'server',
  });

  log.info('Sync push completed', {
    userId: user.id,
    clientId,
    accepted: accepted.length,
    rejected: rejected.length,
    processingTimeMs: Date.now() - startTime,
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
 * Apply vocabulary operation to the database
 */
async function applyVocabularyOperation(
  tx: typeof db,
  userId: string,
  op: z.infer<typeof operationSchema>
) {
  if (op.type === 'create' || op.type === 'update') {
    const data = op.data as Record<string, unknown>;
    await tx
      .insert(vocabulary)
      .values({
        id: op.entityId,
        userId,
        word: data.word as string,
        pinyin: data.pinyin as string | undefined,
        definition: data.definition as string | undefined,
        hskLevel: data.hskLevel as number | undefined,
        status: (data.status as string) || 'new',
        easeFactor: (data.easeFactor as number) || 2.5,
        nextReview: data.nextReview ? new Date(data.nextReview as string) : undefined,
        reviewCount: (data.reviewCount as number) || 0,
      })
      .onConflictDoUpdate({
        target: vocabulary.id,
        set: {
          word: data.word as string,
          pinyin: data.pinyin as string | undefined,
          definition: data.definition as string | undefined,
          hskLevel: data.hskLevel as number | undefined,
          status: data.status as string | undefined,
          easeFactor: data.easeFactor as number | undefined,
          nextReview: data.nextReview ? new Date(data.nextReview as string) : undefined,
          reviewCount: data.reviewCount as number | undefined,
          updatedAt: new Date(),
        },
      });
  } else if (op.type === 'delete') {
    await tx.delete(vocabulary).where(
      and(eq(vocabulary.id, op.entityId), eq(vocabulary.userId, userId))
    );
  }
}

/**
 * Apply cards operation to the database
 */
async function applyCardsOperation(
  tx: typeof db,
  userId: string,
  op: z.infer<typeof operationSchema>
) {
  if (op.type === 'create' || op.type === 'update') {
    const data = op.data as Record<string, unknown>;
    await tx
      .insert(cards)
      .values({
        id: op.entityId,
        userId,
        word: data.word as string,
        sentence: data.sentence as string | undefined,
        simplifiedSentence: data.simplifiedSentence as string | undefined,
        audioUrl: data.audioUrl as string | undefined,
        imageUrl: data.imageUrl as string | undefined,
        sourceUrl: data.sourceUrl as string | undefined,
        sourceTitle: data.sourceTitle as string | undefined,
        status: (data.status as string) || 'mined',
      })
      .onConflictDoUpdate({
        target: cards.id,
        set: {
          word: data.word as string,
          sentence: data.sentence as string | undefined,
          simplifiedSentence: data.simplifiedSentence as string | undefined,
          audioUrl: data.audioUrl as string | undefined,
          imageUrl: data.imageUrl as string | undefined,
          sourceUrl: data.sourceUrl as string | undefined,
          sourceTitle: data.sourceTitle as string | undefined,
          status: data.status as string | undefined,
          updatedAt: new Date(),
        },
      });
  } else if (op.type === 'delete') {
    await tx.delete(cards).where(
      and(eq(cards.id, op.entityId), eq(cards.userId, userId))
    );
  }
}

/**
 * GET /api/v1/sync/pull
 * Pull server changes since last sync
 */
syncRoutes.get('/pull', async (c) => {
  const user = c.get('user');
  const sinceParam = c.req.query('since');
  const clientId = c.req.query('clientId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '100'), 500);

  let sinceTime: Date | null = null;
  if (sinceParam) {
    const hlc = parseHLC(sinceParam);
    sinceTime = new Date(hlc.time);
  }

  // Build query conditions
  const conditions = [eq(syncChanges.userId, user.id)];

  // Exclude changes from the requesting client (they already have them)
  // and only get changes since the last sync
  if (sinceTime) {
    conditions.push(gt(syncChanges.createdAt, sinceTime));
  }

  // Fetch changes
  const changes = await db
    .select()
    .from(syncChanges)
    .where(and(...conditions))
    .orderBy(asc(syncChanges.createdAt))
    .limit(limit + 1);

  const hasMore = changes.length > limit;
  const resultChanges = hasMore ? changes.slice(0, limit) : changes;

  // Convert DB records to operations format
  const operations = resultChanges
    .filter(change => change.clientId !== clientId) // Exclude own changes
    .map((change) => {
      const vectorClock = change.vectorClock as Record<string, { time: number; counter: number }>;
      const firstNode = Object.keys(vectorClock)[0] || 'server';
      const clockData = vectorClock[firstNode] || { time: Date.now(), counter: 0 };

      return {
        id: change.id,
        entityId: change.documentId,
        entityType: change.collection,
        type: change.operation,
        data: change.data,
        timestamp: serializeHLC({
          time: clockData.time,
          counter: clockData.counter,
          node: firstNode,
        }),
        clientId: change.clientId,
      };
    });

  const serverTimestamp = serializeHLC({
    time: Date.now(),
    counter: 0,
    node: 'server',
  });

  return c.json({
    success: true,
    data: {
      operations,
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

  // Get counts in parallel
  const [
    [{ pendingChanges }],
    [{ totalVocabulary }],
    [{ totalCards }],
    lastSync,
  ] = await Promise.all([
    db.select({ pendingChanges: count() })
      .from(syncChanges)
      .where(eq(syncChanges.userId, user.id)),
    db.select({ totalVocabulary: count() })
      .from(vocabulary)
      .where(eq(vocabulary.userId, user.id)),
    db.select({ totalCards: count() })
      .from(cards)
      .where(eq(cards.userId, user.id)),
    db.select({ createdAt: syncChanges.createdAt })
      .from(syncChanges)
      .where(eq(syncChanges.userId, user.id))
      .orderBy(desc(syncChanges.createdAt))
      .limit(1),
  ]);

  const lastSyncTimestamp = lastSync[0]
    ? serializeHLC({
        time: lastSync[0].createdAt.getTime(),
        counter: 0,
        node: 'server',
      })
    : null;

  return c.json({
    success: true,
    data: {
      lastSyncTimestamp,
      pendingChanges,
      totalVocabulary,
      totalCards,
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

  // Fetch all user data in parallel
  const [userVocabulary, userCards] = await Promise.all([
    db.select().from(vocabulary).where(eq(vocabulary.userId, user.id)),
    db.select().from(cards).where(eq(cards.userId, user.id)),
  ]);

  const serverTimestamp = serializeHLC({
    time: Date.now(),
    counter: 0,
    node: 'server',
  });

  log.info('Full sync requested', {
    userId: user.id,
    vocabularyCount: userVocabulary.length,
    cardsCount: userCards.length,
  });

  return c.json({
    success: true,
    data: {
      vocabulary: userVocabulary,
      cards: userCards,
      timestamp: serverTimestamp,
    },
  });
});

/**
 * DELETE /api/v1/sync/history
 * Clear sync history (useful for debugging/testing)
 */
syncRoutes.delete('/history', async (c) => {
  const user = c.get('user');

  const result = await db
    .delete(syncChanges)
    .where(eq(syncChanges.userId, user.id))
    .returning({ id: syncChanges.id });

  log.info('Sync history cleared', { userId: user.id, deleted: result.length });

  return c.json({
    success: true,
    data: { deleted: result.length },
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
