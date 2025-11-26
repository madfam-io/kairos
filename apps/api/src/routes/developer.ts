/**
 * Developer Portal Routes
 * API key management, OAuth applications, webhooks, integrations
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import {
  // Applications
  createApplication,
  getUserApplications,
  updateApplication,
  rotateClientSecret,
  deleteApplication,
  // API Keys
  createApiKey,
  getUserApiKeys,
  revokeApiKey,
  // OAuth
  getUserAuthorizedApps,
  revokeAppAccess,
  // Webhooks
  createWebhook,
  getUserWebhooks,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  getWebhookDeliveries,
  // External integrations
  getUserIntegrations,
  disconnectIntegration,
  // Usage
  getApiUsageStats,
  // Constants
  ALL_SCOPES,
  ALL_WEBHOOK_EVENTS,
  type ApiScope,
  type WebhookEvent,
  type ExternalProvider,
} from '../services/api-integration';

export const developerRoutes = new Hono<AppEnv>();

// Require auth for all routes
developerRoutes.use('*', requireAuth());

// Schemas
const createAppSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional(),
  redirectUris: z.array(z.string().url()).min(1),
  scopes: z.array(z.string()).optional(),
});

const updateAppSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  websiteUrl: z.string().url().optional(),
  logoUrl: z.string().url().optional(),
  redirectUris: z.array(z.string().url()).optional(),
  scopes: z.array(z.string()).optional(),
});

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
});

const createWebhookSchema = z.object({
  url: z.string().url(),
  description: z.string().max(200).optional(),
  events: z.array(z.string()).min(1),
});

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  description: z.string().max(200).optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// APPLICATIONS (OAuth Clients)
// ============================================================================

/**
 * GET /api/v1/developer/applications
 * List user's registered applications
 */
developerRoutes.get('/applications', async (c) => {
  const user = c.get('user');
  const apps = await getUserApplications(user.id);

  return c.json({
    success: true,
    data: apps.map((app) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      websiteUrl: app.websiteUrl,
      logoUrl: app.logoUrl,
      clientId: app.clientId,
      redirectUris: app.redirectUris,
      scopes: app.scopes,
      rateLimitTier: app.rateLimitTier,
      requestsPerMinute: app.requestsPerMinute,
      requestsPerDay: app.requestsPerDay,
      isVerified: app.isVerified,
      isActive: app.isActive,
      createdAt: app.createdAt,
    })),
  });
});

/**
 * POST /api/v1/developer/applications
 * Create a new OAuth application
 */
developerRoutes.post('/applications', zValidator('json', createAppSchema), async (c) => {
  const user = c.get('user');
  const input = c.req.valid('json');

  const { application, clientSecret } = await createApplication(user.id, {
    ...input,
    scopes: input.scopes as ApiScope[] | undefined,
  });

  return c.json({
    success: true,
    data: {
      id: application.id,
      name: application.name,
      clientId: application.clientId,
      clientSecret, // Only returned on creation
      redirectUris: application.redirectUris,
      scopes: application.scopes,
      createdAt: application.createdAt,
    },
    warning: 'Store the client secret securely. It will not be shown again.',
  });
});

/**
 * PATCH /api/v1/developer/applications/:appId
 * Update application settings
 */
developerRoutes.patch(
  '/applications/:appId',
  zValidator('json', updateAppSchema),
  async (c) => {
    const user = c.get('user');
    const appId = c.req.param('appId');
    const updates = c.req.valid('json');

    const app = await updateApplication(appId, user.id, {
      ...updates,
      scopes: updates.scopes as ApiScope[] | undefined,
    });

    if (!app) {
      throw new AppError('Application not found', 404);
    }

    return c.json({
      success: true,
      data: {
        id: app.id,
        name: app.name,
        description: app.description,
        websiteUrl: app.websiteUrl,
        logoUrl: app.logoUrl,
        redirectUris: app.redirectUris,
        scopes: app.scopes,
        updatedAt: app.updatedAt,
      },
    });
  }
);

/**
 * POST /api/v1/developer/applications/:appId/rotate-secret
 * Rotate client secret
 */
developerRoutes.post('/applications/:appId/rotate-secret', async (c) => {
  const user = c.get('user');
  const appId = c.req.param('appId');

  const result = await rotateClientSecret(appId, user.id);

  if (!result) {
    throw new AppError('Application not found', 404);
  }

  return c.json({
    success: true,
    data: {
      clientSecret: result.clientSecret,
    },
    warning: 'Store the new client secret securely. The old secret is now invalid.',
  });
});

/**
 * DELETE /api/v1/developer/applications/:appId
 * Delete application
 */
developerRoutes.delete('/applications/:appId', async (c) => {
  const user = c.get('user');
  const appId = c.req.param('appId');

  const deleted = await deleteApplication(appId, user.id);

  if (!deleted) {
    throw new AppError('Application not found', 404);
  }

  return c.json({
    success: true,
    data: { deleted: true },
  });
});

// ============================================================================
// API KEYS
// ============================================================================

/**
 * GET /api/v1/developer/api-keys
 * List user's API keys
 */
developerRoutes.get('/api-keys', async (c) => {
  const user = c.get('user');
  const keys = await getUserApiKeys(user.id);

  return c.json({
    success: true,
    data: keys,
  });
});

/**
 * POST /api/v1/developer/api-keys
 * Create a new API key
 */
developerRoutes.post('/api-keys', zValidator('json', createApiKeySchema), async (c) => {
  const user = c.get('user');
  const input = c.req.valid('json');

  const { apiKey, key } = await createApiKey(user.id, {
    ...input,
    scopes: input.scopes as ApiScope[] | undefined,
  });

  return c.json({
    success: true,
    data: {
      ...apiKey,
      key, // Only returned on creation
    },
    warning: 'Store the API key securely. It will not be shown again.',
  });
});

/**
 * DELETE /api/v1/developer/api-keys/:keyId
 * Revoke an API key
 */
developerRoutes.delete('/api-keys/:keyId', async (c) => {
  const user = c.get('user');
  const keyId = c.req.param('keyId');

  const revoked = await revokeApiKey(keyId, user.id);

  if (!revoked) {
    throw new AppError('API key not found', 404);
  }

  return c.json({
    success: true,
    data: { revoked: true },
  });
});

// ============================================================================
// AUTHORIZED APPS (User has granted access to)
// ============================================================================

/**
 * GET /api/v1/developer/authorized-apps
 * List apps the user has authorized
 */
developerRoutes.get('/authorized-apps', async (c) => {
  const user = c.get('user');
  const apps = await getUserAuthorizedApps(user.id);

  return c.json({
    success: true,
    data: apps.map((a) => ({
      id: a.application.id,
      name: a.application.name,
      description: a.application.description,
      websiteUrl: a.application.websiteUrl,
      logoUrl: a.application.logoUrl,
      isVerified: a.application.isVerified,
      scopes: a.scopes,
      grantedAt: a.grantedAt,
    })),
  });
});

/**
 * DELETE /api/v1/developer/authorized-apps/:appId
 * Revoke app access
 */
developerRoutes.delete('/authorized-apps/:appId', async (c) => {
  const user = c.get('user');
  const appId = c.req.param('appId');

  await revokeAppAccess(appId, user.id);

  return c.json({
    success: true,
    data: { revoked: true },
  });
});

// ============================================================================
// WEBHOOKS
// ============================================================================

/**
 * GET /api/v1/developer/webhooks
 * List user's webhooks
 */
developerRoutes.get('/webhooks', async (c) => {
  const user = c.get('user');
  const webhooks = await getUserWebhooks(user.id);

  return c.json({
    success: true,
    data: webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      description: w.description,
      events: w.events,
      isActive: w.isActive,
      lastDeliveryAt: w.lastDeliveryAt,
      lastDeliveryStatus: w.lastDeliveryStatus,
      consecutiveFailures: w.consecutiveFailures,
      disabledAt: w.disabledAt,
      createdAt: w.createdAt,
    })),
  });
});

/**
 * POST /api/v1/developer/webhooks
 * Create a new webhook
 */
developerRoutes.post('/webhooks', zValidator('json', createWebhookSchema), async (c) => {
  const user = c.get('user');
  const input = c.req.valid('json');

  // Validate events
  const invalidEvents = input.events.filter((e) => !ALL_WEBHOOK_EVENTS.includes(e as WebhookEvent));
  if (invalidEvents.length > 0) {
    throw new AppError(`Invalid events: ${invalidEvents.join(', ')}`, 400);
  }

  const { webhook, secret } = await createWebhook(user.id, {
    ...input,
    events: input.events as WebhookEvent[],
  });

  return c.json({
    success: true,
    data: {
      id: webhook.id,
      url: webhook.url,
      description: webhook.description,
      events: webhook.events,
      secret, // Only returned on creation
      createdAt: webhook.createdAt,
    },
    warning: 'Store the webhook secret securely. It will not be shown again.',
  });
});

/**
 * PATCH /api/v1/developer/webhooks/:webhookId
 * Update webhook
 */
developerRoutes.patch(
  '/webhooks/:webhookId',
  zValidator('json', updateWebhookSchema),
  async (c) => {
    const user = c.get('user');
    const webhookId = c.req.param('webhookId');
    const updates = c.req.valid('json');

    // Validate events if provided
    if (updates.events) {
      const invalidEvents = updates.events.filter(
        (e) => !ALL_WEBHOOK_EVENTS.includes(e as WebhookEvent)
      );
      if (invalidEvents.length > 0) {
        throw new AppError(`Invalid events: ${invalidEvents.join(', ')}`, 400);
      }
    }

    const webhook = await updateWebhook(webhookId, user.id, {
      ...updates,
      events: updates.events as WebhookEvent[] | undefined,
    });

    if (!webhook) {
      throw new AppError('Webhook not found', 404);
    }

    return c.json({
      success: true,
      data: {
        id: webhook.id,
        url: webhook.url,
        description: webhook.description,
        events: webhook.events,
        isActive: webhook.isActive,
        updatedAt: webhook.updatedAt,
      },
    });
  }
);

/**
 * POST /api/v1/developer/webhooks/:webhookId/rotate-secret
 * Rotate webhook secret
 */
developerRoutes.post('/webhooks/:webhookId/rotate-secret', async (c) => {
  const user = c.get('user');
  const webhookId = c.req.param('webhookId');

  const result = await rotateWebhookSecret(webhookId, user.id);

  if (!result) {
    throw new AppError('Webhook not found', 404);
  }

  return c.json({
    success: true,
    data: {
      secret: result.secret,
    },
    warning: 'Store the new webhook secret securely. The old secret is now invalid.',
  });
});

/**
 * DELETE /api/v1/developer/webhooks/:webhookId
 * Delete webhook
 */
developerRoutes.delete('/webhooks/:webhookId', async (c) => {
  const user = c.get('user');
  const webhookId = c.req.param('webhookId');

  const deleted = await deleteWebhook(webhookId, user.id);

  if (!deleted) {
    throw new AppError('Webhook not found', 404);
  }

  return c.json({
    success: true,
    data: { deleted: true },
  });
});

/**
 * GET /api/v1/developer/webhooks/:webhookId/deliveries
 * Get webhook delivery history
 */
developerRoutes.get('/webhooks/:webhookId/deliveries', async (c) => {
  const user = c.get('user');
  const webhookId = c.req.param('webhookId');
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const deliveries = await getWebhookDeliveries(webhookId, user.id, Math.min(limit, 100));

  return c.json({
    success: true,
    data: deliveries.map((d) => ({
      id: d.id,
      eventType: d.eventType,
      status: d.status,
      responseStatus: d.responseStatus,
      responseTimeMs: d.responseTimeMs,
      attempts: d.attempts,
      errorMessage: d.errorMessage,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
    })),
  });
});

// ============================================================================
// EXTERNAL INTEGRATIONS
// ============================================================================

/**
 * GET /api/v1/developer/integrations
 * List user's connected integrations
 */
developerRoutes.get('/integrations', async (c) => {
  const user = c.get('user');
  const integrations = await getUserIntegrations(user.id);

  return c.json({
    success: true,
    data: integrations.map((i) => ({
      id: i.id,
      provider: i.provider,
      externalUserId: i.externalUserId,
      externalWorkspaceId: i.externalWorkspaceId,
      syncEnabled: i.syncEnabled,
      lastSyncAt: i.lastSyncAt,
      lastSyncStatus: i.lastSyncStatus,
      lastSyncError: i.lastSyncError,
      createdAt: i.createdAt,
    })),
  });
});

/**
 * DELETE /api/v1/developer/integrations/:provider
 * Disconnect an integration
 */
developerRoutes.delete('/integrations/:provider', async (c) => {
  const user = c.get('user');
  const provider = c.req.param('provider') as ExternalProvider;

  const disconnected = await disconnectIntegration(user.id, provider);

  if (!disconnected) {
    throw new AppError('Integration not found', 404);
  }

  return c.json({
    success: true,
    data: { disconnected: true },
  });
});

// ============================================================================
// API USAGE
// ============================================================================

/**
 * GET /api/v1/developer/usage
 * Get API usage statistics
 */
developerRoutes.get('/usage', async (c) => {
  const user = c.get('user');
  const apiKeyId = c.req.query('apiKeyId');
  const days = parseInt(c.req.query('days') || '30', 10);

  const stats = await getApiUsageStats(user.id, {
    apiKeyId: apiKeyId || undefined,
    days: Math.min(days, 90),
  });

  return c.json({
    success: true,
    data: stats,
  });
});

// ============================================================================
// REFERENCE DATA
// ============================================================================

/**
 * GET /api/v1/developer/scopes
 * List available API scopes
 */
developerRoutes.get('/scopes', async (c) => {
  return c.json({
    success: true,
    data: ALL_SCOPES.map((scope) => {
      const [access, resource] = scope.split(':');
      return {
        scope,
        access,
        resource,
        description: getScopeDescription(scope),
      };
    }),
  });
});

/**
 * GET /api/v1/developer/webhook-events
 * List available webhook events
 */
developerRoutes.get('/webhook-events', async (c) => {
  return c.json({
    success: true,
    data: ALL_WEBHOOK_EVENTS.map((event) => ({
      event,
      description: getEventDescription(event),
    })),
  });
});

// Helper functions
function getScopeDescription(scope: ApiScope): string {
  const descriptions: Record<ApiScope, string> = {
    'read:vocabulary': 'Read vocabulary words and learning status',
    'write:vocabulary': 'Add, update, or delete vocabulary words',
    'read:cards': 'Read mined cards',
    'write:cards': 'Create or modify cards',
    'read:progress': 'Read learning progress and statistics',
    'read:profile': 'Read user profile information',
    'write:profile': 'Update user profile settings',
  };
  return descriptions[scope] || scope;
}

function getEventDescription(event: WebhookEvent): string {
  const descriptions: Record<WebhookEvent, string> = {
    'vocabulary.created': 'New vocabulary word added',
    'vocabulary.updated': 'Vocabulary word updated (status, definition, etc.)',
    'vocabulary.deleted': 'Vocabulary word deleted',
    'card.created': 'New card mined from content',
    'card.exported': 'Card exported to Anki or other SRS',
    'milestone.achieved': 'Learning milestone reached',
    'streak.updated': 'Study streak changed',
    'review.completed': 'Review session completed',
  };
  return descriptions[event] || event;
}
