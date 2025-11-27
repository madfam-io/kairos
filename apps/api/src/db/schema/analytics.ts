/**
 * Analytics Schema - Events, Daily Stats, Sessions, Mastery, Goals, Insights
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
 * Analytics events
 */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    eventType: text('event_type').notNull(),
    eventData: jsonb('event_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userTypeCreatedIdx: index('analytics_user_type_created_idx').on(
      table.userId,
      table.eventType,
      table.createdAt
    ),
  })
);

/**
 * Daily learning stats - aggregated daily metrics for charts
 */
export const dailyStats = pgTable(
  'daily_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: timestamp('date', { withTimezone: true }).notNull(),
    wordsLearned: integer('words_learned').default(0).notNull(),
    wordsReviewed: integer('words_reviewed').default(0).notNull(),
    cardsMined: integer('cards_mined').default(0).notNull(),
    cardsExported: integer('cards_exported').default(0).notNull(),
    studyTimeMinutes: integer('study_time_minutes').default(0).notNull(),
    sessionsCount: integer('sessions_count').default(0).notNull(),
    simplificationsUsed: integer('simplifications_used').default(0).notNull(),
    correctReviews: integer('correct_reviews').default(0).notNull(),
    totalReviews: integer('total_reviews').default(0).notNull(),
    newWordsFromHsk1: integer('new_words_hsk1').default(0).notNull(),
    newWordsFromHsk2: integer('new_words_hsk2').default(0).notNull(),
    newWordsFromHsk3: integer('new_words_hsk3').default(0).notNull(),
    newWordsFromHsk4: integer('new_words_hsk4').default(0).notNull(),
    newWordsFromHsk5: integer('new_words_hsk5').default(0).notNull(),
    newWordsFromHsk6: integer('new_words_hsk6').default(0).notNull(),
  },
  (table) => ({
    userDateUnique: uniqueIndex('daily_stats_user_date_idx').on(table.userId, table.date),
    dateIdx: index('daily_stats_date_idx').on(table.date),
  })
);

/**
 * Review sessions - individual review session tracking
 */
export const reviewSessions = pgTable(
  'review_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    wordsReviewed: integer('words_reviewed').default(0).notNull(),
    correctAnswers: integer('correct_answers').default(0).notNull(),
    averageResponseTimeMs: integer('avg_response_time_ms'),
    sessionType: text('session_type').default('review').notNull(), // 'review', 'learn', 'mixed'
    deviceType: text('device_type'), // 'desktop', 'mobile', 'extension'
  },
  (table) => ({
    userStartedIdx: index('review_sessions_user_started_idx').on(table.userId, table.startedAt),
  })
);

/**
 * Word mastery tracking - detailed per-word retention data
 */
export const wordMastery = pgTable(
  'word_mastery',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    word: text('word').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    totalReviews: integer('total_reviews').default(0).notNull(),
    correctReviews: integer('correct_reviews').default(0).notNull(),
    currentInterval: integer('current_interval').default(1).notNull(), // days
    masteryLevel: real('mastery_level').default(0).notNull(), // 0-100%
    retentionScore: real('retention_score').default(0).notNull(), // calculated retention
    difficultySCore: real('difficulty_score').default(0.3).notNull(), // how hard this word is for user
  },
  (table) => ({
    userWordUnique: uniqueIndex('word_mastery_user_word_idx').on(table.userId, table.word),
    masteryIdx: index('word_mastery_level_idx').on(table.userId, table.masteryLevel),
  })
);

/**
 * Learning goals - user-defined goals
 */
export const learningGoals = pgTable(
  'learning_goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalType: text('goal_type').notNull(), // 'daily_words', 'daily_time', 'weekly_words', 'hsk_level', 'streak'
    targetValue: integer('target_value').notNull(),
    currentValue: integer('current_value').default(0).notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userActiveIdx: index('learning_goals_user_active_idx').on(table.userId, table.isActive),
  })
);

/**
 * Content consumption - track what content users are learning from
 */
export const contentConsumption = pgTable(
  'content_consumption',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentType: text('content_type').notNull(), // 'video', 'article', 'subtitle', 'book'
    contentId: text('content_id'), // show ID, article URL, etc.
    contentTitle: text('content_title'),
    totalTimeSeconds: integer('total_time_seconds').default(0).notNull(),
    wordsEncountered: integer('words_encountered').default(0).notNull(),
    wordsMined: integer('words_mined').default(0).notNull(),
    completionPercent: real('completion_percent').default(0).notNull(),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userContentIdx: index('content_consumption_user_idx').on(table.userId, table.contentType),
  })
);

/**
 * Learning insights - AI-generated insights and recommendations
 */
export const learningInsights = pgTable(
  'learning_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    insightType: text('insight_type').notNull(), // 'strength', 'weakness', 'recommendation', 'milestone', 'trend'
    title: text('title').notNull(),
    description: text('description').notNull(),
    data: jsonb('data').default({}).notNull(), // Additional structured data
    priority: integer('priority').default(0).notNull(), // Higher = more important
    isRead: boolean('is_read').default(false).notNull(),
    isDismissed: boolean('is_dismissed').default(false).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userUnreadIdx: index('learning_insights_user_unread_idx').on(table.userId, table.isRead),
  })
);

// Relations
export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  user: one(users, {
    fields: [analyticsEvents.userId],
    references: [users.id],
  }),
}));

export const dailyStatsRelations = relations(dailyStats, ({ one }) => ({
  user: one(users, {
    fields: [dailyStats.userId],
    references: [users.id],
  }),
}));
