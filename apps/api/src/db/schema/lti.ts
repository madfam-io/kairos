/**
 * LTI Schema - Learning Tools Interoperability for LMS Integration
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './core';
import { organizations } from './enterprise';

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

// Relations
export const ltiPlatformsRelations = relations(ltiPlatforms, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [ltiPlatforms.organizationId],
    references: [organizations.id],
  }),
  launches: many(ltiLaunches),
}));

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
