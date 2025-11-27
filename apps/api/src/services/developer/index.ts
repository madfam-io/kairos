/**
 * Developer API Services
 *
 * Barrel export for all developer-related services:
 * - API Applications (OAuth clients)
 * - API Keys
 * - OAuth2 authorization flow
 * - Webhooks
 * - Usage logging
 * - External integrations
 */

// Types
export * from './types';

// Applications (OAuth clients)
export {
  createApplication,
  getApplicationByClientId,
  getApplicationById,
  getUserApplications,
  verifyClientCredentials,
  updateApplication,
  rotateClientSecret,
  deleteApplication,
} from './applications';

// API Keys
export {
  createApiKey,
  validateApiKey,
  getUserApiKeys,
  revokeApiKey,
} from './api-keys';

// OAuth2
export {
  createAuthorizationCode,
  exchangeAuthorizationCode,
  refreshAccessToken,
  validateAccessToken,
  revokeOAuthToken,
  getUserAuthorizedApps,
  revokeAppAccess,
} from './oauth';

// Webhooks
export {
  createWebhook,
  getUserWebhooks,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  getWebhooksForEvent,
  createWebhookDelivery,
  updateDeliveryStatus,
  getWebhookDeliveries,
  dispatchWebhookEvent,
} from './webhooks';

// Usage
export {
  logApiUsage,
  getApiUsageStats,
} from './usage';

// External Integrations
export {
  connectExternalIntegration,
  getUserIntegrations,
  getIntegration,
  updateIntegrationSyncStatus,
  disconnectIntegration,
} from './integrations';
