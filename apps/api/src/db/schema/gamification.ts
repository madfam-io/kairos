/**
 * Gamification Schema - Achievements, streaks, challenges, leaderboards
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
  real,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './core';

/**
 * Achievement definitions - master list of all possible achievements
 */
export const achievementDefinitions = pgTable('achievement_definitions', {
  id: text('id').primaryKey(), // e.g., 'first_word', 'streak_7', 'hsk1_complete'
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // 'learning', 'consistency', 'mastery', 'social', 'special'
  icon: text('icon').notNull(), // emoji or icon name
  rarity: text('rarity').default('common').notNull(), // 'common', 'uncommon', 'rare', 'epic', 'legendary'
  xpReward: integer('xp_reward').default(10).notNull(),
  // Requirements for earning this achievement
  requirements: jsonb('requirements').default({}).notNull(),
  // Visual/display options
  badgeColor: text('badge_color').default('#4CAF50').notNull(),
  isHidden: boolean('is_hidden').default(false).notNull(), // Hidden until earned
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * User achievements - achievements earned by users
 */
export const userAchievements = pgTable(
  'user_achievements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: text('achievement_id')
      .notNull()
      .references(() => achievementDefinitions.id),
    earnedAt: timestamp('earned_at', { withTimezone: true }).defaultNow().notNull(),
    // Context when earned
    context: jsonb('context').default({}).notNull(), // e.g., { word: '学习', level: 3 }
    // Notification/display
    isNotified: boolean('is_notified').default(false).notNull(),
    isDisplayed: boolean('is_displayed').default(true).notNull(), // Show on profile
  },
  (table) => ({
    userAchievementIdx: uniqueIndex('user_achievements_user_achievement_idx').on(
      table.userId,
      table.achievementId
    ),
    userEarnedIdx: index('user_achievements_user_earned_idx').on(table.userId, table.earnedAt),
  })
);

/**
 * User XP and leveling
 */
export const userXp = pgTable('user_xp', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  totalXp: integer('total_xp').default(0).notNull(),
  level: integer('level').default(1).notNull(),
  xpToNextLevel: integer('xp_to_next_level').default(100).notNull(),
  // XP breakdown by category
  learningXp: integer('learning_xp').default(0).notNull(),
  consistencyXp: integer('consistency_xp').default(0).notNull(),
  masteryXp: integer('mastery_xp').default(0).notNull(),
  socialXp: integer('social_xp').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * XP transactions - history of XP gains
 */
export const xpTransactions = pgTable(
  'xp_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    category: text('category').notNull(), // 'learning', 'consistency', 'mastery', 'social', 'achievement'
    source: text('source').notNull(), // 'word_learned', 'streak_bonus', 'achievement', etc.
    sourceId: text('source_id'), // Related entity ID
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index('xp_transactions_user_created_idx').on(table.userId, table.createdAt),
  })
);

/**
 * Challenge definitions - daily/weekly/special challenges
 */
export const challengeDefinitions = pgTable('challenge_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull(), // 'daily', 'weekly', 'special', 'community'
  // Challenge requirements
  goal: text('goal').notNull(), // 'words_learned', 'review_streak', 'time_studied', etc.
  targetValue: integer('target_value').notNull(),
  // Rewards
  xpReward: integer('xp_reward').default(50).notNull(),
  achievementReward: text('achievement_reward'), // achievement ID if completing unlocks one
  // Timing
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  isRecurring: boolean('is_recurring').default(false).notNull(),
  recurringDays: integer('recurring_days'), // e.g., 7 for weekly
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * User challenges - user participation in challenges
 */
export const userChallenges = pgTable(
  'user_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    challengeId: uuid('challenge_id')
      .notNull()
      .references(() => challengeDefinitions.id),
    progress: integer('progress').default(0).notNull(),
    targetValue: integer('target_value').notNull(),
    isCompleted: boolean('is_completed').default(false).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => ({
    userChallengeIdx: uniqueIndex('user_challenges_user_challenge_idx').on(
      table.userId,
      table.challengeId
    ),
    userActiveIdx: index('user_challenges_user_active_idx').on(table.userId, table.isCompleted),
  })
);

/**
 * Study groups - collaborative learning groups
 */
export const studyGroups = pgTable(
  'study_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    slug: text('slug').notNull().unique(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    // Group settings
    isPublic: boolean('is_public').default(true).notNull(),
    requiresApproval: boolean('requires_approval').default(false).notNull(),
    maxMembers: integer('max_members').default(50).notNull(),
    memberCount: integer('member_count').default(1).notNull(),
    // Focus area
    targetHskLevel: integer('target_hsk_level'),
    focusTopic: text('focus_topic'),
    // Stats
    totalWordsLearned: integer('total_words_learned').default(0).notNull(),
    totalStudyMinutes: integer('total_study_minutes').default(0).notNull(),
    // Visual
    coverImageUrl: text('cover_image_url'),
    iconEmoji: text('icon_emoji').default('📚').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index('study_groups_owner_idx').on(table.ownerId),
    publicIdx: index('study_groups_public_idx').on(table.isPublic),
  })
);

/**
 * Study group members
 */
export const studyGroupMembers = pgTable(
  'study_group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => studyGroups.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').default('member').notNull(), // 'owner', 'admin', 'member'
    // Member stats within group
    wordsLearned: integer('words_learned').default(0).notNull(),
    studyMinutes: integer('study_minutes').default(0).notNull(),
    currentStreak: integer('current_streak').default(0).notNull(),
    // Status
    status: text('status').default('active').notNull(), // 'active', 'pending', 'inactive'
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  },
  (table) => ({
    groupUserIdx: uniqueIndex('study_group_members_group_user_idx').on(table.groupId, table.userId),
    groupRoleIdx: index('study_group_members_group_role_idx').on(table.groupId, table.role),
  })
);

/**
 * Leaderboard entries - weekly/monthly rankings
 */
export const leaderboardEntries = pgTable(
  'leaderboard_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodType: text('period_type').notNull(), // 'daily', 'weekly', 'monthly', 'all_time'
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    // Ranking data
    rank: integer('rank'),
    score: integer('score').default(0).notNull(),
    // Score breakdown
    wordsLearned: integer('words_learned').default(0).notNull(),
    wordsReviewed: integer('words_reviewed').default(0).notNull(),
    studyMinutes: integer('study_minutes').default(0).notNull(),
    streakDays: integer('streak_days').default(0).notNull(),
    xpEarned: integer('xp_earned').default(0).notNull(),
    // Category (for different leaderboards)
    category: text('category').default('global').notNull(), // 'global', 'friends', 'group:{id}'
    categoryId: text('category_id'), // group ID if category is 'group'
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    periodCategoryIdx: index('leaderboard_entries_period_category_idx').on(
      table.periodType,
      table.periodStart,
      table.category
    ),
    userPeriodIdx: index('leaderboard_entries_user_period_idx').on(
      table.userId,
      table.periodType,
      table.periodStart
    ),
    rankIdx: index('leaderboard_entries_rank_idx').on(
      table.periodType,
      table.periodStart,
      table.category,
      table.rank
    ),
  })
);

/**
 * User friendships / follows
 */
export const userFollows = pgTable(
  'user_follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    followerFollowingIdx: uniqueIndex('user_follows_follower_following_idx').on(
      table.followerId,
      table.followingId
    ),
    followerIdx: index('user_follows_follower_idx').on(table.followerId),
    followingIdx: index('user_follows_following_idx').on(table.followingId),
  })
);

/**
 * Activity feed - social updates
 */
export const activityFeed = pgTable(
  'activity_feed',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    activityType: text('activity_type').notNull(), // 'achievement', 'streak', 'level_up', 'challenge_complete', etc.
    title: text('title').notNull(),
    description: text('description'),
    data: jsonb('data').default({}).notNull(),
    // Visibility
    visibility: text('visibility').default('public').notNull(), // 'public', 'friends', 'private'
    // Engagement
    likeCount: integer('like_count').default(0).notNull(),
    commentCount: integer('comment_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // Optional expiry for time-limited posts
  },
  (table) => ({
    userCreatedIdx: index('activity_feed_user_created_idx').on(table.userId, table.createdAt),
    visibilityCreatedIdx: index('activity_feed_visibility_created_idx').on(
      table.visibility,
      table.createdAt
    ),
  })
);

/**
 * Activity likes
 */
export const activityLikes = pgTable(
  'activity_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    activityId: uuid('activity_id')
      .notNull()
      .references(() => activityFeed.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    activityUserIdx: uniqueIndex('activity_likes_activity_user_idx').on(
      table.activityId,
      table.userId
    ),
  })
);

/**
 * Daily goals - personal daily targets
 */
export const dailyGoals = pgTable('daily_goals', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  wordsTarget: integer('words_target').default(10).notNull(),
  reviewTarget: integer('review_target').default(20).notNull(),
  studyMinutesTarget: integer('study_minutes_target').default(15).notNull(),
  // Notifications
  reminderEnabled: boolean('reminder_enabled').default(true).notNull(),
  reminderTime: text('reminder_time').default('09:00').notNull(),
  // Auto-adjust
  autoAdjust: boolean('auto_adjust').default(false).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const achievementDefinitionsRelations = relations(achievementDefinitions, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievementDefinitions, {
    fields: [userAchievements.achievementId],
    references: [achievementDefinitions.id],
  }),
}));

export const userXpRelations = relations(userXp, ({ one }) => ({
  user: one(users, {
    fields: [userXp.userId],
    references: [users.id],
  }),
}));

export const xpTransactionsRelations = relations(xpTransactions, ({ one }) => ({
  user: one(users, {
    fields: [xpTransactions.userId],
    references: [users.id],
  }),
}));

export const challengeDefinitionsRelations = relations(challengeDefinitions, ({ many }) => ({
  userChallenges: many(userChallenges),
}));

export const userChallengesRelations = relations(userChallenges, ({ one }) => ({
  user: one(users, {
    fields: [userChallenges.userId],
    references: [users.id],
  }),
  challenge: one(challengeDefinitions, {
    fields: [userChallenges.challengeId],
    references: [challengeDefinitions.id],
  }),
}));

export const studyGroupsRelations = relations(studyGroups, ({ one, many }) => ({
  owner: one(users, {
    fields: [studyGroups.ownerId],
    references: [users.id],
  }),
  members: many(studyGroupMembers),
}));

export const studyGroupMembersRelations = relations(studyGroupMembers, ({ one }) => ({
  group: one(studyGroups, {
    fields: [studyGroupMembers.groupId],
    references: [studyGroups.id],
  }),
  user: one(users, {
    fields: [studyGroupMembers.userId],
    references: [users.id],
  }),
}));

export const leaderboardEntriesRelations = relations(leaderboardEntries, ({ one }) => ({
  user: one(users, {
    fields: [leaderboardEntries.userId],
    references: [users.id],
  }),
}));

export const userFollowsRelations = relations(userFollows, ({ one }) => ({
  follower: one(users, {
    fields: [userFollows.followerId],
    references: [users.id],
    relationName: 'follower',
  }),
  following: one(users, {
    fields: [userFollows.followingId],
    references: [users.id],
    relationName: 'following',
  }),
}));

export const activityFeedRelations = relations(activityFeed, ({ one, many }) => ({
  user: one(users, {
    fields: [activityFeed.userId],
    references: [users.id],
  }),
  likes: many(activityLikes),
}));

export const activityLikesRelations = relations(activityLikes, ({ one }) => ({
  activity: one(activityFeed, {
    fields: [activityLikes.activityId],
    references: [activityFeed.id],
  }),
  user: one(users, {
    fields: [activityLikes.userId],
    references: [users.id],
  }),
}));

export const dailyGoalsRelations = relations(dailyGoals, ({ one }) => ({
  user: one(users, {
    fields: [dailyGoals.userId],
    references: [users.id],
  }),
}));
