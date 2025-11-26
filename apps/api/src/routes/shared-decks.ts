/**
 * Shared Vocabulary Decks Routes
 * Community-created vocabulary lists that users can browse, like, and import
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, asc, ilike, or, sql, inArray } from 'drizzle-orm';
import type { AppEnv } from '../types';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import {
  db,
  sharedDecks,
  sharedDeckWords,
  sharedDeckLikes,
  userDeckDownloads,
  vocabulary,
  users,
} from '../db';

export const sharedDecksRoutes = new Hono<AppEnv>();

// Schemas
const createDeckSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false),
  category: z.enum(['hsk', 'topic', 'media', 'custom']).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  words: z
    .array(
      z.object({
        word: z.string().min(1),
        pinyin: z.string().optional(),
        definition: z.string().optional(),
        hskLevel: z.number().int().min(1).max(6).optional(),
        exampleSentence: z.string().optional(),
      })
    )
    .min(1)
    .max(500),
});

const updateDeckSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  category: z.enum(['hsk', 'topic', 'media', 'custom']).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

const addWordsSchema = z.object({
  words: z
    .array(
      z.object({
        word: z.string().min(1),
        pinyin: z.string().optional(),
        definition: z.string().optional(),
        hskLevel: z.number().int().min(1).max(6).optional(),
        exampleSentence: z.string().optional(),
      })
    )
    .min(1)
    .max(100),
});

const browseQuerySchema = z.object({
  category: z.enum(['hsk', 'topic', 'media', 'custom']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['popular', 'recent', 'downloads', 'likes']).default('popular'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/v1/decks
 * Browse public shared decks
 */
sharedDecksRoutes.get('/', optionalAuth(), zValidator('query', browseQuerySchema), async (c) => {
  const { category, search, sortBy, limit, offset } = c.req.valid('query');

  // Build where clause
  const conditions = [eq(sharedDecks.isPublic, true)];

  if (category) {
    conditions.push(eq(sharedDecks.category, category));
  }

  if (search) {
    conditions.push(
      or(ilike(sharedDecks.name, `%${search}%`), ilike(sharedDecks.description, `%${search}%`))!
    );
  }

  // Build order by
  let orderBy;
  switch (sortBy) {
    case 'popular':
      orderBy = desc(sql`${sharedDecks.downloadCount} + ${sharedDecks.likeCount}`);
      break;
    case 'downloads':
      orderBy = desc(sharedDecks.downloadCount);
      break;
    case 'likes':
      orderBy = desc(sharedDecks.likeCount);
      break;
    case 'recent':
    default:
      orderBy = desc(sharedDecks.createdAt);
  }

  // Get decks with author info
  const decks = await db
    .select({
      id: sharedDecks.id,
      name: sharedDecks.name,
      description: sharedDecks.description,
      category: sharedDecks.category,
      tags: sharedDecks.tags,
      wordCount: sharedDecks.wordCount,
      downloadCount: sharedDecks.downloadCount,
      likeCount: sharedDecks.likeCount,
      createdAt: sharedDecks.createdAt,
      authorId: sharedDecks.authorId,
      authorEmail: users.email,
    })
    .from(sharedDecks)
    .leftJoin(users, eq(sharedDecks.authorId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sharedDecks)
    .where(and(...conditions));

  return c.json({
    success: true,
    data: decks.map((d) => ({
      ...d,
      author: { id: d.authorId, email: d.authorEmail?.split('@')[0] + '@...' },
    })),
    meta: {
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + decks.length < count,
      },
    },
  });
});

/**
 * GET /api/v1/decks/mine
 * Get user's own decks
 */
sharedDecksRoutes.get('/mine', requireAuth(), async (c) => {
  const user = c.get('user');

  const decks = await db
    .select()
    .from(sharedDecks)
    .where(eq(sharedDecks.authorId, user.id))
    .orderBy(desc(sharedDecks.updatedAt));

  return c.json({
    success: true,
    data: decks,
  });
});

/**
 * GET /api/v1/decks/downloaded
 * Get decks the user has downloaded
 */
sharedDecksRoutes.get('/downloaded', requireAuth(), async (c) => {
  const user = c.get('user');

  const downloads = await db
    .select({
      downloadedAt: userDeckDownloads.downloadedAt,
      deck: {
        id: sharedDecks.id,
        name: sharedDecks.name,
        description: sharedDecks.description,
        category: sharedDecks.category,
        wordCount: sharedDecks.wordCount,
      },
    })
    .from(userDeckDownloads)
    .innerJoin(sharedDecks, eq(userDeckDownloads.deckId, sharedDecks.id))
    .where(eq(userDeckDownloads.userId, user.id))
    .orderBy(desc(userDeckDownloads.downloadedAt));

  return c.json({
    success: true,
    data: downloads,
  });
});

/**
 * POST /api/v1/decks
 * Create a new deck
 */
sharedDecksRoutes.post('/', requireAuth(), zValidator('json', createDeckSchema), async (c) => {
  const user = c.get('user');
  const { name, description, isPublic, category, tags, words } = c.req.valid('json');

  // Create deck
  const [deck] = await db
    .insert(sharedDecks)
    .values({
      authorId: user.id,
      name,
      description,
      isPublic,
      category,
      tags: tags || [],
      wordCount: words.length,
    })
    .returning();

  // Insert words
  if (words.length > 0) {
    await db.insert(sharedDeckWords).values(
      words.map((w, index) => ({
        deckId: deck.id,
        word: w.word,
        pinyin: w.pinyin,
        definition: w.definition,
        hskLevel: w.hskLevel,
        exampleSentence: w.exampleSentence,
        order: index,
      }))
    );
  }

  return c.json({
    success: true,
    data: deck,
  });
});

/**
 * GET /api/v1/decks/:id
 * Get deck details with words
 */
sharedDecksRoutes.get('/:id', optionalAuth(), async (c) => {
  const deckId = c.req.param('id');
  const user = c.get('user');

  // Get deck
  const [deck] = await db
    .select({
      id: sharedDecks.id,
      name: sharedDecks.name,
      description: sharedDecks.description,
      isPublic: sharedDecks.isPublic,
      category: sharedDecks.category,
      tags: sharedDecks.tags,
      wordCount: sharedDecks.wordCount,
      downloadCount: sharedDecks.downloadCount,
      likeCount: sharedDecks.likeCount,
      createdAt: sharedDecks.createdAt,
      updatedAt: sharedDecks.updatedAt,
      authorId: sharedDecks.authorId,
      authorEmail: users.email,
    })
    .from(sharedDecks)
    .leftJoin(users, eq(sharedDecks.authorId, users.id))
    .where(eq(sharedDecks.id, deckId))
    .limit(1);

  if (!deck) {
    throw new AppError('Deck not found', 404);
  }

  // Check access
  if (!deck.isPublic && (!user || deck.authorId !== user.id)) {
    throw new AppError('Deck not found', 404);
  }

  // Get words
  const words = await db
    .select()
    .from(sharedDeckWords)
    .where(eq(sharedDeckWords.deckId, deckId))
    .orderBy(asc(sharedDeckWords.order));

  // Check if user has liked
  let isLiked = false;
  let isDownloaded = false;
  if (user) {
    const [like] = await db
      .select()
      .from(sharedDeckLikes)
      .where(and(eq(sharedDeckLikes.deckId, deckId), eq(sharedDeckLikes.userId, user.id)))
      .limit(1);
    isLiked = !!like;

    const [download] = await db
      .select()
      .from(userDeckDownloads)
      .where(and(eq(userDeckDownloads.deckId, deckId), eq(userDeckDownloads.userId, user.id)))
      .limit(1);
    isDownloaded = !!download;
  }

  return c.json({
    success: true,
    data: {
      ...deck,
      author: { id: deck.authorId, name: deck.authorEmail?.split('@')[0] },
      words,
      isLiked,
      isDownloaded,
      isOwner: user?.id === deck.authorId,
    },
  });
});

/**
 * PATCH /api/v1/decks/:id
 * Update deck metadata
 */
sharedDecksRoutes.patch(
  '/:id',
  requireAuth(),
  zValidator('json', updateDeckSchema),
  async (c) => {
    const deckId = c.req.param('id');
    const user = c.get('user');
    const updates = c.req.valid('json');

    // Check ownership
    const [deck] = await db
      .select()
      .from(sharedDecks)
      .where(and(eq(sharedDecks.id, deckId), eq(sharedDecks.authorId, user.id)))
      .limit(1);

    if (!deck) {
      throw new AppError('Deck not found or unauthorized', 404);
    }

    // Update
    const [updated] = await db
      .update(sharedDecks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(sharedDecks.id, deckId))
      .returning();

    return c.json({
      success: true,
      data: updated,
    });
  }
);

/**
 * DELETE /api/v1/decks/:id
 * Delete a deck
 */
sharedDecksRoutes.delete('/:id', requireAuth(), async (c) => {
  const deckId = c.req.param('id');
  const user = c.get('user');

  // Check ownership
  const [deck] = await db
    .select()
    .from(sharedDecks)
    .where(and(eq(sharedDecks.id, deckId), eq(sharedDecks.authorId, user.id)))
    .limit(1);

  if (!deck) {
    throw new AppError('Deck not found or unauthorized', 404);
  }

  // Delete (cascade will handle words, likes, downloads)
  await db.delete(sharedDecks).where(eq(sharedDecks.id, deckId));

  return c.json({
    success: true,
    data: { deleted: true },
  });
});

/**
 * POST /api/v1/decks/:id/words
 * Add words to a deck
 */
sharedDecksRoutes.post(
  '/:id/words',
  requireAuth(),
  zValidator('json', addWordsSchema),
  async (c) => {
    const deckId = c.req.param('id');
    const user = c.get('user');
    const { words } = c.req.valid('json');

    // Check ownership
    const [deck] = await db
      .select()
      .from(sharedDecks)
      .where(and(eq(sharedDecks.id, deckId), eq(sharedDecks.authorId, user.id)))
      .limit(1);

    if (!deck) {
      throw new AppError('Deck not found or unauthorized', 404);
    }

    // Get current max order
    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${sharedDeckWords.order}), -1)` })
      .from(sharedDeckWords)
      .where(eq(sharedDeckWords.deckId, deckId));

    // Insert words
    await db.insert(sharedDeckWords).values(
      words.map((w, index) => ({
        deckId,
        word: w.word,
        pinyin: w.pinyin,
        definition: w.definition,
        hskLevel: w.hskLevel,
        exampleSentence: w.exampleSentence,
        order: maxOrder + 1 + index,
      }))
    );

    // Update word count
    await db
      .update(sharedDecks)
      .set({
        wordCount: sql`${sharedDecks.wordCount} + ${words.length}`,
        updatedAt: new Date(),
      })
      .where(eq(sharedDecks.id, deckId));

    return c.json({
      success: true,
      data: { added: words.length },
    });
  }
);

/**
 * POST /api/v1/decks/:id/like
 * Like/unlike a deck
 */
sharedDecksRoutes.post('/:id/like', requireAuth(), async (c) => {
  const deckId = c.req.param('id');
  const user = c.get('user');

  // Check deck exists and is public
  const [deck] = await db
    .select()
    .from(sharedDecks)
    .where(and(eq(sharedDecks.id, deckId), eq(sharedDecks.isPublic, true)))
    .limit(1);

  if (!deck) {
    throw new AppError('Deck not found', 404);
  }

  // Check if already liked
  const [existingLike] = await db
    .select()
    .from(sharedDeckLikes)
    .where(and(eq(sharedDeckLikes.deckId, deckId), eq(sharedDeckLikes.userId, user.id)))
    .limit(1);

  if (existingLike) {
    // Unlike
    await db
      .delete(sharedDeckLikes)
      .where(and(eq(sharedDeckLikes.deckId, deckId), eq(sharedDeckLikes.userId, user.id)));
    await db
      .update(sharedDecks)
      .set({ likeCount: sql`${sharedDecks.likeCount} - 1` })
      .where(eq(sharedDecks.id, deckId));

    return c.json({
      success: true,
      data: { liked: false },
    });
  } else {
    // Like
    await db.insert(sharedDeckLikes).values({
      deckId,
      userId: user.id,
    });
    await db
      .update(sharedDecks)
      .set({ likeCount: sql`${sharedDecks.likeCount} + 1` })
      .where(eq(sharedDecks.id, deckId));

    return c.json({
      success: true,
      data: { liked: true },
    });
  }
});

/**
 * POST /api/v1/decks/:id/import
 * Import deck words to user's vocabulary
 */
sharedDecksRoutes.post('/:id/import', requireAuth(), async (c) => {
  const deckId = c.req.param('id');
  const user = c.get('user');

  // Get deck
  const [deck] = await db.select().from(sharedDecks).where(eq(sharedDecks.id, deckId)).limit(1);

  if (!deck) {
    throw new AppError('Deck not found', 404);
  }

  // Check access
  if (!deck.isPublic && deck.authorId !== user.id) {
    throw new AppError('Deck not found', 404);
  }

  // Get deck words
  const words = await db
    .select()
    .from(sharedDeckWords)
    .where(eq(sharedDeckWords.deckId, deckId))
    .orderBy(asc(sharedDeckWords.order));

  // Import words to user's vocabulary (skip duplicates)
  let imported = 0;
  let skipped = 0;

  for (const word of words) {
    try {
      await db
        .insert(vocabulary)
        .values({
          userId: user.id,
          word: word.word,
          pinyin: word.pinyin,
          definition: word.definition,
          hskLevel: word.hskLevel,
          status: 'new',
        })
        .onConflictDoNothing();
      imported++;
    } catch {
      skipped++;
    }
  }

  // Record download
  await db
    .insert(userDeckDownloads)
    .values({
      userId: user.id,
      deckId,
    })
    .onConflictDoNothing();

  // Increment download count (only if first time)
  const [existingDownload] = await db
    .select()
    .from(userDeckDownloads)
    .where(and(eq(userDeckDownloads.userId, user.id), eq(userDeckDownloads.deckId, deckId)))
    .limit(1);

  if (!existingDownload) {
    await db
      .update(sharedDecks)
      .set({ downloadCount: sql`${sharedDecks.downloadCount} + 1` })
      .where(eq(sharedDecks.id, deckId));
  }

  return c.json({
    success: true,
    data: {
      imported,
      skipped,
      total: words.length,
    },
  });
});

/**
 * POST /api/v1/decks/from-vocabulary
 * Create a deck from user's vocabulary
 */
sharedDecksRoutes.post(
  '/from-vocabulary',
  requireAuth(),
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      isPublic: z.boolean().default(false),
      category: z.enum(['hsk', 'topic', 'media', 'custom']).optional(),
      tags: z.array(z.string().max(30)).max(10).optional(),
      wordIds: z.array(z.string().uuid()).optional(),
      filter: z
        .object({
          status: z.enum(['new', 'learning', 'known']).optional(),
          hskLevel: z.number().int().min(1).max(6).optional(),
        })
        .optional(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { name, description, isPublic, category, tags, wordIds, filter } = c.req.valid('json');

    // Get user's vocabulary
    let conditions = [eq(vocabulary.userId, user.id)];

    if (wordIds && wordIds.length > 0) {
      conditions.push(inArray(vocabulary.id, wordIds));
    }
    if (filter?.status) {
      conditions.push(eq(vocabulary.status, filter.status));
    }
    if (filter?.hskLevel) {
      conditions.push(eq(vocabulary.hskLevel, filter.hskLevel));
    }

    const userWords = await db
      .select()
      .from(vocabulary)
      .where(and(...conditions))
      .limit(500);

    if (userWords.length === 0) {
      throw new AppError('No words found matching criteria', 400);
    }

    // Create deck
    const [deck] = await db
      .insert(sharedDecks)
      .values({
        authorId: user.id,
        name,
        description,
        isPublic,
        category,
        tags: tags || [],
        wordCount: userWords.length,
      })
      .returning();

    // Insert words
    await db.insert(sharedDeckWords).values(
      userWords.map((w, index) => ({
        deckId: deck.id,
        word: w.word,
        pinyin: w.pinyin,
        definition: w.definition,
        hskLevel: w.hskLevel,
        order: index,
      }))
    );

    return c.json({
      success: true,
      data: {
        deck,
        wordCount: userWords.length,
      },
    });
  }
);
