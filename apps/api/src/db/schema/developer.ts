/**
 * Developer Schema - API Applications, Keys, OAuth, Webhooks
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

// Relations
export const apiApplicationsRelations = relations(apiApplications, ({ one, many }) => ({
  owner: one(users, {
    fields: [apiApplications.ownerId],
    references: [users.id],
  }),
  apiKeys: many(apiKeys),
  oauthTokens: many(oauthTokens),
  webhooks: many(webhookEndpoints),
}));

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

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.endpointId],
    references: [webhookEndpoints.id],
  }),
}));
