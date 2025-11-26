/**
 * Offline Mode Service
 * Manages offline data packs and sync queue
 */

import { db, vocabulary, cards, sharedDecks, sharedDeckWords, showSimplifications } from '../db';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';

export interface OfflineDataPack {
  id: string;
  type: 'vocabulary' | 'cards' | 'deck' | 'simplifications';
  version: number;
  createdAt: Date;
  size: number;
  checksum: string;
}

export interface OfflineVocabularyPack {
  version: number;
  words: Array<{
    id: string;
    word: string;
    pinyin: string | null;
    definition: string | null;
    hskLevel: number | null;
    status: string;
    easeFactor: number;
    nextReview: string | null;
    reviewCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface OfflineCardsPack {
  version: number;
  cards: Array<{
    id: string;
    word: string;
    sentence: string | null;
    simplifiedSentence: string | null;
    audioUrl: string | null;
    screenshotUrl: string | null;
    sourceTitle: string | null;
    sourceTimestamp: string | null;
    exportedToAnki: boolean;
    createdAt: string;
  }>;
}

export interface OfflineDeckPack {
  version: number;
  deck: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    wordCount: number;
  };
  words: Array<{
    word: string;
    pinyin: string | null;
    definition: string | null;
    hskLevel: number | null;
    exampleSentence: string | null;
  }>;
}

export interface OfflineSimplificationsPack {
  version: number;
  showId: string;
  showName: string;
  episodes: Array<{
    episode: number;
    subtitles: Array<{
      index: number;
      original: string;
      hsk3: string | null;
      hsk4: string | null;
      hsk5: string | null;
    }>;
  }>;
}

export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  collection: 'vocabulary' | 'cards' | 'settings';
  documentId: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

/**
 * Generate offline vocabulary pack for a user
 */
export async function generateVocabularyPack(userId: string): Promise<OfflineVocabularyPack> {
  const words = await db
    .select()
    .from(vocabulary)
    .where(eq(vocabulary.userId, userId))
    .orderBy(desc(vocabulary.updatedAt));

  return {
    version: Date.now(),
    words: words.map((w) => ({
      id: w.id,
      word: w.word,
      pinyin: w.pinyin,
      definition: w.definition,
      hskLevel: w.hskLevel,
      status: w.status,
      easeFactor: w.easeFactor,
      nextReview: w.nextReview?.toISOString() ?? null,
      reviewCount: w.reviewCount,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    })),
  };
}

/**
 * Generate offline cards pack for a user
 */
export async function generateCardsPack(userId: string): Promise<OfflineCardsPack> {
  const userCards = await db
    .select()
    .from(cards)
    .where(eq(cards.userId, userId))
    .orderBy(desc(cards.createdAt));

  return {
    version: Date.now(),
    cards: userCards.map((c) => ({
      id: c.id,
      word: c.word,
      sentence: c.sentence,
      simplifiedSentence: c.simplifiedSentence,
      audioUrl: c.audioUrl,
      screenshotUrl: c.screenshotUrl,
      sourceTitle: c.sourceTitle,
      sourceTimestamp: c.sourceTimestamp,
      exportedToAnki: c.exportedToAnki,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

/**
 * Generate offline deck pack
 */
export async function generateDeckPack(deckId: string): Promise<OfflineDeckPack | null> {
  const [deck] = await db.select().from(sharedDecks).where(eq(sharedDecks.id, deckId)).limit(1);

  if (!deck) {
    return null;
  }

  const words = await db
    .select()
    .from(sharedDeckWords)
    .where(eq(sharedDeckWords.deckId, deckId))
    .orderBy(sharedDeckWords.order);

  return {
    version: Date.now(),
    deck: {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      category: deck.category,
      wordCount: deck.wordCount,
    },
    words: words.map((w) => ({
      word: w.word,
      pinyin: w.pinyin,
      definition: w.definition,
      hskLevel: w.hskLevel,
      exampleSentence: w.exampleSentence,
    })),
  };
}

/**
 * Generate offline simplifications pack for a show
 */
export async function generateSimplificationsPack(
  showId: string,
  showName: string
): Promise<OfflineSimplificationsPack> {
  const simplifications = await db
    .select()
    .from(showSimplifications)
    .where(eq(showSimplifications.showId, showId))
    .orderBy(showSimplifications.episode, showSimplifications.subtitleIndex);

  // Group by episode
  const episodesMap = new Map<number, typeof simplifications>();
  for (const s of simplifications) {
    if (!episodesMap.has(s.episode)) {
      episodesMap.set(s.episode, []);
    }
    episodesMap.get(s.episode)!.push(s);
  }

  const episodes = Array.from(episodesMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([episode, subs]) => ({
      episode,
      subtitles: subs.map((s) => ({
        index: s.subtitleIndex,
        original: s.originalText,
        hsk3: s.hsk3Text,
        hsk4: s.hsk4Text,
        hsk5: s.hsk5Text,
      })),
    }));

  return {
    version: Date.now(),
    showId,
    showName,
    episodes,
  };
}

/**
 * Process sync queue items (apply offline changes to server)
 */
export async function processSyncQueue(
  userId: string,
  items: SyncQueueItem[]
): Promise<{ processed: number; failed: string[] }> {
  const failed: string[] = [];
  let processed = 0;

  for (const item of items) {
    try {
      switch (item.collection) {
        case 'vocabulary':
          await processVocabularySync(userId, item);
          break;
        case 'cards':
          await processCardsSync(userId, item);
          break;
        case 'settings':
          // Settings sync handled separately
          break;
      }
      processed++;
    } catch (error) {
      console.error('Sync item failed:', item.id, error);
      failed.push(item.id);
    }
  }

  return { processed, failed };
}

async function processVocabularySync(userId: string, item: SyncQueueItem): Promise<void> {
  const data = item.data as {
    word?: string;
    pinyin?: string;
    definition?: string;
    status?: string;
    easeFactor?: number;
    nextReview?: string;
    reviewCount?: number;
  };

  switch (item.operation) {
    case 'create':
      await db
        .insert(vocabulary)
        .values({
          id: item.documentId,
          userId,
          word: data.word!,
          pinyin: data.pinyin,
          definition: data.definition,
          status: data.status ?? 'new',
          easeFactor: data.easeFactor ?? 2.5,
          nextReview: data.nextReview ? new Date(data.nextReview) : null,
          reviewCount: data.reviewCount ?? 0,
        })
        .onConflictDoUpdate({
          target: [vocabulary.id],
          set: {
            pinyin: data.pinyin,
            definition: data.definition,
            status: data.status,
            easeFactor: data.easeFactor,
            nextReview: data.nextReview ? new Date(data.nextReview) : null,
            reviewCount: data.reviewCount,
            updatedAt: new Date(),
          },
        });
      break;

    case 'update':
      await db
        .update(vocabulary)
        .set({
          ...data,
          nextReview: data.nextReview ? new Date(data.nextReview) : undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(vocabulary.id, item.documentId), eq(vocabulary.userId, userId)));
      break;

    case 'delete':
      await db
        .delete(vocabulary)
        .where(and(eq(vocabulary.id, item.documentId), eq(vocabulary.userId, userId)));
      break;
  }
}

async function processCardsSync(userId: string, item: SyncQueueItem): Promise<void> {
  const data = item.data as {
    word?: string;
    sentence?: string;
    simplifiedSentence?: string;
    audioUrl?: string;
    screenshotUrl?: string;
    sourceTitle?: string;
    sourceTimestamp?: string;
    exportedToAnki?: boolean;
  };

  switch (item.operation) {
    case 'create':
      await db
        .insert(cards)
        .values({
          id: item.documentId,
          userId,
          word: data.word!,
          sentence: data.sentence,
          simplifiedSentence: data.simplifiedSentence,
          audioUrl: data.audioUrl,
          screenshotUrl: data.screenshotUrl,
          sourceTitle: data.sourceTitle,
          sourceTimestamp: data.sourceTimestamp,
          exportedToAnki: data.exportedToAnki ?? false,
        })
        .onConflictDoNothing();
      break;

    case 'update':
      await db
        .update(cards)
        .set(data)
        .where(and(eq(cards.id, item.documentId), eq(cards.userId, userId)));
      break;

    case 'delete':
      await db.delete(cards).where(and(eq(cards.id, item.documentId), eq(cards.userId, userId)));
      break;
  }
}

/**
 * Get delta changes since a version timestamp
 */
export async function getChangesSince(
  userId: string,
  collection: 'vocabulary' | 'cards',
  sinceVersion: number
): Promise<{
  changes: Array<{
    id: string;
    operation: 'upsert' | 'delete';
    data?: Record<string, unknown>;
  }>;
  currentVersion: number;
}> {
  const sinceDate = new Date(sinceVersion);
  const currentVersion = Date.now();

  if (collection === 'vocabulary') {
    const changes = await db
      .select()
      .from(vocabulary)
      .where(and(eq(vocabulary.userId, userId), sql`${vocabulary.updatedAt} > ${sinceDate}`));

    return {
      changes: changes.map((c) => ({
        id: c.id,
        operation: 'upsert' as const,
        data: {
          word: c.word,
          pinyin: c.pinyin,
          definition: c.definition,
          hskLevel: c.hskLevel,
          status: c.status,
          easeFactor: c.easeFactor,
          nextReview: c.nextReview?.toISOString(),
          reviewCount: c.reviewCount,
        },
      })),
      currentVersion,
    };
  }

  if (collection === 'cards') {
    const changes = await db
      .select()
      .from(cards)
      .where(and(eq(cards.userId, userId), sql`${cards.createdAt} > ${sinceDate}`));

    return {
      changes: changes.map((c) => ({
        id: c.id,
        operation: 'upsert' as const,
        data: {
          word: c.word,
          sentence: c.sentence,
          simplifiedSentence: c.simplifiedSentence,
          audioUrl: c.audioUrl,
          screenshotUrl: c.screenshotUrl,
          sourceTitle: c.sourceTitle,
          sourceTimestamp: c.sourceTimestamp,
          exportedToAnki: c.exportedToAnki,
        },
      })),
      currentVersion,
    };
  }

  return { changes: [], currentVersion };
}

/**
 * Calculate checksum for data verification
 */
export function calculateChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
