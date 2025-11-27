import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import { createRequestHelpers, generators } from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Discovery API', () => {
  describe('GET /api/v1/discovery/search', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/discovery/search', { auth: false });
      expect(status).toBe(401);
    });

    it('should return search results', async () => {
      const { status, json } = await api.get('/api/v1/discovery/search');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta.pagination).toBeDefined();
      expect(json.meta.pagination.total).toBeDefined();
      expect(json.meta.pagination.limit).toBeDefined();
      expect(json.meta.pagination.offset).toBeDefined();
      expect(json.meta.pagination.hasMore).toBeDefined();
    });

    it('should support query parameter', async () => {
      const { status, json } = await api.get('/api/v1/discovery/search?q=test');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should support HSK level filters', async () => {
      const { status, json } = await api.get('/api/v1/discovery/search?hskMin=1&hskMax=3');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should support type filter', async () => {
      const { status, json } = await api.get('/api/v1/discovery/search?type=show');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should support comprehensibility filter', async () => {
      const { status, json } = await api.get('/api/v1/discovery/search?comprehensibilityMin=70');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should support pagination', async () => {
      const { status, json } = await api.get('/api/v1/discovery/search?limit=5&offset=0');

      expect(status).toBe(200);
      expect(json.meta.pagination.limit).toBe(5);
      expect(json.meta.pagination.offset).toBe(0);
    });

    it('should validate HSK level range', async () => {
      const { status } = await api.get('/api/v1/discovery/search?hskMin=0');
      expect(status).toBe(400);
    });

    it('should cap limit at 50', async () => {
      const { status, json } = await api.get('/api/v1/discovery/search?limit=100');

      expect(status).toBe(200);
      // Schema default should cap at 50
      expect(json.meta.pagination.limit).toBeLessThanOrEqual(50);
    });
  });

  describe('GET /api/v1/discovery/recommendations', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/discovery/recommendations', { auth: false });
      expect(status).toBe(401);
    });

    it('should return personalized recommendations', async () => {
      const { status, json } = await api.get('/api/v1/discovery/recommendations');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should support limit parameter', async () => {
      const { status, json } = await api.get('/api/v1/discovery/recommendations?limit=5');

      expect(status).toBe(200);
      expect(json.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/discovery/topics', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/discovery/topics', { auth: false });
      expect(status).toBe(401);
    });

    it('should return topics list', async () => {
      const { status, json } = await api.get('/api/v1/discovery/topics');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should support parent filter for subtopics', async () => {
      const { status, json } = await api.get('/api/v1/discovery/topics?parent=entertainment');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('GET /api/v1/discovery/topics/:id/content', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/discovery/topics/technology/content', { auth: false });
      expect(status).toBe(401);
    });

    it('should return content for topic', async () => {
      const { status, json } = await api.get('/api/v1/discovery/topics/technology/content');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const { status, json } = await api.get('/api/v1/discovery/topics/technology/content?limit=10&offset=0');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('GET /api/v1/discovery/content/:id', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/discovery/content/${generators.uuid()}`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent content', async () => {
      const { status, json } = await api.get(`/api/v1/discovery/content/${generators.uuid()}`);

      expect(status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  describe('GET /api/v1/discovery/content/:id/comprehensibility', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/discovery/content/${generators.uuid()}/comprehensibility`, { auth: false });
      expect(status).toBe(401);
    });
  });

  describe('POST /api/v1/discovery/content/:id/track', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/discovery/content/${generators.uuid()}/track`, {
        status: 'started',
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should validate status enum', async () => {
      const { status } = await api.post(`/api/v1/discovery/content/${generators.uuid()}/track`, {
        status: 'invalid_status',
      });
      expect(status).toBe(400);
    });

    it('should validate progress range', async () => {
      const { status } = await api.post(`/api/v1/discovery/content/${generators.uuid()}/track`, {
        status: 'in_progress',
        progress: 150, // Max is 100
      });
      expect(status).toBe(400);
    });

    it('should validate rating range', async () => {
      const { status } = await api.post(`/api/v1/discovery/content/${generators.uuid()}/track`, {
        status: 'completed',
        rating: 10, // Max is 5
      });
      expect(status).toBe(400);
    });

    it('should validate difficulty enum', async () => {
      const { status } = await api.post(`/api/v1/discovery/content/${generators.uuid()}/track`, {
        status: 'in_progress',
        difficulty: 'invalid_difficulty',
      });
      expect(status).toBe(400);
    });

    it('should accept valid tracking data', async () => {
      const { status, json } = await api.post(`/api/v1/discovery/content/${generators.uuid()}/track`, {
        status: 'started',
        progress: 10,
        difficulty: 'just_right',
      });

      // May return 404 if content doesn't exist, which is expected
      expect([200, 404]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
      }
    });
  });

  describe('GET /api/v1/discovery/in-progress', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/discovery/in-progress', { auth: false });
      expect(status).toBe(401);
    });

    it('should return in-progress content', async () => {
      const { status, json } = await api.get('/api/v1/discovery/in-progress');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should support limit parameter', async () => {
      const { status, json } = await api.get('/api/v1/discovery/in-progress?limit=5');

      expect(status).toBe(200);
      expect(json.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/discovery/completed', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/discovery/completed', { auth: false });
      expect(status).toBe(401);
    });

    it('should return completed content with pagination', async () => {
      const { status, json } = await api.get('/api/v1/discovery/completed');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta.pagination).toBeDefined();
      expect(json.meta.pagination.total).toBeDefined();
      expect(json.meta.pagination.hasMore).toBeDefined();
    });

    it('should support pagination parameters', async () => {
      const { status, json } = await api.get('/api/v1/discovery/completed?limit=10&offset=0');

      expect(status).toBe(200);
      expect(json.meta.pagination.limit).toBe(10);
      expect(json.meta.pagination.offset).toBe(0);
    });
  });

  describe('GET /api/v1/discovery/featured', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/discovery/featured', { auth: false });
      expect(status).toBe(401);
    });

    it('should return featured content', async () => {
      const { status, json } = await api.get('/api/v1/discovery/featured');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should support limit parameter', async () => {
      const { status, json } = await api.get('/api/v1/discovery/featured?limit=5');

      expect(status).toBe(200);
      expect(json.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/discovery/types', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/discovery/types', { auth: false });
      expect(status).toBe(401);
    });

    it('should return available content types', async () => {
      const { status, json } = await api.get('/api/v1/discovery/types');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      // Check structure of content types
      if (json.data.length > 0) {
        expect(json.data[0].id).toBeDefined();
        expect(json.data[0].name).toBeDefined();
        expect(json.data[0].icon).toBeDefined();
      }

      // Should include expected types
      const typeIds = json.data.map((t: { id: string }) => t.id);
      expect(typeIds).toContain('show');
      expect(typeIds).toContain('movie');
      expect(typeIds).toContain('book');
      expect(typeIds).toContain('article');
      expect(typeIds).toContain('podcast');
      expect(typeIds).toContain('course');
    });
  });
});
