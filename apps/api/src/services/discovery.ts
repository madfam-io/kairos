/**
 * Content Discovery Service
 * Handles content browsing, difficulty scoring, and comprehensibility
 */

import { eq, and, sql, desc, asc, gte, lte, ilike, or } from 'drizzle-orm';
import { db } from '../db';
import {
  contentCatalog,
  contentTopics,
  userContentInteractions,
  userTopicPreferences,
  contentVocabulary,
  searchHistory,
  vocabulary,
  learningPreferences,
  hskAssessment,
} from '../db/schema';
import { log } from '../lib/logger';

interface SearchFilters {
  type?: string;
  hskMin?: number;
  hskMax?: number;
  topics?: string[];
  genre?: string[];
  source?: string;
  comprehensibilityMin?: number;
}

interface ContentWithComprehensibility {
  id: string;
  type: string;
  title: string;
  originalTitle?: string;
  description?: string;
  coverImageUrl?: string;
  hskLevel?: number;
  genre: string[];
  topics: string[];
  source: string;
  avgRating?: number;
  // Calculated for user
  comprehensibility: number;
  knownVocabPercent: number;
  estimatedNewWords: number;
  difficulty: 'easy' | 'appropriate' | 'challenging' | 'difficult';
}

/**
 * Calculate comprehensibility score for content based on user's vocabulary
 */
export async function calculateComprehensibility(
  userId: string,
  contentId: string
): Promise<{
  comprehensibility: number;
  knownVocabPercent: number;
  totalWords: number;
  knownWords: number;
  newWords: string[];
}> {
  // Get content vocabulary
  const contentVocab = await db.query.contentVocabulary.findMany({
    where: eq(contentVocabulary.contentId, contentId),
  });

  if (contentVocab.length === 0) {
    return {
      comprehensibility: 0,
      knownVocabPercent: 0,
      totalWords: 0,
      knownWords: 0,
      newWords: [],
    };
  }

  // Get user's known vocabulary
  const userVocab = await db
    .select({ word: vocabulary.word })
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, userId),
        sql`${vocabulary.status} != 'new'`
      )
    );

  const userKnownWords = new Set(userVocab.map(v => v.word));

  // Calculate how many content words the user knows
  let knownCount = 0;
  let totalFrequency = 0;
  const newWords: string[] = [];

  for (const word of contentVocab) {
    totalFrequency += word.frequency;
    if (userKnownWords.has(word.word)) {
      knownCount += word.frequency;
    } else {
      newWords.push(word.word);
    }
  }

  const knownVocabPercent = totalFrequency > 0
    ? Math.round((knownCount / totalFrequency) * 100)
    : 0;

  // Comprehensibility is based on known vocabulary coverage
  // ~98% coverage is considered fully comprehensible
  // Using a formula that gives meaningful scores across the range
  let comprehensibility: number;
  if (knownVocabPercent >= 98) {
    comprehensibility = 100;
  } else if (knownVocabPercent >= 95) {
    comprehensibility = 90 + (knownVocabPercent - 95) * 2;
  } else if (knownVocabPercent >= 90) {
    comprehensibility = 70 + (knownVocabPercent - 90) * 4;
  } else if (knownVocabPercent >= 80) {
    comprehensibility = 40 + (knownVocabPercent - 80) * 3;
  } else {
    comprehensibility = Math.round(knownVocabPercent * 0.5);
  }

  return {
    comprehensibility,
    knownVocabPercent,
    totalWords: contentVocab.length,
    knownWords: contentVocab.length - newWords.length,
    newWords: newWords.slice(0, 20), // Return top 20 new words
  };
}

/**
 * Get difficulty classification based on comprehensibility
 */
function getDifficultyClass(
  comprehensibility: number,
  hskLevel: number | null,
  userHskLevel: number
): 'easy' | 'appropriate' | 'challenging' | 'difficult' {
  // Consider both comprehensibility and HSK level difference
  const levelDiff = hskLevel ? hskLevel - userHskLevel : 0;

  if (comprehensibility >= 95 || levelDiff <= -1) {
    return 'easy';
  } else if (comprehensibility >= 80 || levelDiff === 0) {
    return 'appropriate';
  } else if (comprehensibility >= 60 || levelDiff === 1) {
    return 'challenging';
  } else {
    return 'difficult';
  }
}

/**
 * Search and filter content
 */
export async function searchContent(
  userId: string,
  query: string,
  filters: SearchFilters,
  options: { limit?: number; offset?: number } = {}
): Promise<{
  results: ContentWithComprehensibility[];
  total: number;
}> {
  const { limit = 20, offset = 0 } = options;

  // Build where conditions
  const conditions = [eq(contentCatalog.isActive, true)];

  if (query) {
    conditions.push(
      or(
        ilike(contentCatalog.title, `%${query}%`),
        ilike(contentCatalog.originalTitle, `%${query}%`),
        ilike(contentCatalog.description, `%${query}%`)
      )!
    );
  }

  if (filters.type) {
    conditions.push(eq(contentCatalog.type, filters.type));
  }

  if (filters.hskMin !== undefined) {
    conditions.push(gte(contentCatalog.hskLevel, filters.hskMin));
  }

  if (filters.hskMax !== undefined) {
    conditions.push(lte(contentCatalog.hskLevel, filters.hskMax));
  }

  if (filters.source) {
    conditions.push(eq(contentCatalog.source, filters.source));
  }

  // Execute search
  const [results, [{ total }]] = await Promise.all([
    db
      .select()
      .from(contentCatalog)
      .where(and(...conditions))
      .orderBy(desc(contentCatalog.avgComprehensibility), desc(contentCatalog.totalViews))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(contentCatalog)
      .where(and(...conditions)),
  ]);

  // Get user's HSK level for difficulty classification
  const userHskLevel = await getUserHskLevel(userId);

  // Calculate comprehensibility for each result
  const enrichedResults: ContentWithComprehensibility[] = await Promise.all(
    results.map(async (content) => {
      const compData = await calculateComprehensibility(userId, content.id);

      return {
        id: content.id,
        type: content.type,
        title: content.title,
        originalTitle: content.originalTitle || undefined,
        description: content.description || undefined,
        coverImageUrl: content.coverImageUrl || undefined,
        hskLevel: content.hskLevel || undefined,
        genre: (content.genre as string[]) || [],
        topics: (content.topics as string[]) || [],
        source: content.source,
        avgRating: content.avgRating || undefined,
        comprehensibility: compData.comprehensibility,
        knownVocabPercent: compData.knownVocabPercent,
        estimatedNewWords: compData.newWords.length,
        difficulty: getDifficultyClass(compData.comprehensibility, content.hskLevel, userHskLevel),
      };
    })
  );

  // Filter by comprehensibility if specified
  let filtered = enrichedResults;
  if (filters.comprehensibilityMin !== undefined) {
    filtered = enrichedResults.filter(
      c => c.comprehensibility >= filters.comprehensibilityMin!
    );
  }

  // Save search to history
  await db.insert(searchHistory).values({
    userId,
    query: query || '',
    filters,
    resultCount: filtered.length,
  });

  return {
    results: filtered,
    total: filtered.length,
  };
}

/**
 * Get user's estimated HSK level
 */
async function getUserHskLevel(userId: string): Promise<number> {
  // Check assessment first
  const assessment = await db.query.hskAssessment.findFirst({
    where: eq(hskAssessment.userId, userId),
    orderBy: [desc(hskAssessment.createdAt)],
  });

  if (assessment) {
    return assessment.assessedLevel;
  }

  // Fall back to preferences
  const prefs = await db.query.learningPreferences.findFirst({
    where: eq(learningPreferences.userId, userId),
  });

  return prefs?.targetHskLevel || 1;
}

/**
 * Get all topics
 */
export async function getTopics(parentId?: string) {
  const conditions = parentId
    ? eq(contentTopics.parentId, parentId)
    : sql`${contentTopics.parentId} IS NULL`;

  return db.query.contentTopics.findMany({
    where: and(eq(contentTopics.isActive, true), conditions),
    orderBy: [asc(contentTopics.sortOrder)],
  });
}

/**
 * Get content by topic
 */
export async function getContentByTopic(
  userId: string,
  topicId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ContentWithComprehensibility[]> {
  const { limit = 20, offset = 0 } = options;

  const results = await db
    .select()
    .from(contentCatalog)
    .where(
      and(
        eq(contentCatalog.isActive, true),
        sql`${topicId} = ANY(${contentCatalog.topics})`
      )
    )
    .orderBy(desc(contentCatalog.avgRating))
    .limit(limit)
    .offset(offset);

  const userHskLevel = await getUserHskLevel(userId);

  return Promise.all(
    results.map(async (content) => {
      const compData = await calculateComprehensibility(userId, content.id);

      return {
        id: content.id,
        type: content.type,
        title: content.title,
        originalTitle: content.originalTitle || undefined,
        description: content.description || undefined,
        coverImageUrl: content.coverImageUrl || undefined,
        hskLevel: content.hskLevel || undefined,
        genre: (content.genre as string[]) || [],
        topics: (content.topics as string[]) || [],
        source: content.source,
        avgRating: content.avgRating || undefined,
        comprehensibility: compData.comprehensibility,
        knownVocabPercent: compData.knownVocabPercent,
        estimatedNewWords: compData.newWords.length,
        difficulty: getDifficultyClass(compData.comprehensibility, content.hskLevel, userHskLevel),
      };
    })
  );
}

/**
 * Get personalized recommendations
 */
export async function getPersonalizedRecommendations(
  userId: string,
  limit: number = 10
): Promise<ContentWithComprehensibility[]> {
  // Get user's topic preferences
  const topicPrefs = await db.query.userTopicPreferences.findMany({
    where: and(
      eq(userTopicPreferences.userId, userId),
      gte(userTopicPreferences.score, 0.3)
    ),
    orderBy: [desc(userTopicPreferences.score)],
  });

  const preferredTopics = topicPrefs.map(p => p.topicId);
  const userHskLevel = await getUserHskLevel(userId);

  // Get content matching preferences and appropriate level
  const results = await db
    .select()
    .from(contentCatalog)
    .where(
      and(
        eq(contentCatalog.isActive, true),
        // Level should be around user's level
        gte(contentCatalog.hskLevel, Math.max(1, userHskLevel - 1)),
        lte(contentCatalog.hskLevel, userHskLevel + 1)
      )
    )
    .orderBy(desc(contentCatalog.avgComprehensibility), desc(contentCatalog.avgRating))
    .limit(limit * 2); // Get more than needed for filtering

  // Filter out already completed content
  const interactions = await db.query.userContentInteractions.findMany({
    where: and(
      eq(userContentInteractions.userId, userId),
      eq(userContentInteractions.status, 'completed')
    ),
  });

  const completedIds = new Set(interactions.map(i => i.contentId));
  const filtered = results.filter(r => !completedIds.has(r.id));

  // Calculate comprehensibility and score
  const scored = await Promise.all(
    filtered.slice(0, limit).map(async (content) => {
      const compData = await calculateComprehensibility(userId, content.id);

      // Boost score if matches preferred topics
      const topicBoost = preferredTopics.some(t =>
        (content.topics as string[])?.includes(t)
      )
        ? 10
        : 0;

      return {
        content: {
          id: content.id,
          type: content.type,
          title: content.title,
          originalTitle: content.originalTitle || undefined,
          description: content.description || undefined,
          coverImageUrl: content.coverImageUrl || undefined,
          hskLevel: content.hskLevel || undefined,
          genre: (content.genre as string[]) || [],
          topics: (content.topics as string[]) || [],
          source: content.source,
          avgRating: content.avgRating || undefined,
          comprehensibility: compData.comprehensibility,
          knownVocabPercent: compData.knownVocabPercent,
          estimatedNewWords: compData.newWords.length,
          difficulty: getDifficultyClass(compData.comprehensibility, content.hskLevel, userHskLevel),
        } as ContentWithComprehensibility,
        score: compData.comprehensibility + topicBoost,
      };
    })
  );

  // Sort by score and return top results
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.content);
}

/**
 * Get content details with user's comprehensibility
 */
export async function getContentDetails(
  userId: string,
  contentId: string
): Promise<ContentWithComprehensibility & {
  newWords: string[];
  totalWords: number;
  userInteraction?: typeof userContentInteractions.$inferSelect;
}> {
  const content = await db.query.contentCatalog.findFirst({
    where: eq(contentCatalog.id, contentId),
  });

  if (!content) {
    throw new Error('Content not found');
  }

  const userHskLevel = await getUserHskLevel(userId);
  const compData = await calculateComprehensibility(userId, contentId);

  // Get user's interaction if any
  const interaction = await db.query.userContentInteractions.findFirst({
    where: and(
      eq(userContentInteractions.userId, userId),
      eq(userContentInteractions.contentId, contentId)
    ),
  });

  return {
    id: content.id,
    type: content.type,
    title: content.title,
    originalTitle: content.originalTitle || undefined,
    description: content.description || undefined,
    coverImageUrl: content.coverImageUrl || undefined,
    hskLevel: content.hskLevel || undefined,
    genre: (content.genre as string[]) || [],
    topics: (content.topics as string[]) || [],
    source: content.source,
    avgRating: content.avgRating || undefined,
    comprehensibility: compData.comprehensibility,
    knownVocabPercent: compData.knownVocabPercent,
    estimatedNewWords: compData.newWords.length,
    difficulty: getDifficultyClass(compData.comprehensibility, content.hskLevel, userHskLevel),
    newWords: compData.newWords,
    totalWords: compData.totalWords,
    userInteraction: interaction || undefined,
  };
}

/**
 * Track content interaction
 */
export async function trackContentInteraction(
  userId: string,
  contentId: string,
  status: 'discovered' | 'started' | 'in_progress' | 'completed' | 'dropped',
  data?: {
    progress?: number;
    comprehensibility?: number;
    difficulty?: string;
    rating?: number;
    notes?: string;
  }
): Promise<void> {
  await db
    .insert(userContentInteractions)
    .values({
      userId,
      contentId,
      status,
      progress: data?.progress,
      comprehensibility: data?.comprehensibility,
      difficulty: data?.difficulty,
      rating: data?.rating,
      notes: data?.notes,
      startedAt: status === 'started' ? new Date() : undefined,
      completedAt: status === 'completed' ? new Date() : undefined,
      lastAccessedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userContentInteractions.userId, userContentInteractions.contentId],
      set: {
        status,
        progress: data?.progress,
        comprehensibility: data?.comprehensibility,
        difficulty: data?.difficulty,
        rating: data?.rating,
        notes: data?.notes,
        completedAt: status === 'completed' ? new Date() : undefined,
        lastAccessedAt: new Date(),
      },
    });

  // Update view count
  await db
    .update(contentCatalog)
    .set({
      totalViews: sql`${contentCatalog.totalViews} + 1`,
    })
    .where(eq(contentCatalog.id, contentId));

  // Update topic preferences based on interaction
  const content = await db.query.contentCatalog.findFirst({
    where: eq(contentCatalog.id, contentId),
  });

  if (content?.topics) {
    const scoreBoost = status === 'completed' ? 0.1 : status === 'dropped' ? -0.05 : 0.02;

    for (const topicId of content.topics as string[]) {
      await db
        .insert(userTopicPreferences)
        .values({
          userId,
          topicId,
          score: scoreBoost,
          interactionCount: 1,
          source: 'implicit',
        })
        .onConflictDoUpdate({
          target: [userTopicPreferences.userId, userTopicPreferences.topicId],
          set: {
            score: sql`LEAST(1, GREATEST(-1, ${userTopicPreferences.score} + ${scoreBoost}))`,
            interactionCount: sql`${userTopicPreferences.interactionCount} + 1`,
            updatedAt: new Date(),
          },
        });
    }
  }

  log.info('Content interaction tracked', { userId, contentId, status });
}

/**
 * Seed default topics
 */
export async function seedTopics() {
  const topics = [
    { id: 'entertainment', name: 'Entertainment', nameZh: '娱乐', icon: '🎬', sortOrder: 1 },
    { id: 'daily-life', name: 'Daily Life', nameZh: '日常生活', icon: '🏠', sortOrder: 2 },
    { id: 'travel', name: 'Travel', nameZh: '旅行', icon: '✈️', sortOrder: 3 },
    { id: 'food', name: 'Food & Cooking', nameZh: '美食', icon: '🍜', sortOrder: 4 },
    { id: 'business', name: 'Business', nameZh: '商务', icon: '💼', sortOrder: 5 },
    { id: 'technology', name: 'Technology', nameZh: '科技', icon: '💻', sortOrder: 6 },
    { id: 'culture', name: 'Culture & History', nameZh: '文化历史', icon: '🏛️', sortOrder: 7 },
    { id: 'sports', name: 'Sports', nameZh: '体育', icon: '⚽', sortOrder: 8 },
    { id: 'news', name: 'News & Current Events', nameZh: '新闻', icon: '📰', sortOrder: 9 },
    { id: 'education', name: 'Education', nameZh: '教育', icon: '📚', sortOrder: 10 },
  ];

  for (const topic of topics) {
    await db
      .insert(contentTopics)
      .values({
        ...topic,
        isActive: true,
      })
      .onConflictDoNothing();
  }

  log.info('Topics seeded', { count: topics.length });
}
