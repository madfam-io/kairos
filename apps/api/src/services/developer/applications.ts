/**
 * API Applications Service
 *
 * Manages OAuth client applications (create, update, delete, credentials).
 */

import { eq, and, desc } from 'drizzle-orm';
import { db, apiApplications } from '../../db';
import {
  type ApiScope,
  ALL_SCOPES,
  hashToken,
  generateClientId,
  generateClientSecret,
} from './types';

// =============================================================================
// Create Application
// =============================================================================

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

// =============================================================================
// Get Applications
// =============================================================================

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

export async function getApplicationById(
  appId: string
): Promise<typeof apiApplications.$inferSelect | null> {
  const [app] = await db
    .select()
    .from(apiApplications)
    .where(eq(apiApplications.id, appId))
    .limit(1);

  return app ?? null;
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

// =============================================================================
// Verify Credentials
// =============================================================================

export async function verifyClientCredentials(
  clientId: string,
  clientSecret: string
): Promise<typeof apiApplications.$inferSelect | null> {
  const app = await getApplicationByClientId(clientId);

  if (!app) return null;

  if (app.clientSecretHash !== hashToken(clientSecret)) return null;

  return app;
}

// =============================================================================
// Update Application
// =============================================================================

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

// =============================================================================
// Rotate Secret
// =============================================================================

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

// =============================================================================
// Delete Application
// =============================================================================

export async function deleteApplication(appId: string, ownerId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(apiApplications)
    .where(and(eq(apiApplications.id, appId), eq(apiApplications.ownerId, ownerId)))
    .returning();

  return !!deleted;
}
