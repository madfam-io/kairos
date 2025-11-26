import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, asc, ilike, inArray, sql } from 'drizzle-orm';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { db, cards as cardsTable } from '../db';
import {
  getAnkiClient,
  cardsToAnkiNotes,
  cardsToCSV,
  cardsToAnkiText,
  cardsToAnkiImport,
  enrichCardsWithDictionary,
} from '../services/anki';
import type { Card } from '@kairos/types';

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
  format: z.enum(['anki', 'anki-import', 'csv', 'json']).default('anki'),
  includeAudio: z.boolean().default(true),
  includeScreenshot: z.boolean().default(true),
  includeSimplified: z.boolean().default(true),
  cardIds: z.array(z.string().uuid()).optional(),
  enrichWithDictionary: z.boolean().default(true),
});

// Daily card limit for free tier
const FREE_TIER_DAILY_LIMIT = 5;

/**
 * GET /api/v1/cards
 */
cardsRoutes.get('/', zValidator('query', cardQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const user = c.get('user');

  // Build where conditions
  const conditions = [eq(cardsTable.userId, user.id)];

  if (query.exportedToAnki !== undefined) {
    conditions.push(eq(cardsTable.exportedToAnki, query.exportedToAnki));
  }

  if (query.search) {
    conditions.push(ilike(cardsTable.word, `%${query.search}%`));
  }

  if (query.sourceTitle) {
    conditions.push(eq(cardsTable.sourceTitle, query.sourceTitle));
  }

  // Get total count
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cardsTable)
    .where(and(...conditions));

  // Determine sort order
  const orderColumn = query.sortBy === 'word' ? cardsTable.word : cardsTable.createdAt;
  const orderFn = query.sortOrder === 'asc' ? asc : desc;

  // Fetch cards
  const cards = await db
    .select()
    .from(cardsTable)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(query.limit)
    .offset(query.offset);

  const totalPages = Math.ceil(total / query.limit);

  return c.json({
    success: true,
    data: cards,
    meta: {
      pagination: {
        page: Math.floor(query.offset / query.limit) + 1,
        limit: query.limit,
        total,
        totalPages,
        hasMore: query.offset + cards.length < total,
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

  // Check daily limit for free tier
  if (user.subscriptionTier === 'free') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ todayCount }] = await db
      .select({ todayCount: sql<number>`count(*)::int` })
      .from(cardsTable)
      .where(
        and(
          eq(cardsTable.userId, user.id),
          sql`${cardsTable.createdAt} >= ${today}`
        )
      );

    if (todayCount >= FREE_TIER_DAILY_LIMIT) {
      return c.json({
        success: false,
        error: {
          code: 'DAILY_LIMIT_REACHED',
          message: `Free tier is limited to ${FREE_TIER_DAILY_LIMIT} cards per day. Upgrade to create unlimited cards.`,
          limit: FREE_TIER_DAILY_LIMIT,
          used: todayCount,
        },
      }, 403);
    }
  }

  // Insert into database
  const [card] = await db
    .insert(cardsTable)
    .values({
      userId: user.id,
      word: cardData.word,
      sentence: cardData.sentence,
      simplifiedSentence: cardData.simplifiedSentence || null,
      sourceTitle: cardData.sourceTitle || null,
      sourceTimestamp: cardData.sourceTimestamp || null,
    })
    .returning();

  return c.json({
    success: true,
    data: card,
  });
});

/**
 * GET /api/v1/cards/:id
 */
cardsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const [card] = await db
    .select()
    .from(cardsTable)
    .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, user.id)));

  if (!card) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Card not found' },
    }, 404);
  }

  return c.json({
    success: true,
    data: card,
  });
});

/**
 * DELETE /api/v1/cards/:id
 */
cardsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const result = await db
    .delete(cardsTable)
    .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, user.id)))
    .returning({ id: cardsTable.id });

  if (result.length === 0) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Card not found' },
    }, 404);
  }

  return c.json({
    success: true,
    data: { deleted: true, id },
  });
});

/**
 * Helper to fetch cards for export
 */
async function fetchCardsForExport(
  userId: string,
  cardIds?: string[]
): Promise<Card[]> {
  if (cardIds && cardIds.length > 0) {
    return db
      .select()
      .from(cardsTable)
      .where(
        and(
          eq(cardsTable.userId, userId),
          inArray(cardsTable.id, cardIds)
        )
      ) as Promise<Card[]>;
  }

  return db
    .select()
    .from(cardsTable)
    .where(eq(cardsTable.userId, userId))
    .orderBy(desc(cardsTable.createdAt)) as Promise<Card[]>;
}

/**
 * POST /api/v1/cards/export
 * Export cards in various formats (CSV, JSON, Anki text)
 */
cardsRoutes.post('/export', zValidator('json', exportSchema), async (c) => {
  const options = c.req.valid('json');
  const user = c.get('user');

  let cards = await fetchCardsForExport(user.id, options.cardIds);

  if (cards.length === 0) {
    return c.json({
      success: false,
      error: { message: 'No cards to export' },
    }, 400);
  }

  // Enrich cards with dictionary data (pinyin, definitions, HSK level)
  if (options.enrichWithDictionary) {
    cards = await enrichCardsWithDictionary(cards);
  }

  switch (options.format) {
    case 'csv': {
      const csv = cardsToCSV(cards);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="kairos-cards.csv"',
        },
      });
    }

    case 'json': {
      return c.json({
        success: true,
        data: {
          cards,
          exportedAt: new Date().toISOString(),
          format: 'json',
          count: cards.length,
        },
      });
    }

    case 'anki-import': {
      // Full Anki import format with headers
      const ankiImport = cardsToAnkiImport(cards);
      return new Response(ankiImport, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': 'attachment; filename="kairos-cards-anki.txt"',
        },
      });
    }

    case 'anki':
    default: {
      const ankiText = cardsToAnkiText(cards);
      return new Response(ankiText, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': 'attachment; filename="kairos-cards.txt"',
        },
      });
    }
  }
});

const ankiConnectSchema = z.object({
  deckName: z.string().default('Kairos'),
  cardIds: z.array(z.string().uuid()).optional(),
});

/**
 * POST /api/v1/cards/anki-connect
 * Export cards directly to Anki via AnkiConnect
 */
cardsRoutes.post('/anki-connect', zValidator('json', ankiConnectSchema), async (c) => {
  const { deckName, cardIds } = c.req.valid('json');
  const user = c.get('user');

  const ankiClient = getAnkiClient();

  // Check if AnkiConnect is available
  const isAvailable = await ankiClient.ping();
  if (!isAvailable) {
    return c.json({
      success: false,
      error: {
        code: 'ANKI_CONNECT_UNAVAILABLE',
        message: 'AnkiConnect is not running. Please open Anki and ensure AnkiConnect add-on is installed.',
      },
    }, 503);
  }

  try {
    // Ensure deck and model exist
    await ankiClient.createDeck(deckName);
    await ankiClient.ensureKairosModel();

    // Fetch cards from database and enrich with dictionary data
    let cards = await fetchCardsForExport(user.id, cardIds);

    if (cards.length === 0) {
      return c.json({
        success: false,
        error: { message: 'No cards to export' },
      }, 400);
    }

    // Enrich cards with pinyin, definitions, HSK level
    cards = await enrichCardsWithDictionary(cards);

    // Convert to Anki notes
    const notes = cardsToAnkiNotes(cards, deckName);

    // Check which notes can be added (avoid duplicates)
    const canAdd = await ankiClient.canAddNotes(notes);
    const notesToAdd = notes.filter((_, i) => canAdd[i]);
    const exportedCardIds = cards
      .filter((_, i) => canAdd[i])
      .map((card) => card.id);

    if (notesToAdd.length === 0) {
      return c.json({
        success: true,
        data: {
          added: 0,
          skipped: notes.length,
          failed: 0,
          message: 'All cards already exist in Anki',
        },
      });
    }

    // Add notes to Anki
    const results = await ankiClient.addNotes(notesToAdd);
    const addedCount = results.filter((id) => id !== null).length;

    // Mark successfully exported cards in database
    if (exportedCardIds.length > 0) {
      await db
        .update(cardsTable)
        .set({ exportedToAnki: true })
        .where(
          and(
            eq(cardsTable.userId, user.id),
            inArray(cardsTable.id, exportedCardIds)
          )
        );
    }

    return c.json({
      success: true,
      data: {
        added: addedCount,
        skipped: notes.length - notesToAdd.length,
        failed: notesToAdd.length - addedCount,
        deckName,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      success: false,
      error: {
        code: 'ANKI_EXPORT_FAILED',
        message,
      },
    }, 500);
  }
});

/**
 * GET /api/v1/cards/anki-connect/status
 * Check AnkiConnect availability and get deck list
 */
cardsRoutes.get('/anki-connect/status', async (c) => {
  const ankiClient = getAnkiClient();

  try {
    const isAvailable = await ankiClient.ping();
    if (!isAvailable) {
      return c.json({
        success: true,
        data: {
          available: false,
          decks: [],
        },
      });
    }

    const decks = await ankiClient.getDecks();

    return c.json({
      success: true,
      data: {
        available: true,
        decks,
      },
    });
  } catch {
    return c.json({
      success: true,
      data: {
        available: false,
        decks: [],
      },
    });
  }
});

/**
 * POST /api/v1/cards/:id/upload-audio
 */
cardsRoutes.post('/:id/upload-audio', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  // Verify card exists and belongs to user
  const [card] = await db
    .select()
    .from(cardsTable)
    .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, user.id)));

  if (!card) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Card not found' },
    }, 404);
  }

  // Get form data
  const formData = await c.req.formData();
  const audioFile = formData.get('audio') as File | null;

  if (!audioFile) {
    return c.json({
      success: false,
      error: { message: 'No audio file provided' },
    }, 400);
  }

  // TODO: Upload to storage (S3, R2, etc.)
  // For now, store as base64 data URL for simplicity
  const audioBuffer = await audioFile.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString('base64');
  const audioUrl = `data:${audioFile.type};base64,${base64}`;

  // Update card
  const [updatedCard] = await db
    .update(cardsTable)
    .set({ audioUrl })
    .where(eq(cardsTable.id, id))
    .returning();

  return c.json({
    success: true,
    data: {
      audioUrl: updatedCard.audioUrl,
    },
  });
});

/**
 * POST /api/v1/cards/:id/upload-screenshot
 */
cardsRoutes.post('/:id/upload-screenshot', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  // Verify card exists and belongs to user
  const [card] = await db
    .select()
    .from(cardsTable)
    .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, user.id)));

  if (!card) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Card not found' },
    }, 404);
  }

  // Get form data
  const formData = await c.req.formData();
  const screenshotFile = formData.get('screenshot') as File | null;

  if (!screenshotFile) {
    return c.json({
      success: false,
      error: { message: 'No screenshot file provided' },
    }, 400);
  }

  // TODO: Upload to storage (S3, R2, etc.)
  // For now, store as base64 data URL for simplicity
  const imageBuffer = await screenshotFile.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const screenshotUrl = `data:${screenshotFile.type};base64,${base64}`;

  // Update card
  const [updatedCard] = await db
    .update(cardsTable)
    .set({ screenshotUrl })
    .where(eq(cardsTable.id, id))
    .returning();

  return c.json({
    success: true,
    data: {
      screenshotUrl: updatedCard.screenshotUrl,
    },
  });
});

/**
 * GET /api/v1/cards/stats
 * Get card statistics for the user
 */
cardsRoutes.get('/stats', async (c) => {
  const user = c.get('user');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      exported: sql<number>`count(*) filter (where ${cardsTable.exportedToAnki})::int`,
      today: sql<number>`count(*) filter (where ${cardsTable.createdAt} >= ${today})::int`,
    })
    .from(cardsTable)
    .where(eq(cardsTable.userId, user.id));

  return c.json({
    success: true,
    data: {
      totalCards: stats.total,
      exportedToAnki: stats.exported,
      createdToday: stats.today,
      dailyLimit: user.subscriptionTier === 'free' ? FREE_TIER_DAILY_LIMIT : null,
      remainingToday:
        user.subscriptionTier === 'free'
          ? Math.max(0, FREE_TIER_DAILY_LIMIT - stats.today)
          : null,
    },
  });
});
