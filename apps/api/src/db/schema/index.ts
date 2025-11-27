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
