/**
 * Database Schema
 *
 * This file re-exports all schema definitions from the modular schema directory.
 * The schema has been split into domain-specific modules for better maintainability:
 *
 * - schema/core.ts: Users, vocabulary, cards, sync, stats
 * - schema/content.ts: Simplification cache, show simplifications, grammar patterns
 * - schema/community.ts: Shared decks, likes, downloads, referrals
 * - schema/education.ts: Classrooms, students, assignments, progress
 * - schema/analytics.ts: Events, daily stats, sessions, mastery, goals, insights
 * - schema/enterprise.ts: Organizations, members, departments, SSO, audit logs
 * - schema/developer.ts: API applications, keys, OAuth, webhooks
 * - schema/lti.ts: LTI platforms and launches
 * - schema/integrations.ts: External service integrations
 *
 * @see docs/ARCHITECTURE.md for schema documentation
 */

export * from './schema/index';
