/**
 * Recommendations Service
 * Generates personalized content recommendations based on user preferences and learning progress
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  learningPreferences,
  recommendedContent,
  hskAssessment,
  sharedDecks,
  showSimplifications,
  vocabulary,
  users,
} from '../db/schema';
import { log } from '../lib/logger';

interface ContentRecommendation {
  contentType: 'show' | 'deck' | 'article' | 'course';
  contentId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  difficulty: number;
  matchScore: number;
  matchReasons: string[];
  category: string;
}

/**
 * Generate personalized recommendations for a user
 * Called after onboarding completion or when refreshing recommendations
 */
export async function generateRecommendations(userId: string): Promise<number> {
  // Fetch user's preferences and assessment
  const [preferences, assessment, userSettings] = await Promise.all([
    db.query.learningPreferences.findFirst({
      where: eq(learningPreferences.userId, userId),
    }),
    db.query.hskAssessment.findFirst({
      where: eq(hskAssessment.userId, userId),
      orderBy: [desc(hskAssessment.createdAt)],
    }),
    db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { settings: true },
    }),
  ]);

  // Determine user's HSK level
  const userLevel = assessment?.assessedLevel ||
    (userSettings?.settings as Record<string, unknown>)?.hskLevel as number || 1;

  const recommendations: ContentRecommendation[] = [];

  // Generate deck recommendations
  const deckRecommendations = await generateDeckRecommendations(
    userId,
    userLevel,
    preferences
  );
  recommendations.push(...deckRecommendations);

  // Generate show recommendations (if available)
  const showRecommendations = await generateShowRecommendations(
    userId,
    userLevel,
    preferences
  );
  recommendations.push(...showRecommendations);

  // Generate starter content for new users
  if (!assessment || userLevel <= 2) {
    recommendations.push(...getStarterContent(userLevel));
  }

  // Clear existing recommendations for this user (except started/in-progress)
  await db
    .delete(recommendedContent)
    .where(
      and(
        eq(recommendedContent.userId, userId),
        eq(recommendedContent.isStarted, false)
      )
    );

  // Insert new recommendations
  if (recommendations.length > 0) {
    // Sort by match score and assign positions
    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    const toInsert = recommendations.map((rec, index) => ({
      userId,
      contentType: rec.contentType,
      contentId: rec.contentId,
      title: rec.title,
      description: rec.description,
      thumbnailUrl: rec.thumbnailUrl,
      difficulty: rec.difficulty,
      matchScore: rec.matchScore,
      matchReasons: rec.matchReasons,
      category: rec.category,
      position: index,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }));

    await db
      .insert(recommendedContent)
      .values(toInsert)
      .onConflictDoNothing();
  }

  log.info('Recommendations generated', {
    userId,
    count: recommendations.length,
    userLevel,
  });

  return recommendations.length;
}

/**
 * Generate shared deck recommendations
 */
async function generateDeckRecommendations(
  userId: string,
  userLevel: number,
  preferences: typeof learningPreferences.$inferSelect | null
): Promise<ContentRecommendation[]> {
  const recommendations: ContentRecommendation[] = [];

  // Get shared decks around user's level
  const minLevel = Math.max(1, userLevel - 1);
  const maxLevel = Math.min(6, userLevel + 1);

  const decks = await db.query.sharedDecks.findMany({
    where: and(
      eq(sharedDecks.isPublic, true),
      sql`${sharedDecks.hskLevel} >= ${minLevel} AND ${sharedDecks.hskLevel} <= ${maxLevel}`
    ),
    orderBy: [desc(sharedDecks.likes), desc(sharedDecks.downloads)],
    limit: 20,
  });

  for (const deck of decks) {
    const matchReasons: string[] = [];
    let matchScore = 50; // Base score

    // Level match bonus
    if (deck.hskLevel === userLevel) {
      matchScore += 20;
      matchReasons.push('matches_level');
    } else if (Math.abs((deck.hskLevel || 1) - userLevel) === 1) {
      matchScore += 10;
      matchReasons.push('close_to_level');
    }

    // Popularity bonus
    if ((deck.likes || 0) > 50) {
      matchScore += 10;
      matchReasons.push('popular');
    }

    // Topic match (if preferences exist)
    if (preferences?.interestTopics) {
      const topics = preferences.interestTopics as string[];
      const deckTags = (deck.tags as string[]) || [];
      const topicMatch = deckTags.some(tag =>
        topics.some(topic =>
          tag.toLowerCase().includes(topic.toLowerCase()) ||
          topic.toLowerCase().includes(tag.toLowerCase())
        )
      );
      if (topicMatch) {
        matchScore += 15;
        matchReasons.push('matches_interests');
      }
    }

    recommendations.push({
      contentType: 'deck',
      contentId: deck.id,
      title: deck.name,
      description: deck.description,
      thumbnailUrl: deck.coverImageUrl,
      difficulty: deck.hskLevel || userLevel,
      matchScore,
      matchReasons,
      category: 'for_you',
    });
  }

  return recommendations;
}

/**
 * Generate show recommendations based on available content
 */
async function generateShowRecommendations(
  userId: string,
  userLevel: number,
  preferences: typeof learningPreferences.$inferSelect | null
): Promise<ContentRecommendation[]> {
  const recommendations: ContentRecommendation[] = [];

  // Get shows that have been simplified for the user's level
  const shows = await db
    .selectDistinct({ showId: showSimplifications.showId })
    .from(showSimplifications)
    .limit(10);

  // Get user's known vocabulary count to estimate appropriate difficulty
  const knownWords = await db
    .select({ count: sql<number>`count(*)` })
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, userId),
        eq(vocabulary.status, 'known')
      )
    );

  const vocabCount = knownWords[0]?.count || 0;

  // Curated show recommendations based on level
  const curatedShows = getCuratedShows(userLevel, preferences);

  for (const show of curatedShows) {
    const matchReasons: string[] = [];
    let matchScore = 60;

    // Check genre preferences
    if (preferences?.preferredGenres) {
      const genres = preferences.preferredGenres as string[];
      if (genres.some(g => show.genres?.includes(g))) {
        matchScore += 15;
        matchReasons.push('matches_genre');
      }
    }

    // Difficulty match
    if (show.difficulty === userLevel) {
      matchScore += 20;
      matchReasons.push('matches_level');
    }

    recommendations.push({
      contentType: 'show',
      contentId: show.id,
      title: show.title,
      description: show.description,
      thumbnailUrl: show.thumbnailUrl,
      difficulty: show.difficulty,
      matchScore,
      matchReasons,
      category: 'for_you',
    });
  }

  return recommendations;
}

/**
 * Get curated show recommendations based on level
 * This would typically come from a database of indexed shows
 */
function getCuratedShows(
  level: number,
  preferences: typeof learningPreferences.$inferSelect | null
): Array<{
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  difficulty: number;
  genres: string[];
}> {
  // Curated list of shows for different levels
  // In production, this would come from a shows database
  const showsByLevel: Record<number, Array<{
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string | null;
    difficulty: number;
    genres: string[];
  }>> = {
    1: [
      {
        id: 'peppa-pig-cn',
        title: '小猪佩奇 (Peppa Pig)',
        description: 'Perfect for beginners - simple vocabulary, clear pronunciation, repetitive patterns',
        thumbnailUrl: null,
        difficulty: 1,
        genres: ['animation', 'children', 'comedy'],
      },
      {
        id: 'little-dinosaur',
        title: '小恐龙 (Little Dinosaur)',
        description: 'Cute animated series with basic vocabulary and slow, clear speech',
        thumbnailUrl: null,
        difficulty: 1,
        genres: ['animation', 'children', 'adventure'],
      },
    ],
    2: [
      {
        id: 'pleasant-goat',
        title: '喜羊羊与灰太狼 (Pleasant Goat)',
        description: 'Popular animated series, elementary level vocabulary with fun stories',
        thumbnailUrl: null,
        difficulty: 2,
        genres: ['animation', 'comedy', 'adventure'],
      },
      {
        id: 'boonie-bears',
        title: '熊出没 (Boonie Bears)',
        description: 'Action-comedy animation, good for learning everyday expressions',
        thumbnailUrl: null,
        difficulty: 2,
        genres: ['animation', 'comedy', 'action'],
      },
    ],
    3: [
      {
        id: 'go-princess-go',
        title: '太子妃升职记 (Go Princess Go)',
        description: 'Comedy drama with clear dialogue, good for intermediate learners',
        thumbnailUrl: null,
        difficulty: 3,
        genres: ['comedy', 'romance', 'drama'],
      },
      {
        id: 'put-your-head',
        title: '致我们单纯的小美好 (A Love So Beautiful)',
        description: 'High school romance with natural everyday dialogue',
        thumbnailUrl: null,
        difficulty: 3,
        genres: ['romance', 'drama', 'comedy'],
      },
    ],
    4: [
      {
        id: 'nirvana-fire',
        title: '琅琊榜 (Nirvana in Fire)',
        description: 'Epic historical drama with rich vocabulary and complex plot',
        thumbnailUrl: null,
        difficulty: 4,
        genres: ['historical', 'drama', 'thriller'],
      },
      {
        id: 'day-and-night',
        title: '白夜追凶 (Day and Night)',
        description: 'Crime thriller with sophisticated dialogue',
        thumbnailUrl: null,
        difficulty: 4,
        genres: ['crime', 'thriller', 'mystery'],
      },
    ],
    5: [
      {
        id: 'the-bad-kids',
        title: '隐秘的角落 (The Bad Kids)',
        description: 'Psychological thriller with nuanced dialogue and complex characters',
        thumbnailUrl: null,
        difficulty: 5,
        genres: ['thriller', 'drama', 'crime'],
      },
      {
        id: 'empresses-palace',
        title: '甄嬛传 (Empresses in the Palace)',
        description: 'Historical palace drama with formal and literary Chinese',
        thumbnailUrl: null,
        difficulty: 5,
        genres: ['historical', 'drama', 'romance'],
      },
    ],
    6: [
      {
        id: 'three-body',
        title: '三体 (The Three-Body Problem)',
        description: 'Sci-fi series with advanced vocabulary and complex concepts',
        thumbnailUrl: null,
        difficulty: 6,
        genres: ['sci-fi', 'drama', 'thriller'],
      },
      {
        id: 'ming-dynasty',
        title: '大明王朝1566',
        description: 'Historical political drama with classical Chinese elements',
        thumbnailUrl: null,
        difficulty: 6,
        genres: ['historical', 'drama', 'political'],
      },
    ],
  };

  // Get shows for user's level and adjacent levels
  const result: Array<{
    id: string;
    title: string;
    description: string;
    thumbnailUrl: string | null;
    difficulty: number;
    genres: string[];
  }> = [];

  // Primary level
  if (showsByLevel[level]) {
    result.push(...showsByLevel[level]);
  }

  // One level below (easier, for confidence building)
  if (level > 1 && showsByLevel[level - 1]) {
    result.push(...showsByLevel[level - 1].slice(0, 1));
  }

  // One level above (for challenge)
  if (level < 6 && showsByLevel[level + 1]) {
    result.push(...showsByLevel[level + 1].slice(0, 1));
  }

  return result;
}

/**
 * Get starter content for new users
 */
function getStarterContent(level: number): ContentRecommendation[] {
  return [
    {
      contentType: 'course',
      contentId: 'getting-started',
      title: 'Getting Started with Kairos',
      description: 'Learn how to use Kairos to accelerate your Chinese learning',
      thumbnailUrl: null,
      difficulty: 1,
      matchScore: 100,
      matchReasons: ['new_user', 'tutorial'],
      category: 'for_you',
    },
    {
      contentType: 'deck',
      contentId: `hsk${level}-essential`,
      title: `HSK ${level} Essential Vocabulary`,
      description: `Master the most common HSK ${level} words with spaced repetition`,
      thumbnailUrl: null,
      difficulty: level,
      matchScore: 95,
      matchReasons: ['matches_level', 'essential'],
      category: 'for_you',
    },
  ];
}

/**
 * Update recommendation based on user interaction
 */
export async function updateRecommendationInteraction(
  userId: string,
  contentId: string,
  interactionType: 'view' | 'start' | 'dismiss'
): Promise<void> {
  const updates: Partial<typeof recommendedContent.$inferInsert> = {};

  switch (interactionType) {
    case 'view':
      updates.isViewed = true;
      break;
    case 'start':
      updates.isStarted = true;
      updates.isViewed = true;
      break;
    case 'dismiss':
      updates.isDismissed = true;
      break;
  }

  await db
    .update(recommendedContent)
    .set(updates)
    .where(
      and(
        eq(recommendedContent.userId, userId),
        eq(recommendedContent.id, contentId)
      )
    );
}
