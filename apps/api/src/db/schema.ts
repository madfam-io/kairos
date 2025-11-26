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

export const usersRelations = relations(users, ({ many }) => ({
  vocabulary: many(vocabulary),
  cards: many(cards),
  analyticsEvents: many(analyticsEvents),
}));

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

export const vocabularyRelations = relations(vocabulary, ({ one }) => ({
  user: one(users, {
    fields: [vocabulary.userId],
    references: [users.id],
  }),
}));

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

export const cardsRelations = relations(cards, ({ one }) => ({
  user: one(users, {
    fields: [cards.userId],
    references: [users.id],
  }),
}));

/**
 * Simplification cache - reduces LLM costs
 */
export const simplificationCache = pgTable(
  'simplification_cache',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    originalText: text('original_text').notNull(),
    hskLevel: integer('hsk_level').notNull(),
    simplifiedText: text('simplified_text').notNull(),
    modelVersion: text('model_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    hitCount: integer('hit_count').default(1).notNull(),
  },
  (table) => ({
    originalLevelUnique: uniqueIndex('cache_original_level_idx').on(
      table.originalText,
      table.hskLevel
    ),
  })
);

/**
 * Pre-computed show simplifications
 */
export const showSimplifications = pgTable(
  'show_simplifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    showId: text('show_id').notNull(),
    episode: integer('episode').notNull(),
    subtitleIndex: integer('subtitle_index').notNull(),
    originalText: text('original_text').notNull(),
    hsk3Text: text('hsk3_text'),
    hsk4Text: text('hsk4_text'),
    hsk5Text: text('hsk5_text'),
    verified: boolean('verified').default(false).notNull(),
  },
  (table) => ({
    showEpisodeSubtitleUnique: uniqueIndex('show_episode_subtitle_idx').on(
      table.showId,
      table.episode,
      table.subtitleIndex
    ),
  })
);

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

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  user: one(users, {
    fields: [analyticsEvents.userId],
    references: [users.id],
  }),
}));

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

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, {
    fields: [userStats.userId],
    references: [users.id],
  }),
}));

/**
 * Grammar patterns - pre-computed grammar explanations
 */
export const grammarPatterns = pgTable(
  'grammar_patterns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pattern: text('pattern').notNull(),
    patternZh: text('pattern_zh').notNull(),
    name: text('name').notNull(),
    nameZh: text('name_zh').notNull(),
    explanation: text('explanation').notNull(),
    explanationZh: text('explanation_zh'),
    structure: text('structure').notNull(),
    hskLevel: integer('hsk_level'),
    examples: jsonb('examples').notNull().default([]),
    relatedPatterns: jsonb('related_patterns').default([]),
    tags: jsonb('tags').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    patternIdx: uniqueIndex('grammar_pattern_idx').on(table.pattern),
    hskLevelIdx: index('grammar_hsk_level_idx').on(table.hskLevel),
  })
);

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

export const sharedDecksRelations = relations(sharedDecks, ({ one, many }) => ({
  author: one(users, {
    fields: [sharedDecks.authorId],
    references: [users.id],
  }),
  words: many(sharedDeckWords),
  likes: many(sharedDeckLikes),
}));

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

export const sharedDeckWordsRelations = relations(sharedDeckWords, ({ one }) => ({
  deck: one(sharedDecks, {
    fields: [sharedDeckWords.deckId],
    references: [sharedDecks.id],
  }),
}));

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

/**
 * Classrooms - for tutors to manage student groups
 */
export const classrooms = pgTable(
  'classrooms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tutorId: uuid('tutor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    joinCode: text('join_code').notNull().unique(),
    maxStudents: integer('max_students').default(30).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    settings: jsonb('settings').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tutorIdx: index('classrooms_tutor_idx').on(table.tutorId),
    joinCodeIdx: uniqueIndex('classrooms_join_code_idx').on(table.joinCode),
  })
);

export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  tutor: one(users, {
    fields: [classrooms.tutorId],
    references: [users.id],
  }),
  students: many(classroomStudents),
  assignments: many(classroomAssignments),
}));

/**
 * Classroom students - students enrolled in a classroom
 */
export const classroomStudents = pgTable(
  'classroom_students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classroomId: uuid('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => ({
    classroomStudentUnique: uniqueIndex('classroom_student_unique_idx').on(
      table.classroomId,
      table.studentId
    ),
    classroomIdx: index('classroom_students_classroom_idx').on(table.classroomId),
    studentIdx: index('classroom_students_student_idx').on(table.studentId),
  })
);

export const classroomStudentsRelations = relations(classroomStudents, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomStudents.classroomId],
    references: [classrooms.id],
  }),
  student: one(users, {
    fields: [classroomStudents.studentId],
    references: [users.id],
  }),
}));

/**
 * Classroom assignments - vocabulary or content assignments
 */
export const classroomAssignments = pgTable(
  'classroom_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classroomId: uuid('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type').notNull(), // 'vocabulary', 'deck', 'content'
    targetDeckId: uuid('target_deck_id').references(() => sharedDecks.id),
    targetWords: jsonb('target_words').default([]), // For custom word lists
    dueDate: timestamp('due_date', { withTimezone: true }),
    settings: jsonb('settings').default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    classroomIdx: index('assignments_classroom_idx').on(table.classroomId),
    dueDateIdx: index('assignments_due_date_idx').on(table.dueDate),
  })
);

export const classroomAssignmentsRelations = relations(classroomAssignments, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [classroomAssignments.classroomId],
    references: [classrooms.id],
  }),
  targetDeck: one(sharedDecks, {
    fields: [classroomAssignments.targetDeckId],
    references: [sharedDecks.id],
  }),
  progress: many(assignmentProgress),
}));

/**
 * Assignment progress - track student progress on assignments
 */
export const assignmentProgress = pgTable(
  'assignment_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => classroomAssignments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    wordsCompleted: integer('words_completed').default(0).notNull(),
    totalWords: integer('total_words').default(0).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    score: real('score'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assignmentStudentUnique: uniqueIndex('assignment_student_unique_idx').on(
      table.assignmentId,
      table.studentId
    ),
    assignmentIdx: index('progress_assignment_idx').on(table.assignmentId),
    studentIdx: index('progress_student_idx').on(table.studentId),
  })
);

export const assignmentProgressRelations = relations(assignmentProgress, ({ one }) => ({
  assignment: one(classroomAssignments, {
    fields: [assignmentProgress.assignmentId],
    references: [classroomAssignments.id],
  }),
  student: one(users, {
    fields: [assignmentProgress.studentId],
    references: [users.id],
  }),
}));

// ============================================
// Advanced Analytics Dashboard Tables
// ============================================

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

export const dailyStatsRelations = relations(dailyStats, ({ one }) => ({
  user: one(users, {
    fields: [dailyStats.userId],
    references: [users.id],
  }),
}));

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

// ============================================================================
// ENTERPRISE / INSTITUTIONAL TIER
// ============================================================================

/**
 * Organizations - universities, schools, companies
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(), // URL-safe identifier
    type: text('type').notNull().default('university'), // 'university', 'school', 'company', 'language_school'
    logoUrl: text('logo_url'),
    domain: text('domain'), // Email domain for auto-join (e.g., 'stanford.edu')
    settings: jsonb('settings').default({}).notNull(),
    // Billing
    billingEmail: text('billing_email'),
    billingAddress: jsonb('billing_address'),
    stripeCustomerId: text('stripe_customer_id'),
    // License info
    licenseTier: text('license_tier').default('standard').notNull(), // 'standard', 'premium', 'unlimited'
    maxSeats: integer('max_seats').default(50).notNull(),
    usedSeats: integer('used_seats').default(0).notNull(),
    licenseExpiresAt: timestamp('license_expires_at', { withTimezone: true }),
    // Status
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
    domainIdx: index('organizations_domain_idx').on(table.domain),
  })
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  departments: many(organizationDepartments),
  invites: many(organizationInvites),
  decks: many(organizationDecks),
  ssoConfig: many(organizationSsoConfigs),
}));

/**
 * Organization members - users belonging to an org with roles
 */
export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id').references(() => organizationDepartments.id, {
      onDelete: 'set null',
    }),
    role: text('role').notNull().default('member'), // 'owner', 'admin', 'instructor', 'member'
    displayName: text('display_name'),
    studentId: text('student_id'), // External student/employee ID
    isActive: boolean('is_active').default(true).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  },
  (table) => ({
    orgUserUnique: uniqueIndex('org_member_unique_idx').on(table.organizationId, table.userId),
    orgIdx: index('org_members_org_idx').on(table.organizationId),
    userIdx: index('org_members_user_idx').on(table.userId),
    deptIdx: index('org_members_dept_idx').on(table.departmentId),
  })
);

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
  department: one(organizationDepartments, {
    fields: [organizationMembers.departmentId],
    references: [organizationDepartments.id],
  }),
}));

/**
 * Organization departments - sub-groups within an org
 */
export const organizationDepartments = pgTable(
  'organization_departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'), // For nested departments
    name: text('name').notNull(),
    code: text('code'), // e.g., 'CHIN101', 'EAST-ASIAN'
    description: text('description'),
    settings: jsonb('settings').default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('org_departments_org_idx').on(table.organizationId),
    codeIdx: index('org_departments_code_idx').on(table.organizationId, table.code),
  })
);

export const organizationDepartmentsRelations = relations(
  organizationDepartments,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationDepartments.organizationId],
      references: [organizations.id],
    }),
    parent: one(organizationDepartments, {
      fields: [organizationDepartments.parentId],
      references: [organizationDepartments.id],
    }),
    members: many(organizationMembers),
  })
);

/**
 * Organization invites - pending invitations
 */
export const organizationInvites = pgTable(
  'organization_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('member'),
    departmentId: uuid('department_id').references(() => organizationDepartments.id),
    invitedById: uuid('invited_by_id')
      .notNull()
      .references(() => users.id),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('org_invites_token_idx').on(table.token),
    orgEmailIdx: index('org_invites_org_email_idx').on(table.organizationId, table.email),
  })
);

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvites.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [organizationInvites.invitedById],
    references: [users.id],
  }),
  department: one(organizationDepartments, {
    fields: [organizationInvites.departmentId],
    references: [organizationDepartments.id],
  }),
}));

/**
 * Organization decks - private content libraries for orgs
 */
export const organizationDecks = pgTable(
  'organization_decks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => sharedDecks.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id').references(() => organizationDepartments.id),
    isRequired: boolean('is_required').default(false).notNull(), // Required for all members
    addedById: uuid('added_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgDeckUnique: uniqueIndex('org_deck_unique_idx').on(table.organizationId, table.deckId),
    orgIdx: index('org_decks_org_idx').on(table.organizationId),
  })
);

export const organizationDecksRelations = relations(organizationDecks, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationDecks.organizationId],
    references: [organizations.id],
  }),
  deck: one(sharedDecks, {
    fields: [organizationDecks.deckId],
    references: [sharedDecks.id],
  }),
  department: one(organizationDepartments, {
    fields: [organizationDecks.departmentId],
    references: [organizationDepartments.id],
  }),
  addedBy: one(users, {
    fields: [organizationDecks.addedById],
    references: [users.id],
  }),
}));

/**
 * Organization SSO configs - SAML/OIDC settings
 */
export const organizationSsoConfigs = pgTable(
  'organization_sso_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .unique(),
    provider: text('provider').notNull(), // 'saml', 'oidc'
    isEnabled: boolean('is_enabled').default(false).notNull(),
    // SAML settings
    samlEntityId: text('saml_entity_id'),
    samlSsoUrl: text('saml_sso_url'),
    samlCertificate: text('saml_certificate'),
    // OIDC settings
    oidcClientId: text('oidc_client_id'),
    oidcClientSecret: text('oidc_client_secret'),
    oidcIssuer: text('oidc_issuer'),
    oidcAuthUrl: text('oidc_auth_url'),
    oidcTokenUrl: text('oidc_token_url'),
    // Attribute mapping
    attributeMapping: jsonb('attribute_mapping').default({}).notNull(),
    // Auto-provisioning
    autoProvision: boolean('auto_provision').default(true).notNull(),
    defaultRole: text('default_role').default('member').notNull(),
    defaultDepartmentId: uuid('default_department_id').references(() => organizationDepartments.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: uniqueIndex('org_sso_config_org_idx').on(table.organizationId),
  })
);

export const organizationSsoConfigsRelations = relations(organizationSsoConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationSsoConfigs.organizationId],
    references: [organizations.id],
  }),
  defaultDepartment: one(organizationDepartments, {
    fields: [organizationSsoConfigs.defaultDepartmentId],
    references: [organizationDepartments.id],
  }),
}));

/**
 * Organization audit logs - track administrative actions
 */
export const organizationAuditLogs = pgTable(
  'organization_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(), // 'member_added', 'member_removed', 'settings_changed', etc.
    targetType: text('target_type'), // 'member', 'department', 'deck', 'settings'
    targetId: text('target_id'),
    details: jsonb('details').default({}).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgTimeIdx: index('org_audit_logs_org_time_idx').on(table.organizationId, table.createdAt),
    actorIdx: index('org_audit_logs_actor_idx').on(table.actorId),
  })
);

export const organizationAuditLogsRelations = relations(organizationAuditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationAuditLogs.organizationId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [organizationAuditLogs.actorId],
    references: [users.id],
  }),
}));

/**
 * Organization license history - track license changes
 */
export const organizationLicenseHistory = pgTable(
  'organization_license_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    event: text('event').notNull(), // 'created', 'upgraded', 'downgraded', 'renewed', 'expired'
    previousTier: text('previous_tier'),
    newTier: text('new_tier'),
    previousSeats: integer('previous_seats'),
    newSeats: integer('new_seats'),
    amount: real('amount'),
    invoiceId: text('invoice_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('org_license_history_org_idx').on(table.organizationId),
  })
);

// ============================================================================
// THIRD-PARTY API INTEGRATIONS
// ============================================================================

/**
 * API applications - registered third-party apps (OAuth clients)
 */
export const apiApplications = pgTable(
  'api_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    websiteUrl: text('website_url'),
    logoUrl: text('logo_url'),
    // OAuth settings
    clientId: text('client_id').notNull().unique(),
    clientSecretHash: text('client_secret_hash').notNull(),
    redirectUris: jsonb('redirect_uris').default([]).notNull(), // Array of allowed redirect URIs
    scopes: jsonb('scopes').default([]).notNull(), // Allowed scopes for this app
    // Rate limits
    rateLimitTier: text('rate_limit_tier').default('standard').notNull(), // 'standard', 'premium', 'unlimited'
    requestsPerMinute: integer('requests_per_minute').default(60).notNull(),
    requestsPerDay: integer('requests_per_day').default(10000).notNull(),
    // Status
    isVerified: boolean('is_verified').default(false).notNull(), // Manually verified by admin
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    clientIdIdx: uniqueIndex('api_apps_client_id_idx').on(table.clientId),
    ownerIdx: index('api_apps_owner_idx').on(table.ownerId),
  })
);

export const apiApplicationsRelations = relations(apiApplications, ({ one, many }) => ({
  owner: one(users, {
    fields: [apiApplications.ownerId],
    references: [users.id],
  }),
  apiKeys: many(apiKeys),
  oauthTokens: many(oauthTokens),
  webhooks: many(webhookEndpoints),
}));

/**
 * API keys - simple authentication for server-to-server integrations
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').references(() => apiApplications.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyPrefix: text('key_prefix').notNull(), // First 8 chars for identification
    keyHash: text('key_hash').notNull(), // Hashed full key
    scopes: jsonb('scopes').default([]).notNull(), // 'read:vocabulary', 'write:vocabulary', etc.
    // Rate limits (can override app defaults)
    requestsPerMinute: integer('requests_per_minute'),
    requestsPerDay: integer('requests_per_day'),
    // Usage tracking
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    requestCount: integer('request_count').default(0).notNull(),
    // Expiration
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    keyPrefixIdx: index('api_keys_prefix_idx').on(table.keyPrefix),
    userIdx: index('api_keys_user_idx').on(table.userId),
    appIdx: index('api_keys_app_idx').on(table.applicationId),
  })
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
  application: one(apiApplications, {
    fields: [apiKeys.applicationId],
    references: [apiApplications.id],
  }),
}));

/**
 * OAuth tokens - tokens issued for OAuth2 authorization
 */
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => apiApplications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Tokens
    accessTokenHash: text('access_token_hash').notNull(),
    refreshTokenHash: text('refresh_token_hash'),
    // Scopes granted
    scopes: jsonb('scopes').default([]).notNull(),
    // Expiration
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    // Status
    isRevoked: boolean('is_revoked').default(false).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    appUserIdx: index('oauth_tokens_app_user_idx').on(table.applicationId, table.userId),
    userIdx: index('oauth_tokens_user_idx').on(table.userId),
  })
);

export const oauthTokensRelations = relations(oauthTokens, ({ one }) => ({
  application: one(apiApplications, {
    fields: [oauthTokens.applicationId],
    references: [apiApplications.id],
  }),
  user: one(users, {
    fields: [oauthTokens.userId],
    references: [users.id],
  }),
}));

/**
 * OAuth authorization codes - temporary codes for OAuth2 flow
 */
export const oauthAuthorizationCodes = pgTable(
  'oauth_authorization_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => apiApplications.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull().unique(),
    redirectUri: text('redirect_uri').notNull(),
    scopes: jsonb('scopes').default([]).notNull(),
    codeChallenge: text('code_challenge'), // PKCE
    codeChallengeMethod: text('code_challenge_method'), // 'S256' or 'plain'
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: uniqueIndex('oauth_auth_codes_code_idx').on(table.code),
  })
);

/**
 * Webhook endpoints - registered webhook URLs
 */
export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').references(() => apiApplications.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    description: text('description'),
    // Events to subscribe to
    events: jsonb('events').default([]).notNull(), // ['vocabulary.created', 'card.mined', etc.]
    // Security
    secret: text('secret').notNull(), // For signing payloads
    // Status
    isActive: boolean('is_active').default(true).notNull(),
    lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
    lastDeliveryStatus: text('last_delivery_status'), // 'success', 'failed'
    consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
    disabledAt: timestamp('disabled_at', { withTimezone: true }), // Auto-disabled after failures
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('webhook_endpoints_user_idx').on(table.userId),
    appIdx: index('webhook_endpoints_app_idx').on(table.applicationId),
  })
);

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  user: one(users, {
    fields: [webhookEndpoints.userId],
    references: [users.id],
  }),
  application: one(apiApplications, {
    fields: [webhookEndpoints.applicationId],
    references: [apiApplications.id],
  }),
  deliveries: many(webhookDeliveries),
}));

/**
 * Webhook deliveries - log of webhook delivery attempts
 */
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    // Delivery info
    requestHeaders: jsonb('request_headers'),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    responseTimeMs: integer('response_time_ms'),
    // Status
    status: text('status').notNull(), // 'pending', 'success', 'failed'
    attempts: integer('attempts').default(1).notNull(),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    endpointIdx: index('webhook_deliveries_endpoint_idx').on(table.endpointId),
    statusIdx: index('webhook_deliveries_status_idx').on(table.status),
    retryIdx: index('webhook_deliveries_retry_idx').on(table.nextRetryAt),
  })
);

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.endpointId],
    references: [webhookEndpoints.id],
  }),
}));

/**
 * API usage logs - track API usage for analytics and billing
 */
export const apiUsageLogs = pgTable(
  'api_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
    applicationId: uuid('application_id').references(() => apiApplications.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    // Request info
    method: text('method').notNull(),
    path: text('path').notNull(),
    statusCode: integer('status_code').notNull(),
    responseTimeMs: integer('response_time_ms'),
    // Metadata
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    apiKeyIdx: index('api_usage_logs_key_idx').on(table.apiKeyId),
    appIdx: index('api_usage_logs_app_idx').on(table.applicationId),
    createdAtIdx: index('api_usage_logs_created_idx').on(table.createdAt),
  })
);

/**
 * LTI platforms - Learning Tools Interoperability for LMS integration
 */
export const ltiPlatforms = pgTable(
  'lti_platforms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    platformType: text('platform_type').notNull(), // 'canvas', 'blackboard', 'moodle', 'other'
    // LTI 1.3 settings
    issuer: text('issuer').notNull(),
    clientId: text('client_id').notNull(),
    deploymentId: text('deployment_id'),
    publicKeysetUrl: text('public_keyset_url'),
    accessTokenUrl: text('access_token_url'),
    authLoginUrl: text('auth_login_url'),
    // Our keys for this platform
    privateKey: text('private_key'), // RSA private key (encrypted)
    publicKey: text('public_key'),
    // Status
    isActive: boolean('is_active').default(true).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    issuerIdx: index('lti_platforms_issuer_idx').on(table.issuer),
    orgIdx: index('lti_platforms_org_idx').on(table.organizationId),
  })
);

export const ltiPlatformsRelations = relations(ltiPlatforms, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [ltiPlatforms.organizationId],
    references: [organizations.id],
  }),
  launches: many(ltiLaunches),
}));

/**
 * LTI launches - track LTI launch sessions
 */
export const ltiLaunches = pgTable(
  'lti_launches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => ltiPlatforms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    // LTI context
    ltiUserId: text('lti_user_id').notNull(), // User ID from LMS
    ltiContextId: text('lti_context_id'), // Course/context ID from LMS
    ltiResourceLinkId: text('lti_resource_link_id'), // Specific resource
    // User info from LMS
    ltiUserName: text('lti_user_name'),
    ltiUserEmail: text('lti_user_email'),
    ltiRoles: jsonb('lti_roles').default([]).notNull(),
    // Grade passback
    ltiLineItemUrl: text('lti_line_item_url'), // For submitting grades
    // Session
    state: text('state').notNull(), // For OIDC flow
    nonce: text('nonce').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    platformIdx: index('lti_launches_platform_idx').on(table.platformId),
    userIdx: index('lti_launches_user_idx').on(table.userId),
    stateIdx: index('lti_launches_state_idx').on(table.state),
  })
);

export const ltiLaunchesRelations = relations(ltiLaunches, ({ one }) => ({
  platform: one(ltiPlatforms, {
    fields: [ltiLaunches.platformId],
    references: [ltiPlatforms.id],
  }),
  user: one(users, {
    fields: [ltiLaunches.userId],
    references: [users.id],
  }),
}));

/**
 * External integrations - user-connected external services
 */
export const externalIntegrations = pgTable(
  'external_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'notion', 'readwise', 'obsidian', 'anki_connect'
    // Connection info (encrypted)
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    // Provider-specific settings
    settings: jsonb('settings').default({}).notNull(),
    externalUserId: text('external_user_id'),
    externalWorkspaceId: text('external_workspace_id'),
    // Sync settings
    syncEnabled: boolean('sync_enabled').default(true).notNull(),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastSyncStatus: text('last_sync_status'),
    lastSyncError: text('last_sync_error'),
    // Status
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userProviderUnique: uniqueIndex('external_integrations_user_provider_idx').on(
      table.userId,
      table.provider
    ),
    userIdx: index('external_integrations_user_idx').on(table.userId),
  })
);

export const externalIntegrationsRelations = relations(externalIntegrations, ({ one }) => ({
  user: one(users, {
    fields: [externalIntegrations.userId],
    references: [users.id],
  }),
}));
