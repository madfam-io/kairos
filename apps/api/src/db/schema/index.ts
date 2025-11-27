/**
 * Schema Index - Re-exports all schema modules
 *
 * This file provides a single entry point for all database schema definitions,
 * organized by domain for better maintainability.
 *
 * Domains:
 * - core: Users, vocabulary, cards, sync, stats
 * - content: Simplification cache, show simplifications, grammar patterns
 * - community: Shared decks, likes, downloads, referrals
 * - education: Classrooms, students, assignments, progress
 * - analytics: Events, daily stats, sessions, mastery, goals, insights
 * - enterprise: Organizations, members, departments, SSO, audit logs
 * - developer: API applications, keys, OAuth, webhooks
 * - lti: LTI platforms and launches
 * - integrations: External service integrations
 */

// Core tables
export {
  users,
  vocabulary,
  cards,
  syncChanges,
  userStats,
} from './core';

// Core relations (defined separately to avoid circular deps)
export {
  usersRelations,
  vocabularyRelations,
  cardsRelations,
  userStatsRelations,
} from './relations';

// Content tables
export {
  simplificationCache,
  showSimplifications,
  grammarPatterns,
} from './content';

// Community tables
export {
  sharedDecks,
  sharedDeckWords,
  sharedDeckLikes,
  userDeckDownloads,
  referralCodes,
  referralUsages,
  sharedDecksRelations,
  sharedDeckWordsRelations,
  sharedDeckLikesRelations,
} from './community';

// Education tables
export {
  classrooms,
  classroomStudents,
  classroomAssignments,
  assignmentProgress,
  classroomsRelations,
  classroomStudentsRelations,
  classroomAssignmentsRelations,
  assignmentProgressRelations,
} from './education';

// Analytics tables
export {
  analyticsEvents,
  dailyStats,
  reviewSessions,
  wordMastery,
  learningGoals,
  contentConsumption,
  learningInsights,
  analyticsEventsRelations,
  dailyStatsRelations,
} from './analytics';

// Enterprise tables
export {
  organizations,
  organizationMembers,
  organizationDepartments,
  organizationInvites,
  organizationDecks,
  organizationSsoConfigs,
  organizationAuditLogs,
  organizationLicenseHistory,
  organizationsRelations,
  organizationMembersRelations,
  organizationDepartmentsRelations,
  organizationInvitesRelations,
  organizationDecksRelations,
  organizationSsoConfigsRelations,
  organizationAuditLogsRelations,
} from './enterprise';

// Developer tables
export {
  apiApplications,
  apiKeys,
  oauthTokens,
  oauthAuthorizationCodes,
  webhookEndpoints,
  webhookDeliveries,
  apiUsageLogs,
  apiApplicationsRelations,
  apiKeysRelations,
  oauthTokensRelations,
  webhookEndpointsRelations,
  webhookDeliveriesRelations,
} from './developer';

// LTI tables
export {
  ltiPlatforms,
  ltiLaunches,
  ltiPlatformsRelations,
  ltiLaunchesRelations,
} from './lti';

// External integrations
export {
  externalIntegrations,
  externalIntegrationsRelations,
} from './integrations';

// Onboarding tables
export {
  ONBOARDING_STEPS,
  userOnboarding,
  hskAssessment,
  learningPreferences,
  recommendedContent,
  onboardingEvents,
  userOnboardingRelations,
  hskAssessmentRelations,
  learningPreferencesRelations,
  recommendedContentRelations,
  onboardingEventsRelations,
} from './onboarding';
export type { OnboardingStep } from './onboarding';

// Review tables (active recall variations)
export {
  CARD_TYPES,
  REVIEW_MODES,
  reviewPreferences,
  reviewCards,
  reviewSessionsV2,
  reviewResponses,
  clozeSentences,
  cardTypePerformance,
  reviewPreferencesRelations,
  reviewCardsRelations,
  reviewSessionsV2Relations,
  reviewResponsesRelations,
  clozeSentencesRelations,
  cardTypePerformanceRelations,
} from './review';
export type { CardType, ReviewMode } from './review';

// Gamification tables
export {
  achievementDefinitions,
  userAchievements,
  userXp,
  xpTransactions,
  challengeDefinitions,
  userChallenges,
  studyGroups,
  studyGroupMembers,
  leaderboardEntries,
  userFollows,
  activityFeed,
  activityLikes,
  dailyGoals,
  achievementDefinitionsRelations,
  userAchievementsRelations,
  userXpRelations,
  xpTransactionsRelations,
  challengeDefinitionsRelations,
  userChallengesRelations,
  studyGroupsRelations,
  studyGroupMembersRelations,
  leaderboardEntriesRelations,
  userFollowsRelations,
  activityFeedRelations,
  activityLikesRelations,
  dailyGoalsRelations,
} from './gamification';

// Discovery tables (content discovery and comprehensibility)
export {
  contentCatalog,
  contentTopics,
  userContentInteractions,
  userTopicPreferences,
  contentVocabulary,
  searchHistory,
  contentCatalogRelations,
  contentTopicsRelations,
  userContentInteractionsRelations,
  userTopicPreferencesRelations,
  contentVocabularyRelations,
  searchHistoryRelations,
} from './discovery';
