/**
 * Community Schema - Shared Decks, Likes, Downloads, Referrals
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
import { users } from './core';

/**
 * Shared vocabulary decks - community decks
 */
export const sharedDecks = pgTable(
  'shared_decks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isPublic: boolean('is_public').default(false).notNull(),
    category: text('category'), // 'hsk', 'topic', 'media', 'custom'
    tags: jsonb('tags').default([]),
    wordCount: integer('word_count').default(0).notNull(),
    downloadCount: integer('download_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    authorIdx: index('shared_decks_author_idx').on(table.authorId),
    publicIdx: index('shared_decks_public_idx').on(table.isPublic),
    categoryIdx: index('shared_decks_category_idx').on(table.category),
  })
);

/**
 * Shared deck words
 */
export const sharedDeckWords = pgTable(
  'shared_deck_words',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => sharedDecks.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    pinyin: text('pinyin'),
    definition: text('definition'),
    hskLevel: integer('hsk_level'),
    exampleSentence: text('example_sentence'),
    order: integer('order').default(0).notNull(),
  },
  (table) => ({
    deckOrderIdx: index('shared_deck_words_order_idx').on(table.deckId, table.order),
    deckWordUnique: uniqueIndex('shared_deck_word_unique_idx').on(table.deckId, table.word),
  })
);

/**
 * Shared deck likes
 */
export const sharedDeckLikes = pgTable(
  'shared_deck_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => sharedDecks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    deckUserUnique: uniqueIndex('shared_deck_likes_unique_idx').on(table.deckId, table.userId),
  })
);

/**
 * User deck downloads - track which decks users have imported
 */
export const userDeckDownloads = pgTable(
  'user_deck_downloads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => sharedDecks.id, { onDelete: 'cascade' }),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userDeckUnique: uniqueIndex('user_deck_download_unique_idx').on(table.userId, table.deckId),
  })
);

/**
 * Referral codes - affiliate program
 */
export const referralCodes = pgTable(
  'referral_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    discountPercent: integer('discount_percent').default(20).notNull(),
    commissionPercent: integer('commission_percent').default(20).notNull(),
    usageCount: integer('usage_count').default(0).notNull(),
    totalEarnings: real('total_earnings').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCodeIdx: index('referral_user_idx').on(table.userId),
  })
);

/**
 * Referral usages - track conversions
 */
export const referralUsages = pgTable(
  'referral_usages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referralCodeId: uuid('referral_code_id')
      .notNull()
      .references(() => referralCodes.id),
    referredUserId: uuid('referred_user_id')
      .notNull()
      .references(() => users.id),
    subscriptionId: text('subscription_id'),
    amount: real('amount'),
    commission: real('commission'),
    status: text('status').default('pending').notNull(), // 'pending', 'paid', 'cancelled'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index('referral_usage_code_idx').on(table.referralCodeId),
  })
);

// Relations
export const sharedDecksRelations = relations(sharedDecks, ({ one, many }) => ({
  author: one(users, {
    fields: [sharedDecks.authorId],
    references: [users.id],
  }),
  words: many(sharedDeckWords),
  likes: many(sharedDeckLikes),
}));

export const sharedDeckWordsRelations = relations(sharedDeckWords, ({ one }) => ({
  deck: one(sharedDecks, {
    fields: [sharedDeckWords.deckId],
    references: [sharedDecks.id],
  }),
}));

export const sharedDeckLikesRelations = relations(sharedDeckLikes, ({ one }) => ({
  deck: one(sharedDecks, {
    fields: [sharedDeckLikes.deckId],
    references: [sharedDecks.id],
  }),
  user: one(users, {
    fields: [sharedDeckLikes.userId],
    references: [users.id],
  }),
}));
