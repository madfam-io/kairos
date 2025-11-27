/**
 * Developer API Types
 *
 * Shared types for API applications, OAuth, webhooks, and integrations.
 */

import { createHash, randomBytes, createHmac } from 'crypto';

// =============================================================================
// API Scopes
// =============================================================================

export type ApiScope =
  | 'read:vocabulary'
  | 'write:vocabulary'
  | 'read:cards'
  | 'write:cards'
  | 'read:progress'
  | 'read:profile'
  | 'write:profile';

export const ALL_SCOPES: ApiScope[] = [
  'read:vocabulary',
  'write:vocabulary',
  'read:cards',
  'write:cards',
  'read:progress',
  'read:profile',
  'write:profile',
];

// =============================================================================
// Webhook Events
// =============================================================================

export type WebhookEvent =
  | 'vocabulary.created'
  | 'vocabulary.updated'
  | 'vocabulary.deleted'
  | 'card.created'
  | 'card.exported'
  | 'milestone.achieved'
  | 'streak.updated'
  | 'review.completed';

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

// =============================================================================
// External Providers
// =============================================================================

export type ExternalProvider = 'notion' | 'readwise' | 'obsidian' | 'anki_connect';

// =============================================================================
// API Key Info
// =============================================================================

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

// =============================================================================
// OAuth Token Info
// =============================================================================

export interface OAuthTokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: 'Bearer';
  scopes: ApiScope[];
}

// =============================================================================
// Token/Key Generation Helpers
// =============================================================================

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateClientId(): string {
  return `kairos_${randomBytes(16).toString('hex')}`;
}

export function generateClientSecret(): string {
  return `sk_${randomBytes(32).toString('hex')}`;
}

export function generateApiKey(): string {
  return `krs_${randomBytes(32).toString('hex')}`;
}

export function generateToken(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('hex')}`;
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 12);
}

export function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

// =============================================================================
// Webhook Signature Helpers
// =============================================================================

export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signWebhookPayload(payload, secret);
  return signature === `sha256=${expected}`;
}
