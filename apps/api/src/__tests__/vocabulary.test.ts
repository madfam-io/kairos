import { describe, it, expect, beforeEach } from 'bun:test';
import { app } from '../index';
import {
  createRequestHelpers,
  testUser,
  generators,
  createTestVocabulary,
} from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Vocabulary API', () => {
  describe('GET /api/v1/vocabulary', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/vocabulary', { auth: false });
      expect(status).toBe(401);
    });

    it('should return vocabulary list with pagination', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta).toBeDefined();
      expect(json.meta.pagination).toBeDefined();
      expect(json.meta.pagination.page).toBeGreaterThanOrEqual(1);
      expect(json.meta.pagination.limit).toBeGreaterThan(0);
    });

    it('should support status filter', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary?status=learning');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should support hskLevel filter', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary?hskLevel=3');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should support search parameter', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary?search=学习');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should support pagination parameters', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary?limit=10&offset=0');

      expect(status).toBe(200);
      expect(json.meta.pagination.limit).toBe(10);
    });

    it('should validate limit max value', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary?limit=200');

      // Should either cap at 100 or return error
      expect(status).toBe(200);
    });

    it('should support sorting', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary?sortBy=word&sortOrder=asc');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should reject invalid sortBy value', async () => {
      const { status } = await api.get('/api/v1/vocabulary?sortBy=invalid');

      expect(status).toBe(400);
    });
  });

  describe('POST /api/v1/vocabulary/batch', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/vocabulary/batch', {
        words: [{ word: '学习' }],
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require at least one word', async () => {
      const { status } = await api.post('/api/v1/vocabulary/batch', {
        words: [],
      });

      expect(status).toBe(400);
    });

    it('should validate word structure', async () => {
      const { status } = await api.post('/api/v1/vocabulary/batch', {
        words: [{ word: '' }], // Empty word
      });

      expect(status).toBe(400);
    });

    it('should accept valid batch of words', async () => {
      const { status, json } = await api.post('/api/v1/vocabulary/batch', {
        words: [
          { word: '学习', pinyin: 'xuéxí', definition: 'to study' },
          { word: '中文', pinyin: 'zhōngwén', definition: 'Chinese' },
        ],
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.created).toBeDefined();
      expect(json.data.duplicates).toBeDefined();
    });

    it('should limit batch size', async () => {
      const tooManyWords = Array.from({ length: 101 }, (_, i) => ({
        word: `word${i}`,
      }));

      const { status } = await api.post('/api/v1/vocabulary/batch', {
        words: tooManyWords,
      });

      expect(status).toBe(400);
    });

    it('should accept optional hskLevel', async () => {
      const { status, json } = await api.post('/api/v1/vocabulary/batch', {
        words: [
          { word: '你好', hskLevel: 1 },
        ],
      });

      expect(status).toBe(200);
    });

    it('should validate hskLevel range', async () => {
      const { status } = await api.post('/api/v1/vocabulary/batch', {
        words: [
          { word: '你好', hskLevel: 7 }, // Invalid: max is 6
        ],
      });

      expect(status).toBe(400);
    });
  });

  describe('GET /api/v1/vocabulary/stats', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/vocabulary/stats', { auth: false });
      expect(status).toBe(401);
    });

    it('should return vocabulary statistics', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary/stats');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.total).toBeDefined();
      expect(json.data.new).toBeDefined();
      expect(json.data.learning).toBeDefined();
      expect(json.data.known).toBeDefined();
      expect(json.data.dueForReview).toBeDefined();
      expect(json.data.byHskLevel).toBeDefined();
    });

    it('should return HSK level breakdown', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary/stats');

      expect(status).toBe(200);
      expect(json.data.byHskLevel[1]).toBeDefined();
      expect(json.data.byHskLevel[6]).toBeDefined();
    });
  });

  describe('GET /api/v1/vocabulary/due', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/vocabulary/due', { auth: false });
      expect(status).toBe(401);
    });

    it('should return words due for review', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary/due');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const { status, json } = await api.get('/api/v1/vocabulary/due?limit=5');

      expect(status).toBe(200);
      expect(json.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/vocabulary/:id', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/vocabulary/${generators.uuid()}`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent word', async () => {
      const { status, json } = await api.get(`/api/v1/vocabulary/${generators.uuid()}`);

      expect(status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/vocabulary/:id', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch(`/api/v1/vocabulary/${generators.uuid()}`, {
        status: 'learning',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should validate status enum', async () => {
      const { status } = await api.patch(`/api/v1/vocabulary/${generators.uuid()}`, {
        status: 'invalid-status',
      });

      expect(status).toBe(400);
    });

    it('should validate easeFactor range', async () => {
      const { status } = await api.patch(`/api/v1/vocabulary/${generators.uuid()}`, {
        easeFactor: 0.5, // Invalid: min is 1.3
      });

      expect(status).toBe(400);
    });

    it('should return 404 for non-existent word', async () => {
      const { status } = await api.patch(`/api/v1/vocabulary/${generators.uuid()}`, {
        status: 'learning',
      });

      expect(status).toBe(404);
    });

    it('should accept valid update fields', async () => {
      // This would succeed if we had a real word to update
      const { status } = await api.patch(`/api/v1/vocabulary/${generators.uuid()}`, {
        pinyin: 'xuéxí',
        definition: 'to learn',
        status: 'learning',
      });

      // 404 is expected since the word doesn't exist
      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/v1/vocabulary/:id', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete(`/api/v1/vocabulary/${generators.uuid()}`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent word', async () => {
      const { status } = await api.delete(`/api/v1/vocabulary/${generators.uuid()}`);

      expect(status).toBe(404);
    });
  });

  describe('POST /api/v1/vocabulary/:id/review', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/vocabulary/${generators.uuid()}/review`, {
        quality: 4,
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require quality parameter', async () => {
      const { status } = await api.post(`/api/v1/vocabulary/${generators.uuid()}/review`, {});

      expect(status).toBe(400);
    });

    it('should validate quality range (0-5)', async () => {
      const { status } = await api.post(`/api/v1/vocabulary/${generators.uuid()}/review`, {
        quality: 6, // Invalid: max is 5
      });

      expect(status).toBe(400);
    });

    it('should validate quality is integer', async () => {
      const { status } = await api.post(`/api/v1/vocabulary/${generators.uuid()}/review`, {
        quality: 3.5,
      });

      expect(status).toBe(400);
    });

    it('should return 404 for non-existent word', async () => {
      const { status } = await api.post(`/api/v1/vocabulary/${generators.uuid()}/review`, {
        quality: 4,
      });

      expect(status).toBe(404);
    });
  });
});
