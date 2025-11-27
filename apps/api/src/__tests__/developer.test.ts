import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import {
  createRequestHelpers,
  testUser,
  generators,
} from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Developer Portal API', () => {
  // ============================================================================
  // APPLICATIONS (OAuth Clients)
  // ============================================================================

  describe('GET /api/v1/developer/applications', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/developer/applications', { auth: false });
      expect(status).toBe(401);
    });

    it('should return applications list', async () => {
      const { status, json } = await api.get('/api/v1/developer/applications');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('POST /api/v1/developer/applications', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/developer/applications', {
        name: 'Test App',
        redirectUris: ['https://example.com/callback'],
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require name field', async () => {
      const { status } = await api.post('/api/v1/developer/applications', {
        redirectUris: ['https://example.com/callback'],
      });

      expect(status).toBe(400);
    });

    it('should require redirectUris field', async () => {
      const { status } = await api.post('/api/v1/developer/applications', {
        name: 'Test App',
      });

      expect(status).toBe(400);
    });

    it('should require at least one redirect URI', async () => {
      const { status } = await api.post('/api/v1/developer/applications', {
        name: 'Test App',
        redirectUris: [],
      });

      expect(status).toBe(400);
    });

    it('should validate name length (min 2, max 100)', async () => {
      const { status: status1 } = await api.post('/api/v1/developer/applications', {
        name: 'a',
        redirectUris: ['https://example.com/callback'],
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/developer/applications', {
        name: 'a'.repeat(101),
        redirectUris: ['https://example.com/callback'],
      });
      expect(status2).toBe(400);
    });

    it('should validate description length (max 500)', async () => {
      const { status } = await api.post('/api/v1/developer/applications', {
        name: 'Test App',
        description: 'a'.repeat(501),
        redirectUris: ['https://example.com/callback'],
      });

      expect(status).toBe(400);
    });

    it('should validate redirect URIs are valid URLs', async () => {
      const { status } = await api.post('/api/v1/developer/applications', {
        name: 'Test App',
        redirectUris: ['not-a-valid-url'],
      });

      expect(status).toBe(400);
    });

    it('should validate websiteUrl is a valid URL', async () => {
      const { status } = await api.post('/api/v1/developer/applications', {
        name: 'Test App',
        websiteUrl: 'not-a-url',
        redirectUris: ['https://example.com/callback'],
      });

      expect(status).toBe(400);
    });

    it('should create application with valid data', async () => {
      const { status, json } = await api.post('/api/v1/developer/applications', {
        name: 'My OAuth App',
        description: 'An app to integrate with Kairos',
        websiteUrl: 'https://myapp.com',
        redirectUris: [
          'https://myapp.com/callback',
          'https://myapp.com/auth/callback',
        ],
        scopes: ['read:vocabulary', 'read:progress'],
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.clientId).toBeDefined();
      expect(json.data.clientSecret).toBeDefined();
      expect(json.warning).toContain('Store the client secret');
    });
  });

  describe('PATCH /api/v1/developer/applications/:appId', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch(`/api/v1/developer/applications/${generators.uuid()}`, {
        name: 'Updated Name',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should return 404 for non-existent application', async () => {
      const { status } = await api.patch(`/api/v1/developer/applications/${generators.uuid()}`, {
        name: 'Updated Name',
      });

      expect(status).toBe(404);
    });

    it('should validate update fields', async () => {
      const { status } = await api.patch(`/api/v1/developer/applications/${generators.uuid()}`, {
        name: 'a', // Too short
      });

      expect(status).toBe(400);
    });
  });

  describe('POST /api/v1/developer/applications/:appId/rotate-secret', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(
        `/api/v1/developer/applications/${generators.uuid()}/rotate-secret`,
        {},
        { auth: false }
      );

      expect(status).toBe(401);
    });

    it('should return 404 for non-existent application', async () => {
      const { status } = await api.post(
        `/api/v1/developer/applications/${generators.uuid()}/rotate-secret`,
        {}
      );

      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/v1/developer/applications/:appId', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete(
        `/api/v1/developer/applications/${generators.uuid()}`,
        { auth: false }
      );

      expect(status).toBe(401);
    });

    it('should return 404 for non-existent application', async () => {
      const { status } = await api.delete(
        `/api/v1/developer/applications/${generators.uuid()}`
      );

      expect(status).toBe(404);
    });
  });

  // ============================================================================
  // API KEYS
  // ============================================================================

  describe('GET /api/v1/developer/api-keys', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/developer/api-keys', { auth: false });
      expect(status).toBe(401);
    });

    it('should return API keys list', async () => {
      const { status, json } = await api.get('/api/v1/developer/api-keys');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('POST /api/v1/developer/api-keys', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/developer/api-keys', {
        name: 'My API Key',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require name field', async () => {
      const { status } = await api.post('/api/v1/developer/api-keys', {});
      expect(status).toBe(400);
    });

    it('should validate name length (min 1, max 100)', async () => {
      const { status: status1 } = await api.post('/api/v1/developer/api-keys', {
        name: '',
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/developer/api-keys', {
        name: 'a'.repeat(101),
      });
      expect(status2).toBe(400);
    });

    it('should validate expiresInDays range (1-365)', async () => {
      const { status: status1 } = await api.post('/api/v1/developer/api-keys', {
        name: 'Test Key',
        expiresInDays: 0,
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/developer/api-keys', {
        name: 'Test Key',
        expiresInDays: 366,
      });
      expect(status2).toBe(400);
    });

    it('should create API key with valid data', async () => {
      const { status, json } = await api.post('/api/v1/developer/api-keys', {
        name: 'Production API Key',
        scopes: ['read:vocabulary'],
        expiresInDays: 90,
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.key).toBeDefined();
      expect(json.warning).toContain('Store the API key');
    });
  });

  describe('DELETE /api/v1/developer/api-keys/:keyId', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete(
        `/api/v1/developer/api-keys/${generators.uuid()}`,
        { auth: false }
      );

      expect(status).toBe(401);
    });

    it('should return 404 for non-existent key', async () => {
      const { status } = await api.delete(`/api/v1/developer/api-keys/${generators.uuid()}`);
      expect(status).toBe(404);
    });
  });

  // ============================================================================
  // AUTHORIZED APPS
  // ============================================================================

  describe('GET /api/v1/developer/authorized-apps', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/developer/authorized-apps', { auth: false });
      expect(status).toBe(401);
    });

    it('should return authorized apps list', async () => {
      const { status, json } = await api.get('/api/v1/developer/authorized-apps');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('DELETE /api/v1/developer/authorized-apps/:appId', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete(
        `/api/v1/developer/authorized-apps/${generators.uuid()}`,
        { auth: false }
      );

      expect(status).toBe(401);
    });

    it('should revoke app access (idempotent)', async () => {
      const { status, json } = await api.delete(
        `/api/v1/developer/authorized-apps/${generators.uuid()}`
      );

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.revoked).toBe(true);
    });
  });

  // ============================================================================
  // WEBHOOKS
  // ============================================================================

  describe('GET /api/v1/developer/webhooks', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/developer/webhooks', { auth: false });
      expect(status).toBe(401);
    });

    it('should return webhooks list', async () => {
      const { status, json } = await api.get('/api/v1/developer/webhooks');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('POST /api/v1/developer/webhooks', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/developer/webhooks', {
        url: 'https://example.com/webhook',
        events: ['vocabulary.created'],
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require url field', async () => {
      const { status } = await api.post('/api/v1/developer/webhooks', {
        events: ['vocabulary.created'],
      });

      expect(status).toBe(400);
    });

    it('should require events array', async () => {
      const { status } = await api.post('/api/v1/developer/webhooks', {
        url: 'https://example.com/webhook',
      });

      expect(status).toBe(400);
    });

    it('should require at least one event', async () => {
      const { status } = await api.post('/api/v1/developer/webhooks', {
        url: 'https://example.com/webhook',
        events: [],
      });

      expect(status).toBe(400);
    });

    it('should validate url is a valid URL', async () => {
      const { status } = await api.post('/api/v1/developer/webhooks', {
        url: 'not-a-url',
        events: ['vocabulary.created'],
      });

      expect(status).toBe(400);
    });

    it('should validate description length (max 200)', async () => {
      const { status } = await api.post('/api/v1/developer/webhooks', {
        url: 'https://example.com/webhook',
        description: 'a'.repeat(201),
        events: ['vocabulary.created'],
      });

      expect(status).toBe(400);
    });

    it('should validate event types', async () => {
      const { status, json } = await api.post('/api/v1/developer/webhooks', {
        url: 'https://example.com/webhook',
        events: ['invalid.event'],
      });

      expect(status).toBe(400);
    });

    it('should create webhook with valid data', async () => {
      const { status, json } = await api.post('/api/v1/developer/webhooks', {
        url: 'https://myapp.com/webhooks/kairos',
        description: 'Sync vocabulary changes',
        events: ['vocabulary.created', 'vocabulary.updated', 'vocabulary.deleted'],
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.secret).toBeDefined();
      expect(json.warning).toContain('Store the webhook secret');
    });
  });

  describe('PATCH /api/v1/developer/webhooks/:webhookId', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch(
        `/api/v1/developer/webhooks/${generators.uuid()}`,
        { isActive: false },
        { auth: false }
      );

      expect(status).toBe(401);
    });

    it('should return 404 for non-existent webhook', async () => {
      const { status } = await api.patch(`/api/v1/developer/webhooks/${generators.uuid()}`, {
        isActive: false,
      });

      expect(status).toBe(404);
    });

    it('should validate url if provided', async () => {
      const { status } = await api.patch(`/api/v1/developer/webhooks/${generators.uuid()}`, {
        url: 'not-a-url',
      });

      expect(status).toBe(400);
    });

    it('should validate events if provided', async () => {
      const { status } = await api.patch(`/api/v1/developer/webhooks/${generators.uuid()}`, {
        events: ['invalid.event'],
      });

      expect(status).toBe(400);
    });
  });

  describe('POST /api/v1/developer/webhooks/:webhookId/rotate-secret', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(
        `/api/v1/developer/webhooks/${generators.uuid()}/rotate-secret`,
        {},
        { auth: false }
      );

      expect(status).toBe(401);
    });

    it('should return 404 for non-existent webhook', async () => {
      const { status } = await api.post(
        `/api/v1/developer/webhooks/${generators.uuid()}/rotate-secret`,
        {}
      );

      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/v1/developer/webhooks/:webhookId', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete(
        `/api/v1/developer/webhooks/${generators.uuid()}`,
        { auth: false }
      );

      expect(status).toBe(401);
    });

    it('should return 404 for non-existent webhook', async () => {
      const { status } = await api.delete(`/api/v1/developer/webhooks/${generators.uuid()}`);
      expect(status).toBe(404);
    });
  });

  describe('GET /api/v1/developer/webhooks/:webhookId/deliveries', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(
        `/api/v1/developer/webhooks/${generators.uuid()}/deliveries`,
        { auth: false }
      );

      expect(status).toBe(401);
    });

    it('should return delivery history', async () => {
      const { status, json } = await api.get(
        `/api/v1/developer/webhooks/${generators.uuid()}/deliveries`
      );

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should support limit parameter', async () => {
      const { status, json } = await api.get(
        `/api/v1/developer/webhooks/${generators.uuid()}/deliveries?limit=10`
      );

      expect(status).toBe(200);
      expect(json.data.length).toBeLessThanOrEqual(10);
    });
  });

  // ============================================================================
  // EXTERNAL INTEGRATIONS
  // ============================================================================

  describe('GET /api/v1/developer/integrations', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/developer/integrations', { auth: false });
      expect(status).toBe(401);
    });

    it('should return integrations list', async () => {
      const { status, json } = await api.get('/api/v1/developer/integrations');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('DELETE /api/v1/developer/integrations/:provider', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete('/api/v1/developer/integrations/anki', { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent integration', async () => {
      const { status } = await api.delete('/api/v1/developer/integrations/anki');
      expect(status).toBe(404);
    });
  });

  // ============================================================================
  // API USAGE
  // ============================================================================

  describe('GET /api/v1/developer/usage', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/developer/usage', { auth: false });
      expect(status).toBe(401);
    });

    it('should return usage statistics', async () => {
      const { status, json } = await api.get('/api/v1/developer/usage');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });

    it('should support apiKeyId filter', async () => {
      const { status, json } = await api.get(
        `/api/v1/developer/usage?apiKeyId=${generators.uuid()}`
      );

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should support days parameter', async () => {
      const { status, json } = await api.get('/api/v1/developer/usage?days=7');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  // ============================================================================
  // REFERENCE DATA
  // ============================================================================

  describe('GET /api/v1/developer/scopes', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/developer/scopes', { auth: false });
      expect(status).toBe(401);
    });

    it('should return available scopes', async () => {
      const { status, json } = await api.get('/api/v1/developer/scopes');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      if (json.data.length > 0) {
        const scope = json.data[0];
        expect(scope.scope).toBeDefined();
        expect(scope.access).toBeDefined();
        expect(scope.resource).toBeDefined();
        expect(scope.description).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/developer/webhook-events', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/developer/webhook-events', { auth: false });
      expect(status).toBe(401);
    });

    it('should return available webhook events', async () => {
      const { status, json } = await api.get('/api/v1/developer/webhook-events');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      if (json.data.length > 0) {
        const event = json.data[0];
        expect(event.event).toBeDefined();
        expect(event.description).toBeDefined();
      }
    });
  });
});
