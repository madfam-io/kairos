/**
 * API Keys Service
 *
 * Manages API key creation, validation, and revocation.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import { db, apiKeys, users } from '../../db';
import { type ApiScope, type ApiKeyInfo, hashToken, generateApiKey, getKeyPrefix } from './types';

// =============================================================================
// Create API Key
// =============================================================================

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

// =============================================================================
// Validate API Key
// =============================================================================

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

// =============================================================================
// Get User API Keys
// =============================================================================

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

// =============================================================================
// Revoke API Key
// =============================================================================

export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  const [revoked] = await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning();

  return !!revoked;
}
