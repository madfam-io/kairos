/**
 * External Integrations Service
 *
 * Manages connections to external services (Notion, Readwise, etc.).
 */

import { eq, and } from 'drizzle-orm';
import { db, externalIntegrations } from '../../db';
import { type ExternalProvider } from './types';

// Re-export for convenience
export type { ExternalProvider } from './types';

// =============================================================================
// Connect Integration
// =============================================================================

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

// =============================================================================
// Get User Integrations
// =============================================================================

export async function getUserIntegrations(
  userId: string
): Promise<Array<typeof externalIntegrations.$inferSelect>> {
  return db
    .select()
    .from(externalIntegrations)
    .where(and(eq(externalIntegrations.userId, userId), eq(externalIntegrations.isActive, true)));
}

// =============================================================================
// Get Single Integration
// =============================================================================

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

// =============================================================================
// Update Sync Status
// =============================================================================

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

// =============================================================================
// Disconnect Integration
// =============================================================================

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
