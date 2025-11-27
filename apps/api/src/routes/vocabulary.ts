import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, sql, desc, asc, ilike, lte, count } from 'drizzle-orm';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { vocabulary } from '../db/schema';
import { AppError } from '../middleware/error-handler';
import { log } from '../lib/logger';

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
        hskLevel: z.number().int().min(1).max(6).optional(),
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
 * List user's vocabulary with filtering, sorting, and pagination
 */
vocabularyRoutes.get('/', zValidator('query', vocabularyQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user');

  // Build where conditions
  const conditions = [eq(vocabulary.userId, user.id)];

  if (query.status) {
    conditions.push(eq(vocabulary.status, query.status));
  }

  if (query.hskLevel) {
    conditions.push(eq(vocabulary.hskLevel, query.hskLevel));
  }

  if (query.search) {
    conditions.push(ilike(vocabulary.word, `%${query.search}%`));
  }

  // Determine sort column
  const sortColumn = {
    createdAt: vocabulary.createdAt,
    updatedAt: vocabulary.updatedAt,
    nextReview: vocabulary.nextReview,
    word: vocabulary.word,
  }[query.sortBy];

  const sortFn = query.sortOrder === 'desc' ? desc : asc;

  // Execute query
  const [words, [{ total }]] = await Promise.all([
    db
      .select()
      .from(vocabulary)
      .where(and(...conditions))
      .orderBy(sortFn(sortColumn))
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ total: count() })
      .from(vocabulary)
      .where(and(...conditions)),
  ]);

  const totalPages = Math.ceil(total / query.limit);

  return c.json({
    success: true,
    data: words,
    meta: {
      pagination: {
        page: Math.floor(query.offset / query.limit) + 1,
        limit: query.limit,
        total,
        totalPages,
        hasMore: query.offset + words.length < total,
      },
    },
  });
});

/**
 * POST /api/v1/vocabulary/batch
 * Add multiple words at once, skipping duplicates
 */
vocabularyRoutes.post('/batch', zValidator('json', batchCreateSchema), async (c) => {
  const { words } = c.req.valid('json');
  const user = c.get('user');

  let created = 0;
  let duplicates = 0;

  // Use transaction for atomic batch insert
  await db.transaction(async (tx) => {
    for (const word of words) {
      try {
        await tx
          .insert(vocabulary)
          .values({
            userId: user.id,
            word: word.word,
            pinyin: word.pinyin,
            definition: word.definition,
            status: word.status || 'new',
            hskLevel: word.hskLevel,
          })
          .onConflictDoNothing();

        created++;
      } catch (error) {
        // Unique constraint violation = duplicate
        duplicates++;
      }
    }
  });

  // Adjust counts (onConflictDoNothing doesn't throw)
  // Re-count by checking what was actually inserted
  const actualCount = await db
    .select({ count: count() })
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, user.id),
        sql`${vocabulary.word} = ANY(${words.map(w => w.word)})`
      )
    );

  log.info('Batch vocabulary created', { userId: user.id, created, attempted: words.length });

  return c.json({
    success: true,
    data: {
      created,
      duplicates: words.length - created,
    },
  });
});

/**
 * GET /api/v1/vocabulary/stats
 * Get vocabulary statistics for the user
 */
vocabularyRoutes.get('/stats', async (c) => {
  const user = c.get('user');

  // Aggregate stats in a single query
  const stats = await db
    .select({
      total: count(),
      new: sql<number>`count(*) filter (where ${vocabulary.status} = 'new')`,
      learning: sql<number>`count(*) filter (where ${vocabulary.status} = 'learning')`,
      known: sql<number>`count(*) filter (where ${vocabulary.status} = 'known')`,
      dueForReview: sql<number>`count(*) filter (where ${vocabulary.nextReview} <= now())`,
      hsk1: sql<number>`count(*) filter (where ${vocabulary.hskLevel} = 1)`,
      hsk2: sql<number>`count(*) filter (where ${vocabulary.hskLevel} = 2)`,
      hsk3: sql<number>`count(*) filter (where ${vocabulary.hskLevel} = 3)`,
      hsk4: sql<number>`count(*) filter (where ${vocabulary.hskLevel} = 4)`,
      hsk5: sql<number>`count(*) filter (where ${vocabulary.hskLevel} = 5)`,
      hsk6: sql<number>`count(*) filter (where ${vocabulary.hskLevel} = 6)`,
    })
    .from(vocabulary)
    .where(eq(vocabulary.userId, user.id));

  const result = stats[0] || {
    total: 0, new: 0, learning: 0, known: 0, dueForReview: 0,
    hsk1: 0, hsk2: 0, hsk3: 0, hsk4: 0, hsk5: 0, hsk6: 0
  };

  return c.json({
    success: true,
    data: {
      total: result.total,
      new: result.new,
      learning: result.learning,
      known: result.known,
      dueForReview: result.dueForReview,
      byHskLevel: {
        1: result.hsk1,
        2: result.hsk2,
        3: result.hsk3,
        4: result.hsk4,
        5: result.hsk5,
        6: result.hsk6,
      },
    },
  });
});

/**
 * GET /api/v1/vocabulary/due
 * Get words due for review (SRS)
 */
vocabularyRoutes.get('/due', async (c) => {
  const user = c.get('user');
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const dueWords = await db
    .select()
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, user.id),
        lte(vocabulary.nextReview, new Date())
      )
    )
    .orderBy(asc(vocabulary.nextReview))
    .limit(Math.min(limit, 100));

  return c.json({
    success: true,
    data: dueWords,
  });
});

/**
 * GET /api/v1/vocabulary/:id
 * Get a single vocabulary word
 */
vocabularyRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const word = await db.query.vocabulary.findFirst({
    where: and(eq(vocabulary.id, id), eq(vocabulary.userId, user.id)),
  });

  if (!word) {
    throw new AppError('NOT_FOUND', 'Vocabulary word not found', 404);
  }

  return c.json({
    success: true,
    data: word,
  });
});

/**
 * PATCH /api/v1/vocabulary/:id
 * Update a vocabulary word
 */
vocabularyRoutes.patch('/:id', zValidator('json', updateSchema), async (c) => {
  const id = c.req.param('id');
  const updates = c.req.valid('json');
  const user = c.get('user');

  // Verify ownership
  const existing = await db.query.vocabulary.findFirst({
    where: and(eq(vocabulary.id, id), eq(vocabulary.userId, user.id)),
  });

  if (!existing) {
    throw new AppError('NOT_FOUND', 'Vocabulary word not found', 404);
  }

  const [updated] = await db
    .update(vocabulary)
    .set({
      ...updates,
      nextReview: updates.nextReview ? new Date(updates.nextReview) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, user.id)))
    .returning();

  return c.json({
    success: true,
    data: updated,
  });
});

/**
 * DELETE /api/v1/vocabulary/:id
 * Delete a vocabulary word
 */
vocabularyRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const result = await db
    .delete(vocabulary)
    .where(and(eq(vocabulary.id, id), eq(vocabulary.userId, user.id)))
    .returning({ id: vocabulary.id });

  if (result.length === 0) {
    throw new AppError('NOT_FOUND', 'Vocabulary word not found', 404);
  }

  return c.json({
    success: true,
    data: { deleted: true },
  });
});

/**
 * POST /api/v1/vocabulary/:id/review
 * Submit a review result and update SRS schedule
 */
vocabularyRoutes.post(
  '/:id/review',
  zValidator('json', z.object({ quality: z.number().int().min(0).max(5) })),
  async (c) => {
    const id = c.req.param('id');
    const { quality } = c.req.valid('json');
    const user = c.get('user');

    // Get current word data
    const word = await db.query.vocabulary.findFirst({
      where: and(eq(vocabulary.id, id), eq(vocabulary.userId, user.id)),
    });

    if (!word) {
      throw new AppError('NOT_FOUND', 'Vocabulary word not found', 404);
    }

    // SM-2 Algorithm implementation
    let easeFactor = word.easeFactor;
    let interval: number;
    let repetitions = word.reviewCount;

    if (quality < 3) {
      // Failed review - reset
      repetitions = 0;
      interval = 1;
    } else {
      // Successful review
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(word.reviewCount * easeFactor);
      }

      // Update ease factor
      easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      easeFactor = Math.max(1.3, easeFactor); // Minimum ease factor

      repetitions++;
    }

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    // Determine new status
    let newStatus = word.status;
    if (quality >= 4 && repetitions >= 5) {
      newStatus = 'known';
    } else if (quality >= 3) {
      newStatus = 'learning';
    }

    // Update word
    const [updated] = await db
      .update(vocabulary)
      .set({
        easeFactor,
        nextReview,
        reviewCount: repetitions,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(vocabulary.id, id))
      .returning();

    return c.json({
      success: true,
      data: {
        id: updated.id,
        newEaseFactor: easeFactor,
        newInterval: interval,
        nextReview,
        reviewCount: repetitions,
        status: newStatus,
      },
    });
  }
);
