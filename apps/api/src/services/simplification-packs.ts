/**
 * Pre-computed Simplification Packs Service
 * Manages pre-computed simplifications for popular shows
 */

import { db, showSimplifications, simplificationCache } from '../db';
import { eq, and, sql, inArray } from 'drizzle-orm';

export interface SimplificationPack {
  showId: string;
  showName: string;
  totalEpisodes: number;
  totalSubtitles: number;
  availableLevels: number[];
  verified: boolean;
  createdAt: Date;
}

export interface SubtitleSimplification {
  index: number;
  originalText: string;
  hsk3?: string | null;
  hsk4?: string | null;
  hsk5?: string | null;
  verified: boolean;
}

// Popular shows with pre-computed simplifications
export const AVAILABLE_PACKS: SimplificationPack[] = [
  {
    showId: 'nothing-but-thirty',
    showName: 'Nothing But Thirty (三十而已)',
    totalEpisodes: 43,
    totalSubtitles: 15000,
    availableLevels: [3, 4, 5],
    verified: true,
    createdAt: new Date('2024-01-01'),
  },
  {
    showId: 'day-and-night',
    showName: 'Day and Night (白夜追凶)',
    totalEpisodes: 32,
    totalSubtitles: 12000,
    availableLevels: [3, 4, 5],
    verified: true,
    createdAt: new Date('2024-01-15'),
  },
  {
    showId: 'go-ahead',
    showName: 'Go Ahead (以家人之名)',
    totalEpisodes: 46,
    totalSubtitles: 18000,
    availableLevels: [3, 4, 5],
    verified: true,
    createdAt: new Date('2024-02-01'),
  },
  {
    showId: 'my-huckleberry-friends',
    showName: 'My Huckleberry Friends (你好，旧时光)',
    totalEpisodes: 30,
    totalSubtitles: 11000,
    availableLevels: [3, 4, 5],
    verified: false,
    createdAt: new Date('2024-02-15'),
  },
  {
    showId: 'put-your-head-on-my-shoulder',
    showName: 'Put Your Head on My Shoulder (致我们暖暖的小时光)',
    totalEpisodes: 24,
    totalSubtitles: 9000,
    availableLevels: [3, 4],
    verified: false,
    createdAt: new Date('2024-03-01'),
  },
];

/**
 * Get list of available simplification packs
 */
export function getAvailablePacks(): SimplificationPack[] {
  return AVAILABLE_PACKS;
}

/**
 * Get simplification for a specific subtitle
 */
export async function getSimplification(
  showId: string,
  episode: number,
  subtitleIndex: number,
  hskLevel: 3 | 4 | 5
): Promise<string | null> {
  const [result] = await db
    .select()
    .from(showSimplifications)
    .where(
      and(
        eq(showSimplifications.showId, showId),
        eq(showSimplifications.episode, episode),
        eq(showSimplifications.subtitleIndex, subtitleIndex)
      )
    )
    .limit(1);

  if (!result) return null;

  switch (hskLevel) {
    case 3:
      return result.hsk3Text;
    case 4:
      return result.hsk4Text;
    case 5:
      return result.hsk5Text;
    default:
      return null;
  }
}

/**
 * Get all simplifications for an episode
 */
export async function getEpisodeSimplifications(
  showId: string,
  episode: number
): Promise<SubtitleSimplification[]> {
  const results = await db
    .select()
    .from(showSimplifications)
    .where(and(eq(showSimplifications.showId, showId), eq(showSimplifications.episode, episode)))
    .orderBy(showSimplifications.subtitleIndex);

  return results.map((r) => ({
    index: r.subtitleIndex,
    originalText: r.originalText,
    hsk3: r.hsk3Text,
    hsk4: r.hsk4Text,
    hsk5: r.hsk5Text,
    verified: r.verified,
  }));
}

/**
 * Batch get simplifications for multiple subtitles
 */
export async function batchGetSimplifications(
  showId: string,
  episode: number,
  subtitleIndices: number[],
  hskLevel: 3 | 4 | 5
): Promise<Map<number, string>> {
  const results = await db
    .select()
    .from(showSimplifications)
    .where(
      and(
        eq(showSimplifications.showId, showId),
        eq(showSimplifications.episode, episode),
        inArray(showSimplifications.subtitleIndex, subtitleIndices)
      )
    );

  const map = new Map<number, string>();

  for (const r of results) {
    let text: string | null = null;
    switch (hskLevel) {
      case 3:
        text = r.hsk3Text;
        break;
      case 4:
        text = r.hsk4Text;
        break;
      case 5:
        text = r.hsk5Text;
        break;
    }
    if (text) {
      map.set(r.subtitleIndex, text);
    }
  }

  return map;
}

/**
 * Save pre-computed simplification
 */
export async function saveSimplification(
  showId: string,
  episode: number,
  subtitleIndex: number,
  originalText: string,
  simplifications: {
    hsk3?: string;
    hsk4?: string;
    hsk5?: string;
  },
  verified = false
): Promise<void> {
  await db
    .insert(showSimplifications)
    .values({
      showId,
      episode,
      subtitleIndex,
      originalText,
      hsk3Text: simplifications.hsk3,
      hsk4Text: simplifications.hsk4,
      hsk5Text: simplifications.hsk5,
      verified,
    })
    .onConflictDoUpdate({
      target: [
        showSimplifications.showId,
        showSimplifications.episode,
        showSimplifications.subtitleIndex,
      ],
      set: {
        hsk3Text: simplifications.hsk3,
        hsk4Text: simplifications.hsk4,
        hsk5Text: simplifications.hsk5,
        verified,
      },
    });
}

/**
 * Batch save pre-computed simplifications
 */
export async function batchSaveSimplifications(
  showId: string,
  episode: number,
  simplifications: Array<{
    subtitleIndex: number;
    originalText: string;
    hsk3?: string;
    hsk4?: string;
    hsk5?: string;
  }>
): Promise<number> {
  let saved = 0;

  for (const s of simplifications) {
    await db
      .insert(showSimplifications)
      .values({
        showId,
        episode,
        subtitleIndex: s.subtitleIndex,
        originalText: s.originalText,
        hsk3Text: s.hsk3,
        hsk4Text: s.hsk4,
        hsk5Text: s.hsk5,
        verified: false,
      })
      .onConflictDoNothing();
    saved++;
  }

  return saved;
}

/**
 * Get pack statistics
 */
export async function getPackStats(
  showId: string
): Promise<{ totalSubtitles: number; byEpisode: Record<number, number> }> {
  const results = await db
    .select({
      episode: showSimplifications.episode,
      count: sql<number>`count(*)::int`,
    })
    .from(showSimplifications)
    .where(eq(showSimplifications.showId, showId))
    .groupBy(showSimplifications.episode);

  const byEpisode: Record<number, number> = {};
  let total = 0;

  for (const r of results) {
    byEpisode[r.episode] = r.count;
    total += r.count;
  }

  return {
    totalSubtitles: total,
    byEpisode,
  };
}

/**
 * Check/get from simplification cache (for user-submitted text)
 */
export async function getCachedSimplification(
  originalText: string,
  hskLevel: number
): Promise<string | null> {
  const [cached] = await db
    .select()
    .from(simplificationCache)
    .where(
      and(
        eq(simplificationCache.originalText, originalText),
        eq(simplificationCache.hskLevel, hskLevel)
      )
    )
    .limit(1);

  if (cached) {
    // Increment hit count
    await db
      .update(simplificationCache)
      .set({ hitCount: sql`${simplificationCache.hitCount} + 1` })
      .where(eq(simplificationCache.id, cached.id));

    return cached.simplifiedText;
  }

  return null;
}

/**
 * Save to simplification cache
 */
export async function cacheSimplification(
  originalText: string,
  hskLevel: number,
  simplifiedText: string,
  modelVersion?: string
): Promise<void> {
  await db
    .insert(simplificationCache)
    .values({
      originalText,
      hskLevel,
      simplifiedText,
      modelVersion,
    })
    .onConflictDoNothing();
}

/**
 * Mark simplification as verified (by human reviewer)
 */
export async function verifySimplification(
  showId: string,
  episode: number,
  subtitleIndex: number
): Promise<void> {
  await db
    .update(showSimplifications)
    .set({ verified: true })
    .where(
      and(
        eq(showSimplifications.showId, showId),
        eq(showSimplifications.episode, episode),
        eq(showSimplifications.subtitleIndex, subtitleIndex)
      )
    );
}
