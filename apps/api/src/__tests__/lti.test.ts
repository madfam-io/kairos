import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import { createRequestHelpers, testUser, generators } from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('LTI API', () => {
  describe('LTI Configuration Endpoints', () => {
    describe('GET /api/v1/lti/config', () => {
      it('should return LTI configuration (public)', async () => {
        const { status, json } = await api.get('/api/v1/lti/config', { auth: false });

        expect(status).toBe(200);
        expect(json.title).toBeDefined();
        expect(json.description).toBeDefined();
        expect(json.oidc_initiation_url).toBeDefined();
        expect(json.target_link_uri).toBeDefined();
        expect(json.scopes).toBeDefined();
        expect(Array.isArray(json.scopes)).toBe(true);
      });

      it('should include required LTI messages', async () => {
        const { status, json } = await api.get('/api/v1/lti/config', { auth: false });

        expect(status).toBe(200);
        expect(Array.isArray(json.messages)).toBe(true);
      });

      it('should include claims configuration', async () => {
        const { status, json } = await api.get('/api/v1/lti/config', { auth: false });

        expect(status).toBe(200);
        expect(json.claims).toBeDefined();
      });
    });

    describe('GET /api/v1/lti/jwks', () => {
      it('should return JWKS (public)', async () => {
        const { status, json } = await api.get('/api/v1/lti/jwks', { auth: false });

        expect(status).toBe(200);
        expect(json.keys).toBeDefined();
        expect(Array.isArray(json.keys)).toBe(true);
      });

      it('should return valid JWK format', async () => {
        const { status, json } = await api.get('/api/v1/lti/jwks', { auth: false });

        expect(status).toBe(200);

        if (json.keys.length > 0) {
          const key = json.keys[0];
          expect(key.kty).toBe('RSA');
          expect(key.alg).toBe('RS256');
          expect(key.use).toBe('sig');
          expect(key.kid).toBeDefined();
        }
      });
    });
  });

  describe('Platform Registration', () => {
    describe('GET /api/v1/lti/platforms', () => {
      it('should require authentication', async () => {
        const { status } = await api.get('/api/v1/lti/platforms', { auth: false });
        expect(status).toBe(401);
      });

      it('should return platforms list', async () => {
        const { status, json } = await api.get('/api/v1/lti/platforms');

        expect(status).toBe(200);
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data)).toBe(true);
      });
    });

    describe('POST /api/v1/lti/platforms', () => {
      it('should require authentication', async () => {
        const { status } = await api.post('/api/v1/lti/platforms', {
          name: 'Test LMS',
          issuer: 'https://lms.example.com',
          clientId: 'client123',
          authorizationUrl: 'https://lms.example.com/auth',
          tokenUrl: 'https://lms.example.com/token',
          keySetUrl: 'https://lms.example.com/.well-known/jwks.json',
        }, { auth: false });

        expect(status).toBe(401);
      });

      it('should validate required fields', async () => {
        const { status } = await api.post('/api/v1/lti/platforms', {
          name: 'Test LMS',
          // Missing required fields
        });

        expect(status).toBe(400);
      });

      it('should validate URL formats', async () => {
        const { status } = await api.post('/api/v1/lti/platforms', {
          name: 'Test LMS',
          issuer: 'not-a-url',
          clientId: 'client123',
          authorizationUrl: 'https://lms.example.com/auth',
          tokenUrl: 'https://lms.example.com/token',
          keySetUrl: 'https://lms.example.com/.well-known/jwks.json',
        });

        expect(status).toBe(400);
      });
    });

    describe('GET /api/v1/lti/platforms/:platformId', () => {
      it('should require authentication', async () => {
        const { status } = await api.get(`/api/v1/lti/platforms/${generators.uuid()}`, { auth: false });
        expect(status).toBe(401);
      });

      it('should return 404 for non-existent platform', async () => {
        const { status } = await api.get(`/api/v1/lti/platforms/${generators.uuid()}`);
        expect(status).toBe(404);
      });
    });
  });

  describe('OIDC Flow', () => {
    describe('GET /api/v1/lti/oidc/init', () => {
      it('should require iss parameter', async () => {
        const { status, json } = await api.get('/api/v1/lti/oidc/init', { auth: false });

        expect(status).toBe(400);
        expect(json.success).toBe(false);
      });

      it('should require login_hint parameter', async () => {
        const { status, json } = await api.get('/api/v1/lti/oidc/init?iss=https://lms.example.com', { auth: false });

        expect(status).toBe(400);
        expect(json.success).toBe(false);
      });

      it('should reject unknown platform', async () => {
        const { status, json } = await api.get(
          '/api/v1/lti/oidc/init?iss=https://unknown-lms.example.com&login_hint=user123&target_link_uri=https://app.kairos.dev/lti/launch',
          { auth: false }
        );

        expect(status).toBe(400);
        expect(json.success).toBe(false);
        expect(json.error).toContain('platform');
      });
    });

    describe('POST /api/v1/lti/launch', () => {
      it('should require id_token', async () => {
        const res = await app.request('/api/v1/lti/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'state=test-state',
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.success).toBe(false);
      });

      it('should require state', async () => {
        const res = await app.request('/api/v1/lti/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'id_token=test-token',
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.success).toBe(false);
      });

      it('should reject invalid state', async () => {
        const res = await app.request('/api/v1/lti/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'id_token=test-token&state=invalid-state',
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.success).toBe(false);
      });
    });
  });

  describe('Deep Linking', () => {
    describe('GET /api/v1/lti/deep-link/content', () => {
      it('should require authentication', async () => {
        const { status } = await api.get('/api/v1/lti/deep-link/content', { auth: false });
        expect(status).toBe(401);
      });

      it('should return available content', async () => {
        const { status, json } = await api.get('/api/v1/lti/deep-link/content');

        expect(status).toBe(200);
        expect(json.success).toBe(true);
        expect(Array.isArray(json.data)).toBe(true);
      });
    });

    describe('POST /api/v1/lti/deep-link/select', () => {
      it('should require authentication', async () => {
        const { status } = await api.post('/api/v1/lti/deep-link/select', {
          contentItemIds: [generators.uuid()],
          returnUrl: 'https://lms.example.com/deep-link/return',
        }, { auth: false });

        expect(status).toBe(401);
      });

      it('should validate returnUrl', async () => {
        const { status } = await api.post('/api/v1/lti/deep-link/select', {
          contentItemIds: [generators.uuid()],
          returnUrl: 'not-a-url',
        });

        expect(status).toBe(400);
      });

      it('should require contentItemIds', async () => {
        const { status } = await api.post('/api/v1/lti/deep-link/select', {
          returnUrl: 'https://lms.example.com/deep-link/return',
        });

        expect(status).toBe(400);
      });
    });
  });

  describe('Grade Services (AGS)', () => {
    describe('POST /api/v1/lti/ags/score', () => {
      it('should require authentication', async () => {
        const { status } = await api.post('/api/v1/lti/ags/score', {
          lineItemId: generators.uuid(),
          userId: 'lti-user-123',
          score: 85,
          maxScore: 100,
        }, { auth: false });

        expect(status).toBe(401);
      });

      it('should validate score range', async () => {
        const { status } = await api.post('/api/v1/lti/ags/score', {
          lineItemId: generators.uuid(),
          userId: 'lti-user-123',
          score: 150, // Greater than maxScore
          maxScore: 100,
        });

        expect(status).toBe(400);
      });
    });

    describe('GET /api/v1/lti/ags/results/:lineItemId', () => {
      it('should require authentication', async () => {
        const { status } = await api.get(`/api/v1/lti/ags/results/${generators.uuid()}`, { auth: false });
        expect(status).toBe(401);
      });
    });
  });

  describe('NRPS (Names and Roles)', () => {
    describe('GET /api/v1/lti/nrps/:contextId/members', () => {
      it('should require authentication', async () => {
        const { status } = await api.get(`/api/v1/lti/nrps/${generators.uuid()}/members`, { auth: false });
        expect(status).toBe(401);
      });

      it('should return 404 for unknown context', async () => {
        const { status } = await api.get(`/api/v1/lti/nrps/${generators.uuid()}/members`);
        expect(status).toBe(404);
      });
    });
  });
});
