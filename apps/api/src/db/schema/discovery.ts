/**
 * Discovery Schema - Content discovery, difficulty scoring, topics
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  real,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './core';

/**
 * Content catalog - indexed content available for learning
 */
export const contentCatalog = pgTable(
  'content_catalog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(), // 'show', 'movie', 'book', 'article', 'podcast', 'course'
    externalId: text('external_id'), // ID from source system
    title: text('title').notNull(),
    originalTitle: text('original_title'), // Chinese title
    description: text('description'),
    coverImageUrl: text('cover_image_url'),
    thumbnailUrl: text('thumbnail_url'),
    // Source info
    source: text('source').notNull(), // 'netflix', 'youtube', 'douban', 'custom'
    sourceUrl: text('source_url'),
    // Content metadata
    releaseYear: integer('release_year'),
    genre: jsonb('genre').default([]).notNull(), // ['drama', 'comedy', etc.]
    topics: jsonb('topics').default([]).notNull(), // ['technology', 'food', etc.]
    language: text('language').default('zh-CN').notNull(),
    // Difficulty metrics
    hskLevel: real('hsk_level'), // 1.0 - 6.0, can be fractional
    vocabularyDensity: real('vocabulary_density'), // unique words per minute/page
    speechRate: real('speech_rate'), // words per minute for audio content
    sentenceComplexity: real('sentence_complexity'), // average sentence length
    // Comprehensibility (calculated based on user's vocabulary)
    avgComprehensibility: real('avg_comprehensibility'), // 0-100, average across users
    // Engagement metrics
    totalViews: integer('total_views').default(0).notNull(),
    totalLikes: integer('total_likes').default(0).notNull(),
    avgRating: real('avg_rating'),
    ratingsCount: integer('ratings_count').default(0).notNull(),
    // Status
    isActive: boolean('is_active').default(true).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index('content_catalog_type_idx').on(table.type),
    hskLevelIdx: index('content_catalog_hsk_level_idx').on(table.hskLevel),
    featuredIdx: index('content_catalog_featured_idx').on(table.isFeatured, table.type),
  })
);

/**
 * Content topics - topic taxonomy for browsing
 */
export const contentTopics = pgTable(
  'content_topics',
  {
    id: text('id').primaryKey(), // e.g., 'technology', 'food-cooking'
    name: text('name').notNull(),
    nameZh: text('name_zh'), // Chinese name
    description: text('description'),
    parentId: text('parent_id').references(() => contentTopics.id),
    icon: text('icon'),
    color: text('color'),
    contentCount: integer('content_count').default(0).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => ({
    parentIdx: index('content_topics_parent_idx').on(table.parentId),
  })
);

/**
 * User content interactions - tracks what users have viewed/started
 */
export const userContentInteractions = pgTable(
  'user_content_interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentId: uuid('content_id')
      .notNull()
      .references(() => contentCatalog.id, { onDelete: 'cascade' }),
    // Interaction state
    status: text('status').default('discovered').notNull(), // 'discovered', 'started', 'in_progress', 'completed', 'dropped'
    progress: real('progress').default(0).notNull(), // 0-100%
    // User's experience
    comprehensibility: integer('comprehensibility'), // 0-100, user's personal score
    difficulty: text('difficulty'), // 'too_easy', 'just_right', 'challenging', 'too_hard'
    rating: integer('rating'), // 1-5
    notes: text('notes'),
    // Words learned from this content
    wordsLearned: integer('words_learned').default(0).notNull(),
    // Time tracking
    startedAt: timestamp('started_at', { withTimezone: true }),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userContentIdx: uniqueIndex('user_content_interactions_user_content_idx').on(
      table.userId,
      table.contentId
    ),
    userStatusIdx: index('user_content_interactions_user_status_idx').on(
      table.userId,
      table.status
    ),
  })
);

/**
 * User topic preferences - learned from interactions
 */
export const userTopicPreferences = pgTable(
  'user_topic_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topicId: text('topic_id')
      .notNull()
      .references(() => contentTopics.id),
    // Preference strength
    score: real('score').default(0).notNull(), // -1 to 1, negative = dislike
    interactionCount: integer('interaction_count').default(0).notNull(),
    // Source of preference
    source: text('source').default('implicit').notNull(), // 'explicit', 'implicit', 'onboarding'
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userTopicIdx: uniqueIndex('user_topic_preferences_user_topic_idx').on(
      table.userId,
      table.topicId
    ),
  })
);

/**
 * Content vocabulary - vocabulary extracted from content
 */
export const contentVocabulary = pgTable(
  'content_vocabulary',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => contentCatalog.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    pinyin: text('pinyin'),
    frequency: integer('frequency').default(1).notNull(), // how often it appears
    hskLevel: integer('hsk_level'),
    firstAppearance: text('first_appearance'), // timestamp/page where it first appears
  },
  (table) => ({
    contentWordIdx: uniqueIndex('content_vocabulary_content_word_idx').on(
      table.contentId,
      table.word
    ),
    wordIdx: index('content_vocabulary_word_idx').on(table.word),
  })
);

/**
 * Search history - for personalized search suggestions
 */
export const searchHistory = pgTable(
  'search_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    query: text('query').notNull(),
    filters: jsonb('filters').default({}).notNull(),
    resultCount: integer('result_count'),
    clickedContentId: uuid('clicked_content_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index('search_history_user_created_idx').on(table.userId, table.createdAt),
  })
);

// Relations
export const contentCatalogRelations = relations(contentCatalog, ({ many }) => ({
  interactions: many(userContentInteractions),
  vocabulary: many(contentVocabulary),
}));

export const contentTopicsRelations = relations(contentTopics, ({ one, many }) => ({
  parent: one(contentTopics, {
    fields: [contentTopics.parentId],
    references: [contentTopics.id],
  }),
  children: many(contentTopics),
  userPreferences: many(userTopicPreferences),
}));

export const userContentInteractionsRelations = relations(userContentInteractions, ({ one }) => ({
  user: one(users, {
    fields: [userContentInteractions.userId],
    references: [users.id],
  }),
  content: one(contentCatalog, {
    fields: [userContentInteractions.contentId],
    references: [contentCatalog.id],
  }),
}));

export const userTopicPreferencesRelations = relations(userTopicPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userTopicPreferences.userId],
    references: [users.id],
  }),
  topic: one(contentTopics, {
    fields: [userTopicPreferences.topicId],
    references: [contentTopics.id],
  }),
}));

export const contentVocabularyRelations = relations(contentVocabulary, ({ one }) => ({
  content: one(contentCatalog, {
    fields: [contentVocabulary.contentId],
    references: [contentCatalog.id],
  }),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id],
  }),
}));
