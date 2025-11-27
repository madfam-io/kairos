/**
 * Onboarding Schema - User onboarding state, quiz results, learning preferences
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './core';

/**
 * Onboarding steps enum for progress tracking
 */
export const ONBOARDING_STEPS = [
  'welcome',
  'language_background',
  'learning_goals',
  'hsk_assessment',
  'preferences',
  'first_content',
  'completed',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * User onboarding state - tracks where user is in the onboarding flow
 */
export const userOnboarding = pgTable('user_onboarding', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  currentStep: text('current_step').default('welcome').notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  isSkipped: boolean('is_skipped').default(false).notNull(),
  completedSteps: jsonb('completed_steps').default([]).notNull(), // string[]
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  lastStepAt: timestamp('last_step_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * HSK Assessment results - stores the placement quiz results
 */
export const hskAssessment = pgTable('hsk_assessment', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  assessedLevel: integer('assessed_level').notNull(), // 1-6
  confidenceScore: integer('confidence_score').notNull(), // 0-100
  questionsAnswered: integer('questions_answered').notNull(),
  correctAnswers: integer('correct_answers').notNull(),
  timeSpentSeconds: integer('time_spent_seconds').notNull(),
  // Detailed breakdown by HSK level
  levelBreakdown: jsonb('level_breakdown').default({}).notNull(),
  // Individual question results for analysis
  questionResults: jsonb('question_results').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userCreatedIdx: index('hsk_assessment_user_created_idx').on(table.userId, table.createdAt),
}));

/**
 * Learning preferences - collected during onboarding
 */
export const learningPreferences = pgTable('learning_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  // Language background
  nativeLanguage: text('native_language').default('en').notNull(),
  hasStudiedChinese: boolean('has_studied_chinese').default(false).notNull(),
  yearsStudied: integer('years_studied'),
  previousMethods: jsonb('previous_methods').default([]).notNull(), // ['classroom', 'app', 'tutor', etc.]
  // Learning goals
  primaryGoal: text('primary_goal').notNull(), // 'travel', 'work', 'academic', 'heritage', 'media', 'general'
  weeklyHoursTarget: integer('weekly_hours_target').default(5).notNull(),
  targetHskLevel: integer('target_hsk_level'),
  // Content preferences
  preferredContentTypes: jsonb('preferred_content_types').default([]).notNull(), // ['shows', 'movies', 'books', 'news', etc.]
  preferredGenres: jsonb('preferred_genres').default([]).notNull(), // ['drama', 'comedy', 'action', etc.]
  interestTopics: jsonb('interest_topics').default([]).notNull(), // ['technology', 'food', 'travel', etc.]
  // Learning style
  preferredSessionLength: integer('preferred_session_length').default(15).notNull(), // minutes
  preferVoiceInput: boolean('prefer_voice_input').default(false).notNull(),
  preferWritingPractice: boolean('prefer_writing_practice').default(false).notNull(),
  // Schedule
  preferredStudyTimes: jsonb('preferred_study_times').default([]).notNull(), // ['morning', 'afternoon', 'evening']
  reminderEnabled: boolean('reminder_enabled').default(true).notNull(),
  reminderTime: text('reminder_time'), // '09:00'
  timezone: text('timezone'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Recommended content - personalized recommendations based on onboarding
 */
export const recommendedContent = pgTable(
  'recommended_content',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentType: text('content_type').notNull(), // 'show', 'deck', 'article', 'course'
    contentId: text('content_id').notNull(), // ID in the respective content table
    title: text('title').notNull(),
    description: text('description'),
    thumbnailUrl: text('thumbnail_url'),
    difficulty: integer('difficulty').notNull(), // 1-6 (HSK level)
    matchScore: integer('match_score').notNull(), // 0-100, how well it matches preferences
    matchReasons: jsonb('match_reasons').default([]).notNull(), // ['matches_genre', 'matches_level', etc.]
    isViewed: boolean('is_viewed').default(false).notNull(),
    isDismissed: boolean('is_dismissed').default(false).notNull(),
    isStarted: boolean('is_started').default(false).notNull(),
    position: integer('position').default(0).notNull(), // display order
    category: text('category').default('for_you').notNull(), // 'for_you', 'trending', 'new', 'continue'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    userCategoryIdx: index('recommended_content_user_category_idx').on(
      table.userId,
      table.category,
      table.position
    ),
    userContentIdx: uniqueIndex('recommended_content_user_content_idx').on(
      table.userId,
      table.contentType,
      table.contentId
    ),
  })
);

/**
 * Onboarding analytics - track how users move through onboarding
 */
export const onboardingEvents = pgTable(
  'onboarding_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(), // 'step_started', 'step_completed', 'step_skipped', 'quiz_started', etc.
    step: text('step'), // which onboarding step
    data: jsonb('data').default({}).notNull(), // additional event data
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userEventIdx: index('onboarding_events_user_idx').on(table.userId, table.createdAt),
  })
);

// Relations
export const userOnboardingRelations = relations(userOnboarding, ({ one }) => ({
  user: one(users, {
    fields: [userOnboarding.userId],
    references: [users.id],
  }),
}));

export const hskAssessmentRelations = relations(hskAssessment, ({ one }) => ({
  user: one(users, {
    fields: [hskAssessment.userId],
    references: [users.id],
  }),
}));

export const learningPreferencesRelations = relations(learningPreferences, ({ one }) => ({
  user: one(users, {
    fields: [learningPreferences.userId],
    references: [users.id],
  }),
}));

export const recommendedContentRelations = relations(recommendedContent, ({ one }) => ({
  user: one(users, {
    fields: [recommendedContent.userId],
    references: [users.id],
  }),
}));

export const onboardingEventsRelations = relations(onboardingEvents, ({ one }) => ({
  user: one(users, {
    fields: [onboardingEvents.userId],
    references: [users.id],
  }),
}));
