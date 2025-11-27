/**
 * OAuth2 Service
 *
 * Implements OAuth2 authorization code flow with PKCE support.
 */

import { eq, and, desc } from 'drizzle-orm';
import { createHash } from 'crypto';
import {
  db,
  oauthTokens,
  oauthAuthorizationCodes,
  apiApplications,
  users,
} from '../../db';
import {
  type ApiScope,
  type OAuthTokenInfo,
  hashToken,
  generateToken,
} from './types';
import { verifyClientCredentials } from './applications';

// =============================================================================
// Authorization Code
// =============================================================================

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

// =============================================================================
// Exchange Authorization Code
// =============================================================================

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

// =============================================================================
// Refresh Access Token
// =============================================================================

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

// =============================================================================
// Validate Access Token
// =============================================================================

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

// =============================================================================
// Revoke Token
// =============================================================================

export async function revokeOAuthToken(tokenId: string, userId: string): Promise<boolean> {
  const [revoked] = await db
    .update(oauthTokens)
    .set({ isRevoked: true, revokedAt: new Date() })
    .where(and(eq(oauthTokens.id, tokenId), eq(oauthTokens.userId, userId)))
    .returning();

  return !!revoked;
}

// =============================================================================
// User Authorized Apps
// =============================================================================

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

// =============================================================================
// Revoke App Access
// =============================================================================

export async function revokeAppAccess(appId: string, userId: string): Promise<boolean> {
  await db
    .update(oauthTokens)
    .set({ isRevoked: true, revokedAt: new Date() })
    .where(and(eq(oauthTokens.applicationId, appId), eq(oauthTokens.userId, userId)));

  return true;
}
