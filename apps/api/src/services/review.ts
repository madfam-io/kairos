/**
 * Review Service
 * Handles active recall variations, card generation, and review sessions
 */

import { eq, and, lte, asc, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  vocabulary,
  reviewPreferences,
  reviewCards,
  reviewSessionsV2,
  reviewResponses,
  clozeSentences,
  cardTypePerformance,
  CARD_TYPES,
  type CardType,
  type ReviewMode,
} from '../db/schema';
import { log } from '../lib/logger';

interface ReviewCard {
  id: string;
  vocabularyId: string;
  cardType: CardType;
  question: string;
  answer: string;
  options?: string[];
  audioUrl?: string;
  sentenceContext?: string;
  clozeSentence?: string;
  hints: string[];
  word: string;
  pinyin?: string;
  definition?: string;
  hskLevel?: number;
}

interface SessionConfig {
  mode: ReviewMode;
  cardCount: number;
  cardTypes?: CardType[];
  timerEnabled?: boolean;
  timerSeconds?: number;
}

/**
 * Get or create review preferences for a user
 */
export async function getReviewPreferences(userId: string) {
  let prefs = await db.query.reviewPreferences.findFirst({
    where: eq(reviewPreferences.userId, userId),
  });

  if (!prefs) {
    [prefs] = await db
      .insert(reviewPreferences)
      .values({ userId })
      .returning();
  }

  return prefs;
}

/**
 * Update review preferences
 */
export async function updateReviewPreferences(
  userId: string,
  updates: Partial<typeof reviewPreferences.$inferInsert>
) {
  const [updated] = await db
    .update(reviewPreferences)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(reviewPreferences.userId, userId))
    .returning();

  return updated;
}

/**
 * Generate review cards for due vocabulary items
 * Creates different card types based on user preferences
 */
export async function generateReviewCards(
  userId: string,
  vocabularyId: string
): Promise<ReviewCard[]> {
  // Get vocabulary item
  const vocab = await db.query.vocabulary.findFirst({
    where: and(eq(vocabulary.id, vocabularyId), eq(vocabulary.userId, userId)),
  });

  if (!vocab) {
    throw new Error('Vocabulary not found');
  }

  // Get user preferences for card type weights
  const prefs = await getReviewPreferences(userId);
  const weights = prefs.cardTypeWeights as Record<string, number>;

  const cards: ReviewCard[] = [];

  // Generate standard card (word -> meaning)
  if (weights.standard > 0) {
    cards.push({
      id: `${vocabularyId}-standard`,
      vocabularyId,
      cardType: 'standard',
      question: vocab.word,
      answer: vocab.definition || 'No definition',
      hints: vocab.pinyin ? [vocab.pinyin] : [],
      word: vocab.word,
      pinyin: vocab.pinyin || undefined,
      definition: vocab.definition || undefined,
      hskLevel: vocab.hskLevel || undefined,
    });
  }

  // Generate reverse card (meaning -> word)
  if (weights.reverse > 0 && vocab.definition) {
    cards.push({
      id: `${vocabularyId}-reverse`,
      vocabularyId,
      cardType: 'reverse',
      question: vocab.definition,
      answer: vocab.word,
      hints: [vocab.pinyin || 'No pinyin hint'],
      word: vocab.word,
      pinyin: vocab.pinyin || undefined,
      definition: vocab.definition,
      hskLevel: vocab.hskLevel || undefined,
    });
  }

  // Generate cloze card (fill in the blank)
  if (weights.cloze > 0) {
    const clozeData = await getClozeForWord(vocab.word, vocab.hskLevel || 1);
    if (clozeData) {
      cards.push({
        id: `${vocabularyId}-cloze`,
        vocabularyId,
        cardType: 'cloze',
        question: clozeData.clozeSentence,
        answer: vocab.word,
        sentenceContext: clozeData.sentence,
        clozeSentence: clozeData.clozeSentence,
        hints: [clozeData.pinyin || vocab.pinyin || ''],
        word: vocab.word,
        pinyin: vocab.pinyin || undefined,
        definition: vocab.definition || undefined,
        hskLevel: vocab.hskLevel || undefined,
      });
    }
  }

  // Generate audio card (listen and identify)
  if (weights.audio > 0) {
    const audioUrl = generateAudioUrl(vocab.word);
    cards.push({
      id: `${vocabularyId}-audio`,
      vocabularyId,
      cardType: 'audio',
      question: 'Listen and identify the word',
      answer: vocab.word,
      audioUrl,
      hints: [vocab.definition || 'No definition'],
      word: vocab.word,
      pinyin: vocab.pinyin || undefined,
      definition: vocab.definition || undefined,
      hskLevel: vocab.hskLevel || undefined,
    });
  }

  // Generate typing card (type the characters)
  if (weights.typing > 0 && vocab.pinyin) {
    cards.push({
      id: `${vocabularyId}-typing`,
      vocabularyId,
      cardType: 'typing',
      question: `Type the Chinese characters for: ${vocab.pinyin}`,
      answer: vocab.word,
      hints: [vocab.definition || 'No definition'],
      word: vocab.word,
      pinyin: vocab.pinyin,
      definition: vocab.definition || undefined,
      hskLevel: vocab.hskLevel || undefined,
    });
  }

  // Generate tone card (identify correct tone)
  if (weights.tone > 0 && vocab.pinyin) {
    const toneOptions = generateToneOptions(vocab.pinyin);
    cards.push({
      id: `${vocabularyId}-tone`,
      vocabularyId,
      cardType: 'tone',
      question: `Select the correct pinyin for: ${vocab.word}`,
      answer: vocab.pinyin,
      options: toneOptions,
      hints: [vocab.definition || 'No definition'],
      word: vocab.word,
      pinyin: vocab.pinyin,
      definition: vocab.definition || undefined,
      hskLevel: vocab.hskLevel || undefined,
    });
  }

  // Generate multiple choice card
  if (weights.multiple_choice > 0) {
    const mcOptions = await generateMultipleChoiceOptions(vocab.word, vocab.definition || '', userId);
    cards.push({
      id: `${vocabularyId}-mc`,
      vocabularyId,
      cardType: 'multiple_choice',
      question: vocab.word,
      answer: vocab.definition || '',
      options: mcOptions,
      hints: [vocab.pinyin || ''],
      word: vocab.word,
      pinyin: vocab.pinyin || undefined,
      definition: vocab.definition || undefined,
      hskLevel: vocab.hskLevel || undefined,
    });
  }

  return cards;
}

/**
 * Start a new review session
 */
export async function startReviewSession(
  userId: string,
  config: SessionConfig
): Promise<{ sessionId: string; cards: ReviewCard[] }> {
  const prefs = await getReviewPreferences(userId);

  // Get due vocabulary
  const dueVocab = await db
    .select()
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, userId),
        lte(vocabulary.nextReview, new Date())
      )
    )
    .orderBy(asc(vocabulary.nextReview))
    .limit(config.cardCount);

  if (dueVocab.length === 0) {
    // No due vocabulary, get some learning words
    const learningVocab = await db
      .select()
      .from(vocabulary)
      .where(
        and(
          eq(vocabulary.userId, userId),
          eq(vocabulary.status, 'learning')
        )
      )
      .orderBy(asc(vocabulary.updatedAt))
      .limit(config.cardCount);

    if (learningVocab.length === 0) {
      throw new Error('No vocabulary available for review');
    }

    dueVocab.push(...learningVocab);
  }

  // Generate review cards based on mode
  const allCards: ReviewCard[] = [];

  for (const vocab of dueVocab) {
    const vocabCards = await generateReviewCards(userId, vocab.id);

    // Filter by configured card types if specified
    const filteredCards = config.cardTypes
      ? vocabCards.filter(c => config.cardTypes!.includes(c.cardType))
      : vocabCards;

    // Select cards based on mode and weights
    const selectedCards = selectCardsForMode(filteredCards, config.mode, prefs);
    allCards.push(...selectedCards);
  }

  // Shuffle if needed
  if (prefs.shuffleCards) {
    shuffleArray(allCards);
  }

  // Limit to configured count
  const finalCards = allCards.slice(0, config.cardCount);

  // Create session record
  const [session] = await db
    .insert(reviewSessionsV2)
    .values({
      userId,
      mode: config.mode,
      startedAt: new Date(),
      totalCards: finalCards.length,
      sessionSettings: {
        timerEnabled: config.timerEnabled,
        timerSeconds: config.timerSeconds,
        cardTypes: config.cardTypes,
      },
    })
    .returning();

  // Save review cards to database
  for (const card of finalCards) {
    await db
      .insert(reviewCards)
      .values({
        userId,
        vocabularyId: card.vocabularyId,
        cardType: card.cardType,
        question: card.question,
        answer: card.answer,
        options: card.options,
        audioUrl: card.audioUrl,
        sentenceContext: card.sentenceContext,
        clozeSentence: card.clozeSentence,
        hints: card.hints,
      })
      .onConflictDoUpdate({
        target: [reviewCards.userId, reviewCards.vocabularyId, reviewCards.cardType],
        set: {
          question: card.question,
          answer: card.answer,
          options: card.options,
        },
      });
  }

  log.info('Review session started', {
    userId,
    sessionId: session.id,
    mode: config.mode,
    cardCount: finalCards.length,
  });

  return {
    sessionId: session.id,
    cards: finalCards,
  };
}

/**
 * Submit a review response
 */
export async function submitReviewResponse(
  userId: string,
  sessionId: string,
  response: {
    reviewCardId: string;
    vocabularyId: string;
    cardType: CardType;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    quality: number;
    responseTimeMs?: number;
    hintsUsed?: number;
    audioPlayed?: boolean;
    wasSkipped?: boolean;
    wasTimedOut?: boolean;
  }
): Promise<{ success: boolean; nextReviewDate: Date }> {
  // Save response
  await db.insert(reviewResponses).values({
    sessionId,
    userId,
    reviewCardId: response.reviewCardId,
    vocabularyId: response.vocabularyId,
    cardType: response.cardType,
    userAnswer: response.userAnswer,
    correctAnswer: response.correctAnswer,
    isCorrect: response.isCorrect,
    quality: response.quality,
    responseTimeMs: response.responseTimeMs,
    hintsUsed: response.hintsUsed || 0,
    audioPlayed: response.audioPlayed || false,
    wasSkipped: response.wasSkipped || false,
    wasTimedOut: response.wasTimedOut || false,
  });

  // Update review card stats
  await db
    .update(reviewCards)
    .set({
      lastReviewedAt: new Date(),
      reviewCount: sql`${reviewCards.reviewCount} + 1`,
      correctCount: response.isCorrect
        ? sql`${reviewCards.correctCount} + 1`
        : reviewCards.correctCount,
      averageResponseTimeMs: response.responseTimeMs
        ? sql`(COALESCE(${reviewCards.averageResponseTimeMs}, 0) * ${reviewCards.reviewCount} + ${response.responseTimeMs}) / (${reviewCards.reviewCount} + 1)`
        : reviewCards.averageResponseTimeMs,
    })
    .where(eq(reviewCards.id, response.reviewCardId));

  // Update vocabulary SRS data using SM-2 algorithm
  const nextReviewDate = await updateVocabularySRS(response.vocabularyId, response.quality);

  // Update session stats
  await db
    .update(reviewSessionsV2)
    .set({
      completedCards: sql`${reviewSessionsV2.completedCards} + 1`,
      correctCards: response.isCorrect
        ? sql`${reviewSessionsV2.correctCards} + 1`
        : reviewSessionsV2.correctCards,
      skippedCards: response.wasSkipped
        ? sql`${reviewSessionsV2.skippedCards} + 1`
        : reviewSessionsV2.skippedCards,
    })
    .where(eq(reviewSessionsV2.id, sessionId));

  // Update card type performance
  await updateCardTypePerformance(userId, response.cardType, response.isCorrect, response.responseTimeMs);

  return {
    success: true,
    nextReviewDate,
  };
}

/**
 * End a review session
 */
export async function endReviewSession(
  userId: string,
  sessionId: string
): Promise<{
  totalCards: number;
  correctCards: number;
  accuracy: number;
  duration: number;
}> {
  const session = await db.query.reviewSessionsV2.findFirst({
    where: and(
      eq(reviewSessionsV2.id, sessionId),
      eq(reviewSessionsV2.userId, userId)
    ),
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const endedAt = new Date();

  // Calculate duration
  const duration = Math.floor(
    (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000
  );

  // Update session
  await db
    .update(reviewSessionsV2)
    .set({ endedAt })
    .where(eq(reviewSessionsV2.id, sessionId));

  const accuracy = session.completedCards > 0
    ? Math.round((session.correctCards / session.completedCards) * 100)
    : 0;

  log.info('Review session ended', {
    userId,
    sessionId,
    duration,
    accuracy,
    completedCards: session.completedCards,
  });

  return {
    totalCards: session.totalCards,
    correctCards: session.correctCards,
    accuracy,
    duration,
  };
}

/**
 * Get review session history
 */
export async function getReviewHistory(
  userId: string,
  limit: number = 10
) {
  return db.query.reviewSessionsV2.findMany({
    where: eq(reviewSessionsV2.userId, userId),
    orderBy: [desc(reviewSessionsV2.startedAt)],
    limit,
  });
}

/**
 * Update vocabulary SRS data using SM-2 algorithm
 */
async function updateVocabularySRS(vocabId: string, quality: number): Promise<Date> {
  const vocab = await db.query.vocabulary.findFirst({
    where: eq(vocabulary.id, vocabId),
  });

  if (!vocab) {
    throw new Error('Vocabulary not found');
  }

  let easeFactor = vocab.easeFactor;
  let interval: number;
  let repetitions = vocab.reviewCount;

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
      interval = Math.round(vocab.reviewCount * easeFactor);
    }

    // Update ease factor
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, easeFactor);

    repetitions++;
  }

  // Calculate next review date
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  // Determine new status
  let newStatus = vocab.status;
  if (quality >= 4 && repetitions >= 5) {
    newStatus = 'known';
  } else if (quality >= 3) {
    newStatus = 'learning';
  }

  // Update vocabulary
  await db
    .update(vocabulary)
    .set({
      easeFactor,
      nextReview,
      reviewCount: repetitions,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(vocabulary.id, vocabId));

  return nextReview;
}

/**
 * Update card type performance metrics
 */
async function updateCardTypePerformance(
  userId: string,
  cardType: CardType,
  isCorrect: boolean,
  responseTimeMs?: number
) {
  await db
    .insert(cardTypePerformance)
    .values({
      userId,
      cardType,
      totalReviews: 1,
      correctReviews: isCorrect ? 1 : 0,
      averageResponseTimeMs: responseTimeMs,
      retentionRate: isCorrect ? 100 : 0,
    })
    .onConflictDoUpdate({
      target: [cardTypePerformance.userId, cardTypePerformance.cardType],
      set: {
        totalReviews: sql`${cardTypePerformance.totalReviews} + 1`,
        correctReviews: isCorrect
          ? sql`${cardTypePerformance.correctReviews} + 1`
          : cardTypePerformance.correctReviews,
        averageResponseTimeMs: responseTimeMs
          ? sql`(COALESCE(${cardTypePerformance.averageResponseTimeMs}, 0) * ${cardTypePerformance.totalReviews} + ${responseTimeMs}) / (${cardTypePerformance.totalReviews} + 1)`
          : cardTypePerformance.averageResponseTimeMs,
        retentionRate: sql`(${cardTypePerformance.correctReviews}::float / ${cardTypePerformance.totalReviews}) * 100`,
        lastCalculatedAt: new Date(),
      },
    });
}

/**
 * Get cloze sentence for a word
 */
async function getClozeForWord(word: string, hskLevel: number) {
  // Try to find existing cloze sentence
  let cloze = await db.query.clozeSentences.findFirst({
    where: and(
      eq(clozeSentences.word, word),
      eq(clozeSentences.hskLevel, hskLevel)
    ),
  });

  if (cloze) {
    return cloze;
  }

  // Generate a simple cloze sentence
  const templates = [
    `我喜欢___。`, // I like ___.
    `他在___。`, // He is ___.
    `这是一个___。`, // This is a ___.
    `我想买___。`, // I want to buy ___.
    `___很好。`, // ___ is good.
  ];

  const sentence = templates[Math.floor(Math.random() * templates.length)].replace('___', word);
  const clozeSentence = sentence.replace(word, '___');

  return {
    word,
    sentence,
    clozeSentence,
    pinyin: null,
    translation: null,
  };
}

/**
 * Generate tone variation options for a pinyin
 */
function generateToneOptions(correctPinyin: string): string[] {
  const toneMarks = ['ā', 'á', 'ǎ', 'à', 'ē', 'é', 'ě', 'è', 'ī', 'í', 'ǐ', 'ì',
                     'ō', 'ó', 'ǒ', 'ò', 'ū', 'ú', 'ǔ', 'ù', 'ǖ', 'ǘ', 'ǚ', 'ǜ'];
  const baseTones = ['a', 'e', 'i', 'o', 'u', 'ü'];

  const options = [correctPinyin];

  // Generate 3 incorrect variations by changing tones
  while (options.length < 4) {
    let variation = correctPinyin;

    // Find a tone mark in the pinyin and change it
    for (let i = 0; i < toneMarks.length; i += 4) {
      const toneGroup = toneMarks.slice(i, i + 4);
      for (const tone of toneGroup) {
        if (variation.includes(tone)) {
          // Replace with a different tone from the same group
          const otherTones = toneGroup.filter(t => t !== tone);
          const newTone = otherTones[Math.floor(Math.random() * otherTones.length)];
          variation = variation.replace(tone, newTone);
          break;
        }
      }
    }

    if (variation !== correctPinyin && !options.includes(variation)) {
      options.push(variation);
    } else {
      // If we couldn't generate a variation, add a random one
      const randomBase = baseTones[Math.floor(Math.random() * baseTones.length)];
      const randomTone = Math.floor(Math.random() * 4);
      options.push(correctPinyin.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/, toneMarks[randomTone]));
    }
  }

  return shuffleArray(options);
}

/**
 * Generate multiple choice options
 */
async function generateMultipleChoiceOptions(
  word: string,
  correctDefinition: string,
  userId: string
): Promise<string[]> {
  // Get other vocabulary items for distractors
  const otherVocab = await db
    .select({ definition: vocabulary.definition })
    .from(vocabulary)
    .where(
      and(
        eq(vocabulary.userId, userId),
        sql`${vocabulary.word} != ${word}`,
        sql`${vocabulary.definition} IS NOT NULL`
      )
    )
    .orderBy(sql`RANDOM()`)
    .limit(3);

  const options = [correctDefinition];

  for (const v of otherVocab) {
    if (v.definition && !options.includes(v.definition)) {
      options.push(v.definition);
    }
  }

  // Fill remaining slots with generic distractors
  const genericDistractors = [
    'mountain', 'water', 'person', 'time', 'place',
    'to speak', 'to eat', 'to go', 'to see', 'big',
  ];

  while (options.length < 4) {
    const distractor = genericDistractors[Math.floor(Math.random() * genericDistractors.length)];
    if (!options.includes(distractor)) {
      options.push(distractor);
    }
  }

  return shuffleArray(options);
}

/**
 * Generate audio URL for a word (TTS)
 */
function generateAudioUrl(word: string): string {
  // This would typically use a TTS service
  // For now, return a placeholder that the frontend can use
  return `/api/v1/speech/tts?text=${encodeURIComponent(word)}`;
}

/**
 * Select cards based on review mode and preferences
 */
function selectCardsForMode(
  cards: ReviewCard[],
  mode: ReviewMode,
  prefs: typeof reviewPreferences.$inferSelect
): ReviewCard[] {
  const weights = prefs.cardTypeWeights as Record<string, number>;

  switch (mode) {
    case 'spaced_repetition':
      // Standard mode - use weight distribution
      return selectByWeights(cards, weights);

    case 'speed_drill':
      // Quick recall - prefer standard and multiple choice
      return cards.filter(c =>
        ['standard', 'multiple_choice', 'reverse'].includes(c.cardType)
      );

    case 'deep_practice':
      // Mixed practice - include all types
      return cards;

    case 'listening_focus':
      // Audio-heavy
      return cards.filter(c =>
        ['audio', 'tone', 'standard'].includes(c.cardType)
      );

    case 'writing_focus':
      // Typing practice
      return cards.filter(c =>
        ['typing', 'cloze', 'reverse'].includes(c.cardType)
      );

    default:
      return selectByWeights(cards, weights);
  }
}

/**
 * Select cards based on weighted distribution
 */
function selectByWeights(
  cards: ReviewCard[],
  weights: Record<string, number>
): ReviewCard[] {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return cards.slice(0, 1);

  const result: ReviewCard[] = [];
  const availableByType = new Map<string, ReviewCard[]>();

  // Group cards by type
  for (const card of cards) {
    const existing = availableByType.get(card.cardType) || [];
    existing.push(card);
    availableByType.set(card.cardType, existing);
  }

  // Select based on weights
  for (const [cardType, weight] of Object.entries(weights)) {
    if (weight <= 0) continue;

    const typeCards = availableByType.get(cardType) || [];
    const count = Math.ceil((weight / totalWeight) * typeCards.length);

    result.push(...typeCards.slice(0, count));
  }

  return result;
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
