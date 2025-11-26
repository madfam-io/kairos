/**
 * API Integration Service
 * Handles API keys, OAuth, webhooks, and external integrations
 */

import { eq, and, desc, sql, gte, lte, count } from 'drizzle-orm';
import { createHash, randomBytes, createHmac } from 'crypto';
import {
  db,
  apiApplications,
  apiKeys,
  oauthTokens,
  oauthAuthorizationCodes,
  webhookEndpoints,
  webhookDeliveries,
  apiUsageLogs,
  externalIntegrations,
  users,
} from '../db';

// ============================================================================
// TYPES
// ============================================================================

export type ApiScope =
  | 'read:vocabulary'
  | 'write:vocabulary'
  | 'read:cards'
  | 'write:cards'
  | 'read:progress'
  | 'read:profile'
  | 'write:profile';

export type WebhookEvent =
  | 'vocabulary.created'
  | 'vocabulary.updated'
  | 'vocabulary.deleted'
  | 'card.created'
  | 'card.exported'
  | 'milestone.achieved'
  | 'streak.updated'
  | 'review.completed';

export const ALL_SCOPES: ApiScope[] = [
  'read:vocabulary',
  'write:vocabulary',
  'read:cards',
  'write:cards',
  'read:progress',
  'read:profile',
  'write:profile',
];

export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = [
  'vocabulary.created',
  'vocabulary.updated',
  'vocabulary.deleted',
  'card.created',
  'card.exported',
  'milestone.achieved',
  'streak.updated',
  'review.completed',
];

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiScope[];
  userId: string;
  applicationId: string | null;
  lastUsedAt: Date | null;
  requestCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface OAuthTokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scopes: ApiScope[];
}

// ============================================================================
// HELPERS
// ============================================================================

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateClientId(): string {
  return `kairos_${randomBytes(16).toString('hex')}`;
}

function generateClientSecret(): string {
  return `sk_${randomBytes(32).toString('hex')}`;
}

function generateApiKey(): string {
  return `krs_${randomBytes(32).toString('hex')}`;
}

function generateToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('hex')}`;
}

function getKeyPrefix(key: string): string {
  return key.slice(0, 12);
}

export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = signWebhookPayload(payload, secret);
  return signature === `sha256=${expected}`;
}

// ============================================================================
// API APPLICATIONS (OAuth Clients)
// ============================================================================

export async function createApplication(
  ownerId: string,
  input: {
    name: string;
    description?: string;
    websiteUrl?: string;
    redirectUris: string[];
    scopes?: ApiScope[];
  }
): Promise<{ application: typeof apiApplications.$inferSelect; clientSecret: string }> {
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();

  const [app] = await db
    .insert(apiApplications)
    .values({
      ownerId,
      name: input.name,
      description: input.description,
      websiteUrl: input.websiteUrl,
      clientId,
      clientSecretHash: hashToken(clientSecret),
      redirectUris: input.redirectUris,
      scopes: input.scopes ?? ALL_SCOPES,
    })
    .returning();

  return { application: app, clientSecret };
}

export async function getApplicationByClientId(
  clientId: string
): Promise<typeof apiApplications.$inferSelect | null> {
  const [app] = await db
    .select()
    .from(apiApplications)
    .where(and(eq(apiApplications.clientId, clientId), eq(apiApplications.isActive, true)))
    .limit(1);

  return app ?? null;
}

export async function verifyClientCredentials(
  clientId: string,
  clientSecret: string
): Promise<typeof apiApplications.$inferSelect | null> {
  const app = await getApplicationByClientId(clientId);

  if (!app) return null;

  if (app.clientSecretHash !== hashToken(clientSecret)) return null;

  return app;
}

export async function getUserApplications(
  userId: string
): Promise<Array<typeof apiApplications.$inferSelect>> {
  return db
    .select()
    .from(apiApplications)
    .where(eq(apiApplications.ownerId, userId))
    .orderBy(desc(apiApplications.createdAt));
}

export async function updateApplication(
  appId: string,
  ownerId: string,
  updates: Partial<{
    name: string;
    description: string;
    websiteUrl: string;
    logoUrl: string;
    redirectUris: string[];
    scopes: ApiScope[];
  }>
): Promise<typeof apiApplications.$inferSelect | null> {
  const [app] = await db
    .update(apiApplications)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(apiApplications.id, appId), eq(apiApplications.ownerId, ownerId)))
    .returning();

  return app ?? null;
}

export async function rotateClientSecret(
  appId: string,
  ownerId: string
): Promise<{ clientSecret: string } | null> {
  const clientSecret = generateClientSecret();

  const [app] = await db
    .update(apiApplications)
    .set({ clientSecretHash: hashToken(clientSecret), updatedAt: new Date() })
    .where(and(eq(apiApplications.id, appId), eq(apiApplications.ownerId, ownerId)))
    .returning();

  if (!app) return null;

  return { clientSecret };
}

export async function deleteApplication(appId: string, ownerId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(apiApplications)
    .where(and(eq(apiApplications.id, appId), eq(apiApplications.ownerId, ownerId)))
    .returning();

  return !!deleted;
}

// ============================================================================
// API KEYS
// ============================================================================

export async function createApiKey(
  userId: string,
  input: {
    name: string;
    scopes?: ApiScope[];
    expiresInDays?: number;
    applicationId?: string;
  }
): Promise<{ apiKey: ApiKeyInfo; key: string }> {
  const key = generateApiKey();
  const keyPrefix = getKeyPrefix(key);

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [created] = await db
    .insert(apiKeys)
    .values({
      userId,
      applicationId: input.applicationId,
      name: input.name,
      keyPrefix,
      keyHash: hashToken(key),
      scopes: input.scopes ?? ['read:vocabulary', 'read:cards', 'read:progress'],
      expiresAt,
    })
    .returning();

  return {
    apiKey: {
      id: created.id,
      name: created.name,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes as ApiScope[],
      userId: created.userId,
      applicationId: created.applicationId,
      lastUsedAt: created.lastUsedAt,
      requestCount: created.requestCount,
      expiresAt: created.expiresAt,
      isActive: created.isActive,
      createdAt: created.createdAt,
    },
    key,
  };
}

export async function validateApiKey(
  key: string
): Promise<{ apiKey: typeof apiKeys.$inferSelect; user: typeof users.$inferSelect } | null> {
  const keyPrefix = getKeyPrefix(key);
  const keyHash = hashToken(key);

  const [result] = await db
    .select({
      apiKey: apiKeys,
      user: users,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(
      and(
        eq(apiKeys.keyPrefix, keyPrefix),
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true)
      )
    )
    .limit(1);

  if (!result) return null;

  // Check expiration
  if (result.apiKey.expiresAt && new Date() > result.apiKey.expiresAt) {
    return null;
  }

  // Update last used
  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      requestCount: sql`${apiKeys.requestCount} + 1`,
    })
    .where(eq(apiKeys.id, result.apiKey.id));

  return result;
}

export async function getUserApiKeys(userId: string): Promise<ApiKeyInfo[]> {
  const keys = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)))
    .orderBy(desc(apiKeys.createdAt));

  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes as ApiScope[],
    userId: k.userId,
    applicationId: k.applicationId,
    lastUsedAt: k.lastUsedAt,
    requestCount: k.requestCount,
    expiresAt: k.expiresAt,
    isActive: k.isActive,
    createdAt: k.createdAt,
  }));
}

export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  const [revoked] = await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning();

  return !!revoked;
}

// ============================================================================
// OAUTH2 AUTHORIZATION CODE FLOW
// ============================================================================

export async function createAuthorizationCode(
  applicationId: string,
  userId: string,
  redirectUri: string,
  scopes: ApiScope[],
  pkce?: { codeChallenge: string; codeChallengeMethod: 'S256' | 'plain' }
): Promise<string> {
  const code = generateToken('code');

  await db.insert(oauthAuthorizationCodes).values({
    applicationId,
    userId,
    code,
    redirectUri,
    scopes,
    codeChallenge: pkce?.codeChallenge,
    codeChallengeMethod: pkce?.codeChallengeMethod,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  return code;
}

export async function exchangeAuthorizationCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<OAuthTokenInfo | null> {
  // Verify client
  const app = await verifyClientCredentials(clientId, clientSecret);
  if (!app) return null;

  // Find and validate code
  const [authCode] = await db
    .select()
    .from(oauthAuthorizationCodes)
    .where(
      and(
        eq(oauthAuthorizationCodes.code, code),
        eq(oauthAuthorizationCodes.applicationId, app.id)
      )
    )
    .limit(1);

  if (!authCode) return null;

  // Check expiration
  if (new Date() > authCode.expiresAt) return null;

  // Check if already used
  if (authCode.usedAt) return null;

  // Verify redirect URI
  if (authCode.redirectUri !== redirectUri) return null;

  // Verify PKCE if required
  if (authCode.codeChallenge) {
    if (!codeVerifier) return null;

    let expectedChallenge: string;
    if (authCode.codeChallengeMethod === 'S256') {
      expectedChallenge = createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
    } else {
      expectedChallenge = codeVerifier;
    }

    if (expectedChallenge !== authCode.codeChallenge) return null;
  }

  // Mark code as used
  await db
    .update(oauthAuthorizationCodes)
    .set({ usedAt: new Date() })
    .where(eq(oauthAuthorizationCodes.id, authCode.id));

  // Generate tokens
  const accessToken = generateToken('at');
  const refreshToken = generateToken('rt');

  const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(oauthTokens).values({
    applicationId: app.id,
    userId: authCode.userId,
    accessTokenHash: hashToken(accessToken),
    refreshTokenHash: hashToken(refreshToken),
    scopes: authCode.scopes,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 3600,
    tokenType: 'Bearer',
    scopes: authCode.scopes as ApiScope[],
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<OAuthTokenInfo | null> {
  const app = await verifyClientCredentials(clientId, clientSecret);
  if (!app) return null;

  const refreshTokenHash = hashToken(refreshToken);

  const [token] = await db
    .select()
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.applicationId, app.id),
        eq(oauthTokens.refreshTokenHash, refreshTokenHash),
        eq(oauthTokens.isRevoked, false)
      )
    )
    .limit(1);

  if (!token) return null;

  // Check refresh token expiration
  if (token.refreshTokenExpiresAt && new Date() > token.refreshTokenExpiresAt) {
    return null;
  }

  // Revoke old token
  await db
    .update(oauthTokens)
    .set({ isRevoked: true, revokedAt: new Date() })
    .where(eq(oauthTokens.id, token.id));

  // Generate new tokens
  const newAccessToken = generateToken('at');
  const newRefreshToken = generateToken('rt');

  const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(oauthTokens).values({
    applicationId: app.id,
    userId: token.userId,
    accessTokenHash: hashToken(newAccessToken),
    refreshTokenHash: hashToken(newRefreshToken),
    scopes: token.scopes,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: 3600,
    tokenType: 'Bearer',
    scopes: token.scopes as ApiScope[],
  };
}

export async function validateAccessToken(
  accessToken: string
): Promise<{
  token: typeof oauthTokens.$inferSelect;
  user: typeof users.$inferSelect;
  application: typeof apiApplications.$inferSelect;
} | null> {
  const accessTokenHash = hashToken(accessToken);

  const [result] = await db
    .select({
      token: oauthTokens,
      user: users,
      application: apiApplications,
    })
    .from(oauthTokens)
    .innerJoin(users, eq(oauthTokens.userId, users.id))
    .innerJoin(apiApplications, eq(oauthTokens.applicationId, apiApplications.id))
    .where(
      and(eq(oauthTokens.accessTokenHash, accessTokenHash), eq(oauthTokens.isRevoked, false))
    )
    .limit(1);

  if (!result) return null;

  // Check expiration
  if (new Date() > result.token.accessTokenExpiresAt) {
    return null;
  }

  return result;
}

export async function revokeOAuthToken(tokenId: string, userId: string): Promise<boolean> {
  const [revoked] = await db
    .update(oauthTokens)
    .set({ isRevoked: true, revokedAt: new Date() })
    .where(and(eq(oauthTokens.id, tokenId), eq(oauthTokens.userId, userId)))
    .returning();

  return !!revoked;
}

export async function getUserAuthorizedApps(
  userId: string
): Promise<Array<{ application: typeof apiApplications.$inferSelect; scopes: ApiScope[]; grantedAt: Date }>> {
  const tokens = await db
    .select({
      application: apiApplications,
      scopes: oauthTokens.scopes,
      grantedAt: oauthTokens.createdAt,
    })
    .from(oauthTokens)
    .innerJoin(apiApplications, eq(oauthTokens.applicationId, apiApplications.id))
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.isRevoked, false)))
    .orderBy(desc(oauthTokens.createdAt));

  // Dedupe by app (keep latest)
  const appMap = new Map<string, (typeof tokens)[0]>();
  for (const t of tokens) {
    if (!appMap.has(t.application.id)) {
      appMap.set(t.application.id, t);
    }
  }

  return Array.from(appMap.values()).map((t) => ({
    application: t.application,
    scopes: t.scopes as ApiScope[],
    grantedAt: t.grantedAt,
  }));
}

export async function revokeAppAccess(appId: string, userId: string): Promise<boolean> {
  await db
    .update(oauthTokens)
    .set({ isRevoked: true, revokedAt: new Date() })
    .where(and(eq(oauthTokens.applicationId, appId), eq(oauthTokens.userId, userId)));

  return true;
}

// ============================================================================
// WEBHOOKS
// ============================================================================

export async function createWebhook(
  userId: string,
  input: {
    url: string;
    description?: string;
    events: WebhookEvent[];
    applicationId?: string;
  }
): Promise<{ webhook: typeof webhookEndpoints.$inferSelect; secret: string }> {
  const secret = randomBytes(32).toString('hex');

  const [webhook] = await db
    .insert(webhookEndpoints)
    .values({
      userId,
      applicationId: input.applicationId,
      url: input.url,
      description: input.description,
      events: input.events,
      secret,
    })
    .returning();

  return { webhook, secret };
}

export async function getUserWebhooks(
  userId: string
): Promise<Array<typeof webhookEndpoints.$inferSelect>> {
  return db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.userId, userId))
    .orderBy(desc(webhookEndpoints.createdAt));
}

export async function updateWebhook(
  webhookId: string,
  userId: string,
  updates: Partial<{
    url: string;
    description: string;
    events: WebhookEvent[];
    isActive: boolean;
  }>
): Promise<typeof webhookEndpoints.$inferSelect | null> {
  const [webhook] = await db
    .update(webhookEndpoints)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(webhookEndpoints.id, webhookId), eq(webhookEndpoints.userId, userId)))
    .returning();

  return webhook ?? null;
}

export async function deleteWebhook(webhookId: string, userId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, webhookId), eq(webhookEndpoints.userId, userId)))
    .returning();

  return !!deleted;
}

export async function rotateWebhookSecret(
  webhookId: string,
  userId: string
): Promise<{ secret: string } | null> {
  const secret = randomBytes(32).toString('hex');

  const [webhook] = await db
    .update(webhookEndpoints)
    .set({ secret, updatedAt: new Date() })
    .where(and(eq(webhookEndpoints.id, webhookId), eq(webhookEndpoints.userId, userId)))
    .returning();

  if (!webhook) return null;

  return { secret };
}

export async function getWebhooksForEvent(
  userId: string,
  event: WebhookEvent
): Promise<Array<typeof webhookEndpoints.$inferSelect>> {
  const webhooks = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.userId, userId),
        eq(webhookEndpoints.isActive, true),
        sql`${webhookEndpoints.disabledAt} IS NULL`
      )
    );

  return webhooks.filter((w) => (w.events as WebhookEvent[]).includes(event));
}

export async function createWebhookDelivery(
  endpointId: string,
  eventType: WebhookEvent,
  payload: Record<string, unknown>
): Promise<typeof webhookDeliveries.$inferSelect> {
  const [delivery] = await db
    .insert(webhookDeliveries)
    .values({
      endpointId,
      eventType,
      payload,
      status: 'pending',
    })
    .returning();

  return delivery;
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: 'success' | 'failed',
  details: {
    responseStatus?: number;
    responseBody?: string;
    responseTimeMs?: number;
    errorMessage?: string;
  }
): Promise<void> {
  await db
    .update(webhookDeliveries)
    .set({
      status,
      responseStatus: details.responseStatus,
      responseBody: details.responseBody?.slice(0, 1000),
      responseTimeMs: details.responseTimeMs,
      errorMessage: details.errorMessage,
      completedAt: new Date(),
    })
    .where(eq(webhookDeliveries.id, deliveryId));

  // Update endpoint status
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);

  if (delivery) {
    if (status === 'success') {
      await db
        .update(webhookEndpoints)
        .set({
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: 'success',
          consecutiveFailures: 0,
        })
        .where(eq(webhookEndpoints.id, delivery.endpointId));
    } else {
      // Increment failures
      const [endpoint] = await db
        .select()
        .from(webhookEndpoints)
        .where(eq(webhookEndpoints.id, delivery.endpointId))
        .limit(1);

      if (endpoint) {
        const newFailures = endpoint.consecutiveFailures + 1;
        const shouldDisable = newFailures >= 10;

        await db
          .update(webhookEndpoints)
          .set({
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: 'failed',
            consecutiveFailures: newFailures,
            disabledAt: shouldDisable ? new Date() : null,
          })
          .where(eq(webhookEndpoints.id, delivery.endpointId));
      }
    }
  }
}

export async function getWebhookDeliveries(
  webhookId: string,
  userId: string,
  limit: number = 20
): Promise<Array<typeof webhookDeliveries.$inferSelect>> {
  // Verify ownership
  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, webhookId), eq(webhookEndpoints.userId, userId)))
    .limit(1);

  if (!endpoint) return [];

  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.endpointId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}

// ============================================================================
// API USAGE LOGGING
// ============================================================================

export async function logApiUsage(
  input: {
    apiKeyId?: string;
    applicationId?: string;
    userId?: string;
    method: string;
    path: string;
    statusCode: number;
    responseTimeMs?: number;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }
): Promise<void> {
  await db.insert(apiUsageLogs).values(input);
}

export async function getApiUsageStats(
  userId: string,
  options?: { apiKeyId?: string; days?: number }
): Promise<{
  totalRequests: number;
  requestsByDay: Array<{ date: string; count: number }>;
  requestsByEndpoint: Array<{ path: string; count: number }>;
  errorRate: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - (options?.days ?? 30));

  let whereConditions = and(
    eq(apiUsageLogs.userId, userId),
    gte(apiUsageLogs.createdAt, since)
  );

  if (options?.apiKeyId) {
    whereConditions = and(whereConditions, eq(apiUsageLogs.apiKeyId, options.apiKeyId));
  }

  // Total requests
  const [totalResult] = await db
    .select({ count: count() })
    .from(apiUsageLogs)
    .where(whereConditions);

  // Requests by day
  const dailyStats = await db
    .select({
      date: sql<string>`${apiUsageLogs.createdAt}::date`,
      count: count(),
    })
    .from(apiUsageLogs)
    .where(whereConditions)
    .groupBy(sql`${apiUsageLogs.createdAt}::date`)
    .orderBy(sql`${apiUsageLogs.createdAt}::date`);

  // Requests by endpoint
  const endpointStats = await db
    .select({
      path: apiUsageLogs.path,
      count: count(),
    })
    .from(apiUsageLogs)
    .where(whereConditions)
    .groupBy(apiUsageLogs.path)
    .orderBy(desc(count()))
    .limit(10);

  // Error rate
  const [errorResult] = await db
    .select({ count: count() })
    .from(apiUsageLogs)
    .where(and(whereConditions, gte(apiUsageLogs.statusCode, 400)));

  const totalRequests = totalResult?.count ?? 0;
  const errorCount = errorResult?.count ?? 0;

  return {
    totalRequests,
    requestsByDay: dailyStats.map((d) => ({ date: d.date, count: d.count })),
    requestsByEndpoint: endpointStats.map((e) => ({ path: e.path, count: e.count })),
    errorRate: totalRequests > 0 ? Math.round((errorCount / totalRequests) * 10000) / 100 : 0,
  };
}

// ============================================================================
// EXTERNAL INTEGRATIONS (Notion, Readwise, etc.)
// ============================================================================

export type ExternalProvider = 'notion' | 'readwise' | 'obsidian' | 'anki_connect';

export async function connectExternalIntegration(
  userId: string,
  provider: ExternalProvider,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    externalUserId?: string;
    externalWorkspaceId?: string;
    settings?: Record<string, unknown>;
  }
): Promise<typeof externalIntegrations.$inferSelect> {
  const [integration] = await db
    .insert(externalIntegrations)
    .values({
      userId,
      provider,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.tokenExpiresAt,
      externalUserId: tokens.externalUserId,
      externalWorkspaceId: tokens.externalWorkspaceId,
      settings: tokens.settings ?? {},
    })
    .onConflictDoUpdate({
      target: [externalIntegrations.userId, externalIntegrations.provider],
      set: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.tokenExpiresAt,
        externalUserId: tokens.externalUserId,
        externalWorkspaceId: tokens.externalWorkspaceId,
        settings: tokens.settings ?? {},
        isActive: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  return integration;
}

export async function getUserIntegrations(
  userId: string
): Promise<Array<typeof externalIntegrations.$inferSelect>> {
  return db
    .select()
    .from(externalIntegrations)
    .where(and(eq(externalIntegrations.userId, userId), eq(externalIntegrations.isActive, true)));
}

export async function getIntegration(
  userId: string,
  provider: ExternalProvider
): Promise<typeof externalIntegrations.$inferSelect | null> {
  const [integration] = await db
    .select()
    .from(externalIntegrations)
    .where(
      and(
        eq(externalIntegrations.userId, userId),
        eq(externalIntegrations.provider, provider),
        eq(externalIntegrations.isActive, true)
      )
    )
    .limit(1);

  return integration ?? null;
}

export async function updateIntegrationSyncStatus(
  integrationId: string,
  status: { lastSyncAt: Date; lastSyncStatus: string; lastSyncError?: string }
): Promise<void> {
  await db
    .update(externalIntegrations)
    .set({
      lastSyncAt: status.lastSyncAt,
      lastSyncStatus: status.lastSyncStatus,
      lastSyncError: status.lastSyncError,
      updatedAt: new Date(),
    })
    .where(eq(externalIntegrations.id, integrationId));
}

export async function disconnectIntegration(
  userId: string,
  provider: ExternalProvider
): Promise<boolean> {
  const [updated] = await db
    .update(externalIntegrations)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(externalIntegrations.userId, userId), eq(externalIntegrations.provider, provider))
    )
    .returning();

  return !!updated;
}

// ============================================================================
// WEBHOOK EVENT DISPATCH
// ============================================================================

export async function dispatchWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const webhooks = await getWebhooksForEvent(userId, event);

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  for (const webhook of webhooks) {
    const delivery = await createWebhookDelivery(webhook.id, event, payload);

    // Actually dispatch (would be async/queued in production)
    try {
      const startTime = Date.now();
      const payloadString = JSON.stringify(payload);
      const signature = signWebhookPayload(payloadString, webhook.secret);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kairos-Signature': `sha256=${signature}`,
          'X-Kairos-Event': event,
          'X-Kairos-Delivery-Id': delivery.id,
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const responseTimeMs = Date.now() - startTime;
      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await updateDeliveryStatus(delivery.id, 'success', {
          responseStatus: response.status,
          responseBody,
          responseTimeMs,
        });
      } else {
        await updateDeliveryStatus(delivery.id, 'failed', {
          responseStatus: response.status,
          responseBody,
          responseTimeMs,
          errorMessage: `HTTP ${response.status}`,
        });
      }
    } catch (error) {
      await updateDeliveryStatus(delivery.id, 'failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
