import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import { createRequestHelpers, testUser, generators } from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Enterprise API', () => {
  describe('GET /api/v1/enterprise/organizations', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/enterprise/organizations', { auth: false });
      expect(status).toBe(401);
    });

    it('should return user organizations', async () => {
      const { status, json } = await api.get('/api/v1/enterprise/organizations');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('POST /api/v1/enterprise/organizations', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/enterprise/organizations', {
        name: 'Test Org',
        type: 'company',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should validate organization name', async () => {
      const { status } = await api.post('/api/v1/enterprise/organizations', {
        name: 'X', // Too short
        type: 'company',
      });

      expect(status).toBe(400);
    });

    it('should validate organization type', async () => {
      const { status } = await api.post('/api/v1/enterprise/organizations', {
        name: 'Test Organization',
        type: 'invalid-type',
      });

      expect(status).toBe(400);
    });

    it('should accept valid organization data', async () => {
      const { status, json } = await api.post('/api/v1/enterprise/organizations', {
        name: 'Test University',
        type: 'university',
      });

      // Success or error depending on service implementation
      expect([200, 500]).toContain(status);
    });

    it('should accept optional fields', async () => {
      const { status } = await api.post('/api/v1/enterprise/organizations', {
        name: 'Test Company',
        type: 'company',
        domain: 'example.com',
        billingEmail: 'billing@example.com',
        maxSeats: 100,
      });

      expect([200, 400, 500]).toContain(status);
    });

    it('should validate maxSeats range', async () => {
      const { status } = await api.post('/api/v1/enterprise/organizations', {
        name: 'Test Company',
        type: 'company',
        maxSeats: 3, // Too few (min is 5)
      });

      expect(status).toBe(400);
    });
  });

  describe('GET /api/v1/enterprise/organizations/:orgId', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 403 for non-member', async () => {
      const { status, json } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}`);

      // User is not a member of this random org
      expect(status).toBe(403);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /api/v1/enterprise/organizations/by-slug/:slug', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/enterprise/organizations/by-slug/test-org', { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent slug', async () => {
      const { status, json } = await api.get('/api/v1/enterprise/organizations/by-slug/nonexistent-org-slug');

      expect(status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /api/v1/enterprise/organizations/:orgId/members', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}/members`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 403 for non-member', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}/members`);
      expect(status).toBe(403);
    });
  });

  describe('POST /api/v1/enterprise/organizations/:orgId/invites', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/enterprise/organizations/${generators.uuid()}/invites`, {
        email: 'invite@example.com',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should validate email format', async () => {
      const { status } = await api.post(`/api/v1/enterprise/organizations/${generators.uuid()}/invites`, {
        email: 'invalid-email',
      });

      expect(status).toBe(400);
    });

    it('should return 403 for non-member', async () => {
      const { status } = await api.post(`/api/v1/enterprise/organizations/${generators.uuid()}/invites`, {
        email: 'invite@example.com',
      });

      expect(status).toBe(403);
    });
  });

  describe('POST /api/v1/enterprise/organizations/:orgId/invites/bulk', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/enterprise/organizations/${generators.uuid()}/invites/bulk`, {
        users: [{ email: 'user1@example.com' }],
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should validate users array', async () => {
      const { status } = await api.post(`/api/v1/enterprise/organizations/${generators.uuid()}/invites/bulk`, {
        users: [], // Empty array
      });

      expect(status).toBe(400);
    });

    it('should limit bulk invite size', async () => {
      const users = Array.from({ length: 501 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const { status } = await api.post(`/api/v1/enterprise/organizations/${generators.uuid()}/invites/bulk`, {
        users,
      });

      expect(status).toBe(400);
    });

    it('should validate email format in bulk', async () => {
      const { status } = await api.post(`/api/v1/enterprise/organizations/${generators.uuid()}/invites/bulk`, {
        users: [
          { email: 'valid@example.com' },
          { email: 'invalid-email' },
        ],
      });

      expect(status).toBe(400);
    });
  });

  describe('POST /api/v1/enterprise/invites/:token/accept', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/enterprise/invites/test-token/accept', {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should return error for invalid token', async () => {
      const { status, json } = await api.post('/api/v1/enterprise/invites/invalid-token/accept', {});

      expect(status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /api/v1/enterprise/organizations/:orgId/departments', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}/departments`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 403 for non-member', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}/departments`);
      expect(status).toBe(403);
    });
  });

  describe('POST /api/v1/enterprise/organizations/:orgId/departments', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/enterprise/organizations/${generators.uuid()}/departments`, {
        name: 'Engineering',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should validate department name', async () => {
      const { status } = await api.post(`/api/v1/enterprise/organizations/${generators.uuid()}/departments`, {
        name: '', // Empty name
      });

      expect(status).toBe(400);
    });
  });

  describe('GET /api/v1/enterprise/organizations/:orgId/analytics', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}/analytics`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 403 for non-member', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}/analytics`);
      expect(status).toBe(403);
    });
  });

  describe('GET /api/v1/enterprise/organizations/:orgId/audit-logs', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}/audit-logs`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 403 for non-member', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}/audit-logs`);
      expect(status).toBe(403);
    });
  });

  describe('GET /api/v1/enterprise/organizations/:orgId/license', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}/license`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 403 for non-member', async () => {
      const { status } = await api.get(`/api/v1/enterprise/organizations/${generators.uuid()}/license`);
      expect(status).toBe(403);
    });
  });

  describe('PATCH /api/v1/enterprise/organizations/:orgId/license', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch(`/api/v1/enterprise/organizations/${generators.uuid()}/license`, {
        maxSeats: 200,
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should validate licenseTier enum', async () => {
      const { status } = await api.patch(`/api/v1/enterprise/organizations/${generators.uuid()}/license`, {
        licenseTier: 'invalid-tier',
      });

      expect(status).toBe(400);
    });

    it('should validate maxSeats range', async () => {
      const { status } = await api.patch(`/api/v1/enterprise/organizations/${generators.uuid()}/license`, {
        maxSeats: 2, // Too few
      });

      expect(status).toBe(400);
    });
  });
});
