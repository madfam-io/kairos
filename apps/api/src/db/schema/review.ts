/**
 * Review Schema - Active recall variations, card types, review modes
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users, vocabulary } from './core';

/**
 * Review card types for varied practice
 */
export const CARD_TYPES = [
  'standard',        // Show word, recall meaning
  'reverse',         // Show meaning, recall word
  'cloze',           // Fill in the blank in a sentence
  'audio',           // Listen and identify/type
  'typing',          // Type the characters
  'tone',            // Identify the correct tone
  'sentence',        // Translate sentence
  'multiple_choice', // Multiple choice (any direction)
] as const;

export type CardType = (typeof CARD_TYPES)[number];

/**
 * Review modes - how the review session is structured
 */
export const REVIEW_MODES = [
  'spaced_repetition',  // Standard SRS review
  'speed_drill',        // Timed quick recall
  'deep_practice',      // Mixed card types, slower pace
  'listening_focus',    // Audio-heavy review
  'writing_focus',      // Typing/character practice
  'custom',             // User-configured mix
] as const;

export type ReviewMode = (typeof REVIEW_MODES)[number];

/**
 * User review preferences - configures how reviews work
 */
export const reviewPreferences = pgTable('review_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Default review mode
  defaultMode: text('default_mode').default('spaced_repetition').notNull(),
  // Card type weights (0-100 for each type, determines frequency)
  cardTypeWeights: jsonb('card_type_weights').default({
    standard: 40,
    reverse: 20,
    cloze: 15,
    audio: 10,
    typing: 10,
    tone: 5,
    sentence: 0,
    multiple_choice: 0,
  }).notNull(),
  // Session settings
  cardsPerSession: integer('cards_per_session').default(20).notNull(),
  sessionDurationMinutes: integer('session_duration_minutes').default(15).notNull(),
  enableTimer: boolean('enable_timer').default(false).notNull(),
  timerSecondsPerCard: integer('timer_seconds_per_card').default(10).notNull(),
  // Audio settings
  autoPlayAudio: boolean('auto_play_audio').default(true).notNull(),
  playbackSpeed: real('playback_speed').default(1.0).notNull(),
  // Display settings
  showPinyinHint: boolean('show_pinyin_hint').default(false).notNull(),
  showExampleSentence: boolean('show_example_sentence').default(true).notNull(),
  shuffleCards: boolean('shuffle_cards').default(true).notNull(),
  // Difficulty adjustment
  adaptiveDifficulty: boolean('adaptive_difficulty').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Review cards - generated cards for review sessions
 */
export const reviewCards = pgTable(
  'review_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vocabularyId: uuid('vocabulary_id')
      .notNull()
      .references(() => vocabulary.id, { onDelete: 'cascade' }),
    cardType: text('card_type').notNull(), // CardType
    // Card content (varies by type)
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    options: jsonb('options'), // For multiple choice
    audioUrl: text('audio_url'),
    sentenceContext: text('sentence_context'),
    clozeSentence: text('cloze_sentence'), // Sentence with blank
    hints: jsonb('hints').default([]).notNull(),
    // Performance tracking
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    reviewCount: integer('review_count').default(0).notNull(),
    correctCount: integer('correct_count').default(0).notNull(),
    averageResponseTimeMs: integer('avg_response_time_ms'),
    // SRS data specific to this card type
    easeFactor: real('ease_factor').default(2.5).notNull(),
    interval: integer('interval').default(1).notNull(), // days
    nextReview: timestamp('next_review', { withTimezone: true }),
    // Flags
    isActive: boolean('is_active').default(true).notNull(),
    isSuspended: boolean('is_suspended').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userVocabTypeIdx: uniqueIndex('review_cards_user_vocab_type_idx').on(
      table.userId,
      table.vocabularyId,
      table.cardType
    ),
    userNextReviewIdx: index('review_cards_user_next_review_idx').on(
      table.userId,
      table.nextReview
    ),
    userTypeIdx: index('review_cards_user_type_idx').on(table.userId, table.cardType),
  })
);

/**
 * Review session - tracks an individual review session
 */
export const reviewSessionsV2 = pgTable(
  'review_sessions_v2',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(), // ReviewMode
    // Session timing
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    pausedDurationMs: integer('paused_duration_ms').default(0).notNull(),
    // Session stats
    totalCards: integer('total_cards').default(0).notNull(),
    completedCards: integer('completed_cards').default(0).notNull(),
    correctCards: integer('correct_cards').default(0).notNull(),
    skippedCards: integer('skipped_cards').default(0).notNull(),
    // Card type breakdown
    cardTypeBreakdown: jsonb('card_type_breakdown').default({}).notNull(),
    // Performance metrics
    averageResponseTimeMs: integer('avg_response_time_ms'),
    streakLength: integer('streak_length').default(0).notNull(), // consecutive correct
    maxStreak: integer('max_streak').default(0).notNull(),
    // Session settings (snapshot at time of session)
    sessionSettings: jsonb('session_settings').default({}).notNull(),
    // Device info
    deviceType: text('device_type'), // 'desktop', 'mobile', 'extension'
    platform: text('platform'), // 'web', 'ios', 'android', 'tauri'
  },
  (table) => ({
    userStartedIdx: index('review_sessions_v2_user_started_idx').on(
      table.userId,
      table.startedAt
    ),
  })
);

/**
 * Review responses - individual card responses within a session
 */
export const reviewResponses = pgTable(
  'review_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => reviewSessionsV2.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reviewCardId: uuid('review_card_id')
      .notNull()
      .references(() => reviewCards.id, { onDelete: 'cascade' }),
    vocabularyId: uuid('vocabulary_id')
      .notNull()
      .references(() => vocabulary.id, { onDelete: 'cascade' }),
    // Response details
    cardType: text('card_type').notNull(),
    userAnswer: text('user_answer'),
    correctAnswer: text('correct_answer').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    // Quality rating (0-5, SM-2 style)
    quality: integer('quality').notNull(),
    // Timing
    responseTimeMs: integer('response_time_ms'),
    // Hint usage
    hintsUsed: integer('hints_used').default(0).notNull(),
    audioPlayed: boolean('audio_played').default(false).notNull(),
    // Flags
    wasSkipped: boolean('was_skipped').default(false).notNull(),
    wasTimedOut: boolean('was_timed_out').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('review_responses_session_idx').on(table.sessionId),
    userCreatedIdx: index('review_responses_user_created_idx').on(
      table.userId,
      table.createdAt
    ),
    cardTypeIdx: index('review_responses_card_type_idx').on(table.userId, table.cardType),
  })
);

/**
 * Cloze sentences - pre-generated cloze deletion sentences
 */
export const clozeSentences = pgTable(
  'cloze_sentences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    word: text('word').notNull(),
    sentence: text('sentence').notNull(), // Original sentence
    clozeSentence: text('cloze_sentence').notNull(), // Sentence with ___
    pinyin: text('pinyin'),
    translation: text('translation'),
    hskLevel: integer('hsk_level'),
    difficulty: integer('difficulty').default(1).notNull(), // 1-3
    source: text('source'), // Where the sentence came from
    isVerified: boolean('is_verified').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    wordIdx: index('cloze_sentences_word_idx').on(table.word),
    hskLevelIdx: index('cloze_sentences_hsk_level_idx').on(table.hskLevel),
  })
);

/**
 * User card type performance - tracks which card types work best for each user
 */
export const cardTypePerformance = pgTable(
  'card_type_performance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardType: text('card_type').notNull(),
    // Aggregated stats
    totalReviews: integer('total_reviews').default(0).notNull(),
    correctReviews: integer('correct_reviews').default(0).notNull(),
    averageResponseTimeMs: integer('avg_response_time_ms'),
    // Effectiveness metrics
    retentionRate: real('retention_rate').default(0).notNull(), // 0-100%
    engagementScore: real('engagement_score').default(0).notNull(), // 0-100
    // Last calculated
    lastCalculatedAt: timestamp('last_calculated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userTypeIdx: uniqueIndex('card_type_performance_user_type_idx').on(
      table.userId,
      table.cardType
    ),
  })
);

// Relations
export const reviewPreferencesRelations = relations(reviewPreferences, ({ one }) => ({
  user: one(users, {
    fields: [reviewPreferences.userId],
    references: [users.id],
  }),
}));

export const reviewCardsRelations = relations(reviewCards, ({ one }) => ({
  user: one(users, {
    fields: [reviewCards.userId],
    references: [users.id],
  }),
  vocabulary: one(vocabulary, {
    fields: [reviewCards.vocabularyId],
    references: [vocabulary.id],
  }),
}));

export const reviewSessionsV2Relations = relations(reviewSessionsV2, ({ one, many }) => ({
  user: one(users, {
    fields: [reviewSessionsV2.userId],
    references: [users.id],
  }),
  responses: many(reviewResponses),
}));

export const reviewResponsesRelations = relations(reviewResponses, ({ one }) => ({
  session: one(reviewSessionsV2, {
    fields: [reviewResponses.sessionId],
    references: [reviewSessionsV2.id],
  }),
  user: one(users, {
    fields: [reviewResponses.userId],
    references: [users.id],
  }),
  reviewCard: one(reviewCards, {
    fields: [reviewResponses.reviewCardId],
    references: [reviewCards.id],
  }),
  vocabulary: one(vocabulary, {
    fields: [reviewResponses.vocabularyId],
    references: [vocabulary.id],
  }),
}));

export const clozeSentencesRelations = relations(clozeSentences, () => ({}));

export const cardTypePerformanceRelations = relations(cardTypePerformance, ({ one }) => ({
  user: one(users, {
    fields: [cardTypePerformance.userId],
    references: [users.id],
  }),
}));
