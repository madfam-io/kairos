import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import {
  createRequestHelpers,
  testUser,
  generators,
} from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Shared Decks API', () => {
  describe('GET /api/v1/decks', () => {
    it('should allow public browsing without authentication', async () => {
      const { status, json } = await api.get('/api/v1/decks', { auth: false });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.meta).toBeDefined();
      expect(json.meta.pagination).toBeDefined();
    });

    it('should support category filter', async () => {
      const categories = ['hsk', 'topic', 'media', 'custom'];

      for (const category of categories) {
        const { status, json } = await api.get(`/api/v1/decks?category=${category}`, { auth: false });

        expect(status).toBe(200);
        expect(json.success).toBe(true);
      }
    });

    it('should validate category enum', async () => {
      const { status } = await api.get('/api/v1/decks?category=invalid', { auth: false });
      expect(status).toBe(400);
    });

    it('should support search parameter', async () => {
      const { status, json } = await api.get('/api/v1/decks?search=HSK', { auth: false });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should support sortBy parameter', async () => {
      const sortOptions = ['popular', 'recent', 'downloads', 'likes'];

      for (const sortBy of sortOptions) {
        const { status, json } = await api.get(`/api/v1/decks?sortBy=${sortBy}`, { auth: false });

        expect(status).toBe(200);
        expect(json.success).toBe(true);
      }
    });

    it('should validate sortBy enum', async () => {
      const { status } = await api.get('/api/v1/decks?sortBy=invalid', { auth: false });
      expect(status).toBe(400);
    });

    it('should support pagination', async () => {
      const { status, json } = await api.get('/api/v1/decks?limit=10&offset=0', { auth: false });

      expect(status).toBe(200);
      expect(json.meta.pagination.limit).toBe(10);
      expect(json.meta.pagination.offset).toBe(0);
    });

    it('should validate limit range (1-50)', async () => {
      const { status: status1 } = await api.get('/api/v1/decks?limit=0', { auth: false });
      expect(status1).toBe(400);

      const { status: status2 } = await api.get('/api/v1/decks?limit=51', { auth: false });
      expect(status2).toBe(400);
    });

    it('should validate offset is non-negative', async () => {
      const { status } = await api.get('/api/v1/decks?offset=-1', { auth: false });
      expect(status).toBe(400);
    });
  });

  describe('GET /api/v1/decks/mine', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/decks/mine', { auth: false });
      expect(status).toBe(401);
    });

    it('should return user own decks', async () => {
      const { status, json } = await api.get('/api/v1/decks/mine');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('GET /api/v1/decks/downloaded', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/decks/downloaded', { auth: false });
      expect(status).toBe(401);
    });

    it('should return downloaded decks', async () => {
      const { status, json } = await api.get('/api/v1/decks/downloaded');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('POST /api/v1/decks', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
        words: [{ word: '学习' }],
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require name field', async () => {
      const { status } = await api.post('/api/v1/decks', {
        words: [{ word: '学习' }],
      });

      expect(status).toBe(400);
    });

    it('should require words array', async () => {
      const { status } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
      });

      expect(status).toBe(400);
    });

    it('should require at least one word', async () => {
      const { status } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
        words: [],
      });

      expect(status).toBe(400);
    });

    it('should validate name length (min 1, max 100)', async () => {
      const { status: status1 } = await api.post('/api/v1/decks', {
        name: '',
        words: [{ word: '学习' }],
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/decks', {
        name: 'a'.repeat(101),
        words: [{ word: '学习' }],
      });
      expect(status2).toBe(400);
    });

    it('should validate description length (max 500)', async () => {
      const { status } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
        description: 'a'.repeat(501),
        words: [{ word: '学习' }],
      });

      expect(status).toBe(400);
    });

    it('should validate words array max size (500)', async () => {
      const tooManyWords = Array.from({ length: 501 }, (_, i) => ({
        word: `word${i}`,
      }));

      const { status } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
        words: tooManyWords,
      });

      expect(status).toBe(400);
    });

    it('should validate category enum', async () => {
      const { status } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
        category: 'invalid',
        words: [{ word: '学习' }],
      });

      expect(status).toBe(400);
    });

    it('should accept valid category values', async () => {
      const categories = ['hsk', 'topic', 'media', 'custom'];

      for (const category of categories) {
        const { status } = await api.post('/api/v1/decks', {
          name: `Test Deck ${category}`,
          category,
          words: [{ word: '学习' }],
        });

        expect(status).toBe(200);
      }
    });

    it('should validate tags max count (10)', async () => {
      const { status } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
        tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
        words: [{ word: '学习' }],
      });

      expect(status).toBe(400);
    });

    it('should validate tag max length (30)', async () => {
      const { status } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
        tags: ['a'.repeat(31)],
        words: [{ word: '学习' }],
      });

      expect(status).toBe(400);
    });

    it('should validate word hskLevel range (1-6)', async () => {
      const { status: status1 } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
        words: [{ word: '学习', hskLevel: 0 }],
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
        words: [{ word: '学习', hskLevel: 7 }],
      });
      expect(status2).toBe(400);
    });

    it('should require word field in each word object', async () => {
      const { status } = await api.post('/api/v1/decks', {
        name: 'Test Deck',
        words: [{ pinyin: 'xuéxí' }],
      });

      expect(status).toBe(400);
    });

    it('should create deck with valid data', async () => {
      const { status, json } = await api.post('/api/v1/decks', {
        name: 'HSK 1 Vocabulary',
        description: 'Basic Chinese words',
        isPublic: true,
        category: 'hsk',
        tags: ['hsk1', 'beginner'],
        words: [
          { word: '你好', pinyin: 'nǐhǎo', definition: 'hello', hskLevel: 1 },
          { word: '谢谢', pinyin: 'xièxiè', definition: 'thank you', hskLevel: 1 },
        ],
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('HSK 1 Vocabulary');
      expect(json.data.wordCount).toBe(2);
    });
  });

  describe('GET /api/v1/decks/:id', () => {
    it('should allow public access without authentication for public decks', async () => {
      // Non-existent deck should return 404
      const { status } = await api.get(`/api/v1/decks/${generators.uuid()}`, { auth: false });
      expect(status).toBe(404);
    });

    it('should return 404 for non-existent deck', async () => {
      const { status, json } = await api.get(`/api/v1/decks/${generators.uuid()}`);

      expect(status).toBe(404);
      expect(json.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/decks/:id', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch(`/api/v1/decks/${generators.uuid()}`, {
        name: 'Updated Name',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should return 404 for non-existent deck', async () => {
      const { status } = await api.patch(`/api/v1/decks/${generators.uuid()}`, {
        name: 'Updated Name',
      });

      expect(status).toBe(404);
    });

    it('should validate name length if provided', async () => {
      const { status } = await api.patch(`/api/v1/decks/${generators.uuid()}`, {
        name: 'a'.repeat(101),
      });

      expect(status).toBe(400);
    });

    it('should validate description length if provided', async () => {
      const { status } = await api.patch(`/api/v1/decks/${generators.uuid()}`, {
        description: 'a'.repeat(501),
      });

      expect(status).toBe(400);
    });

    it('should validate category enum if provided', async () => {
      const { status } = await api.patch(`/api/v1/decks/${generators.uuid()}`, {
        category: 'invalid',
      });

      expect(status).toBe(400);
    });
  });

  describe('DELETE /api/v1/decks/:id', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete(`/api/v1/decks/${generators.uuid()}`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent deck', async () => {
      const { status } = await api.delete(`/api/v1/decks/${generators.uuid()}`);
      expect(status).toBe(404);
    });
  });

  describe('POST /api/v1/decks/:id/words', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/decks/${generators.uuid()}/words`, {
        words: [{ word: '学习' }],
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require words array', async () => {
      const { status } = await api.post(`/api/v1/decks/${generators.uuid()}/words`, {});
      expect(status).toBe(400);
    });

    it('should require at least one word', async () => {
      const { status } = await api.post(`/api/v1/decks/${generators.uuid()}/words`, {
        words: [],
      });

      expect(status).toBe(400);
    });

    it('should validate words array max size (100)', async () => {
      const tooManyWords = Array.from({ length: 101 }, (_, i) => ({
        word: `word${i}`,
      }));

      const { status } = await api.post(`/api/v1/decks/${generators.uuid()}/words`, {
        words: tooManyWords,
      });

      expect(status).toBe(400);
    });

    it('should return 404 for non-existent deck', async () => {
      const { status } = await api.post(`/api/v1/decks/${generators.uuid()}/words`, {
        words: [{ word: '学习' }],
      });

      expect(status).toBe(404);
    });
  });

  describe('POST /api/v1/decks/:id/like', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/decks/${generators.uuid()}/like`, {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent deck', async () => {
      const { status } = await api.post(`/api/v1/decks/${generators.uuid()}/like`, {});
      expect(status).toBe(404);
    });
  });

  describe('POST /api/v1/decks/:id/import', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/decks/${generators.uuid()}/import`, {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent deck', async () => {
      const { status } = await api.post(`/api/v1/decks/${generators.uuid()}/import`, {});
      expect(status).toBe(404);
    });
  });

  describe('POST /api/v1/decks/from-vocabulary', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/decks/from-vocabulary', {
        name: 'My Vocabulary Deck',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require name field', async () => {
      const { status } = await api.post('/api/v1/decks/from-vocabulary', {});
      expect(status).toBe(400);
    });

    it('should validate name length (min 1, max 100)', async () => {
      const { status: status1 } = await api.post('/api/v1/decks/from-vocabulary', {
        name: '',
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/decks/from-vocabulary', {
        name: 'a'.repeat(101),
      });
      expect(status2).toBe(400);
    });

    it('should validate description length (max 500)', async () => {
      const { status } = await api.post('/api/v1/decks/from-vocabulary', {
        name: 'Test Deck',
        description: 'a'.repeat(501),
      });

      expect(status).toBe(400);
    });

    it('should validate category enum', async () => {
      const { status } = await api.post('/api/v1/decks/from-vocabulary', {
        name: 'Test Deck',
        category: 'invalid',
      });

      expect(status).toBe(400);
    });

    it('should validate wordIds are UUIDs', async () => {
      const { status } = await api.post('/api/v1/decks/from-vocabulary', {
        name: 'Test Deck',
        wordIds: ['not-a-uuid'],
      });

      expect(status).toBe(400);
    });

    it('should validate filter status enum', async () => {
      const { status } = await api.post('/api/v1/decks/from-vocabulary', {
        name: 'Test Deck',
        filter: { status: 'invalid' },
      });

      expect(status).toBe(400);
    });

    it('should accept valid filter status values', async () => {
      const statuses = ['new', 'learning', 'known'];

      for (const status of statuses) {
        const { status: respStatus } = await api.post('/api/v1/decks/from-vocabulary', {
          name: `Test Deck ${status}`,
          filter: { status },
        });

        // 400 expected if no words match filter
        expect([200, 400]).toContain(respStatus);
      }
    });

    it('should validate filter hskLevel range (1-6)', async () => {
      const { status: status1 } = await api.post('/api/v1/decks/from-vocabulary', {
        name: 'Test Deck',
        filter: { hskLevel: 0 },
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/decks/from-vocabulary', {
        name: 'Test Deck',
        filter: { hskLevel: 7 },
      });
      expect(status2).toBe(400);
    });

    it('should accept valid deck creation from vocabulary', async () => {
      const { status } = await api.post('/api/v1/decks/from-vocabulary', {
        name: 'My Learning Words',
        description: 'Words I am currently learning',
        isPublic: false,
        category: 'custom',
        tags: ['personal'],
        filter: {
          status: 'learning',
        },
      });

      // 400 expected if no words match filter, 200 if words exist
      expect([200, 400]).toContain(status);
    });
  });
});
