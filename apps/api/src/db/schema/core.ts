/**
 * Core Schema - Users, Vocabulary, Cards, Sync, Stats
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

/**
 * Users table
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  subscriptionTier: text('subscription_tier').default('free').notNull(),
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
  settings: jsonb('settings').default({}).notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
});

/**
 * Vocabulary table - user's known/learning words
 */
export const vocabulary = pgTable(
  'vocabulary',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    pinyin: text('pinyin'),
    definition: text('definition'),
    hskLevel: integer('hsk_level'),
    status: text('status').default('learning').notNull(), // 'new', 'learning', 'known'
    easeFactor: real('ease_factor').default(2.5).notNull(),
    nextReview: timestamp('next_review', { withTimezone: true }),
    reviewCount: integer('review_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userWordUnique: uniqueIndex('vocabulary_user_word_idx').on(table.userId, table.word),
    userStatusIdx: index('vocabulary_user_status_idx').on(table.userId, table.status),
    nextReviewIdx: index('vocabulary_next_review_idx').on(table.userId, table.nextReview),
  })
);

/**
 * Cards table - mined flashcards
 */
export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    sentence: text('sentence'),
    simplifiedSentence: text('simplified_sentence'),
    audioUrl: text('audio_url'),
    screenshotUrl: text('screenshot_url'),
    sourceTitle: text('source_title'),
    sourceTimestamp: text('source_timestamp'),
    exportedToAnki: boolean('exported_to_anki').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index('cards_user_created_idx').on(table.userId, table.createdAt),
  })
);

/**
 * Sync changes - for CRDT-based sync
 */
export const syncChanges = pgTable(
  'sync_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    collection: text('collection').notNull(), // 'vocabulary', 'cards', 'settings'
    operation: text('operation').notNull(), // 'create', 'update', 'delete'
    documentId: uuid('document_id').notNull(),
    data: jsonb('data'),
    vectorClock: jsonb('vector_clock').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
  },
  (table) => ({
    userCreatedIdx: index('sync_user_created_idx').on(table.userId, table.createdAt),
  })
);

/**
 * User stats - denormalized for quick access
 */
export const userStats = pgTable('user_stats', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  totalWordsLearned: integer('total_words_learned').default(0).notNull(),
  totalCardsMined: integer('total_cards_mined').default(0).notNull(),
  currentStreak: integer('current_streak').default(0).notNull(),
  longestStreak: integer('longest_streak').default(0).notNull(),
  totalStudyTimeMinutes: integer('total_study_time_minutes').default(0).notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  lastStreakDate: timestamp('last_streak_date', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations need to be defined after all tables are imported in index.ts
// to avoid circular dependencies
