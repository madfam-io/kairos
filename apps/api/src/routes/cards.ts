import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import {
  getAnkiClient,
  cardsToAnkiNotes,
  cardsToCSV,
  cardsToAnkiText,
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

  // TODO: Fetch cards from database based on cardIds or all user cards
  const cards: Card[] = []; // Placeholder - fetch from DB

  if (cards.length === 0) {
    return c.json({
      success: false,
      error: { message: 'No cards to export' },
    }, 400);
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

    // TODO: Fetch cards from database
    const cards: Card[] = []; // Placeholder - fetch from DB

    if (cards.length === 0) {
      return c.json({
        success: false,
        error: { message: 'No cards to export' },
      }, 400);
    }

    // Convert to Anki notes
    const notes = cardsToAnkiNotes(cards, deckName);

    // Check which notes can be added (avoid duplicates)
    const canAdd = await ankiClient.canAddNotes(notes);
    const notesToAdd = notes.filter((_, i) => canAdd[i]);

    if (notesToAdd.length === 0) {
      return c.json({
        success: true,
        data: {
          added: 0,
          skipped: notes.length,
          message: 'All cards already exist in Anki',
        },
      });
    }

    // Add notes to Anki
    const results = await ankiClient.addNotes(notesToAdd);
    const addedCount = results.filter((id) => id !== null).length;

    // TODO: Mark cards as exported in database

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
