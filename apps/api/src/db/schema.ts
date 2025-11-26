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
