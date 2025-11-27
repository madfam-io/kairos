/**
 * Integrations Schema - External Service Integrations
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './core';

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

// Relations
export const externalIntegrationsRelations = relations(externalIntegrations, ({ one }) => ({
  user: one(users, {
    fields: [externalIntegrations.userId],
    references: [users.id],
  }),
}));
