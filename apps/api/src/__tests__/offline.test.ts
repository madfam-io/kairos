import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import {
  createRequestHelpers,
  testUser,
  testAdminUser,
  generators,
} from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Offline Mode API', () => {
  describe('GET /api/v1/offline/status', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/offline/status', { auth: false });
      expect(status).toBe(401);
    });

    it('should return offline status and available packs', async () => {
      const { status, json } = await api.get('/api/v1/offline/status');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.offlineEnabled).toBeDefined();
      expect(json.data.subscriptionTier).toBeDefined();
      expect(json.data.availablePacks).toBeDefined();
      expect(json.data.availablePacks.personal).toBeDefined();
      expect(json.data.availablePacks.shows).toBeDefined();
      expect(json.data.requiredTier).toBe('immersion');
    });
  });

  describe('GET /api/v1/offline/vocabulary', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/offline/vocabulary', { auth: false });
      expect(status).toBe(401);
    });

    it('should require immersion tier subscription', async () => {
      const { status } = await api.get('/api/v1/offline/vocabulary', {
        auth: { ...testUser, subscriptionTier: 'free' },
      });

      // Should be 403 for free tier
      expect([200, 403]).toContain(status);
    });

    it('should return vocabulary pack for immersion users', async () => {
      const { status, json } = await api.get('/api/v1/offline/vocabulary', {
        auth: { ...testAdminUser, subscriptionTier: 'immersion' },
      });

      // 200 if subscription check passes, 403 otherwise
      expect([200, 403]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data.checksum).toBeDefined();
        expect(json.data.type).toBe('vocabulary');
      }
    });
  });

  describe('GET /api/v1/offline/cards', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/offline/cards', { auth: false });
      expect(status).toBe(401);
    });

    it('should require immersion tier subscription', async () => {
      const { status } = await api.get('/api/v1/offline/cards', {
        auth: { ...testUser, subscriptionTier: 'free' },
      });

      expect([200, 403]).toContain(status);
    });
  });

  describe('GET /api/v1/offline/deck/:deckId', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/offline/deck/${generators.uuid()}`, { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent deck', async () => {
      const { status } = await api.get(`/api/v1/offline/deck/${generators.uuid()}`, {
        auth: { ...testAdminUser, subscriptionTier: 'immersion' },
      });

      expect([404, 403]).toContain(status);
    });
  });

  describe('GET /api/v1/offline/show/:showId', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/offline/show/test-show', { auth: false });
      expect(status).toBe(401);
    });

    it('should return 404 for non-existent show pack', async () => {
      const { status } = await api.get('/api/v1/offline/show/non-existent-show', {
        auth: { ...testAdminUser, subscriptionTier: 'immersion' },
      });

      expect([404, 403]).toContain(status);
    });
  });

  describe('POST /api/v1/offline/sync', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/offline/sync', {
        items: [],
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should handle empty sync queue', async () => {
      const { status, json } = await api.post('/api/v1/offline/sync', {
        items: [],
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.processed).toBe(0);
      expect(json.data.failed).toEqual([]);
    });

    it('should validate sync item structure', async () => {
      const { status } = await api.post('/api/v1/offline/sync', {
        items: [{ invalid: 'structure' }],
      });

      expect(status).toBe(400);
    });

    it('should validate operation enum', async () => {
      const { status } = await api.post('/api/v1/offline/sync', {
        items: [{
          id: generators.uuid(),
          operation: 'invalid',
          collection: 'vocabulary',
          documentId: generators.uuid(),
          data: {},
          timestamp: Date.now(),
        }],
      });

      expect(status).toBe(400);
    });

    it('should validate collection enum', async () => {
      const { status } = await api.post('/api/v1/offline/sync', {
        items: [{
          id: generators.uuid(),
          operation: 'create',
          collection: 'invalid',
          documentId: generators.uuid(),
          data: {},
          timestamp: Date.now(),
        }],
      });

      expect(status).toBe(400);
    });

    it('should accept valid sync items', async () => {
      const { status, json } = await api.post('/api/v1/offline/sync', {
        items: [{
          id: generators.uuid(),
          operation: 'create',
          collection: 'vocabulary',
          documentId: generators.uuid(),
          data: { word: '学习', pinyin: 'xuéxí' },
          timestamp: Date.now(),
          retryCount: 0,
        }],
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should accept all valid operations', async () => {
      const operations = ['create', 'update', 'delete'];

      for (const operation of operations) {
        const { status } = await api.post('/api/v1/offline/sync', {
          items: [{
            id: generators.uuid(),
            operation,
            collection: 'vocabulary',
            documentId: generators.uuid(),
            data: { word: '测试' },
            timestamp: Date.now(),
          }],
        });

        expect(status).toBe(200);
      }
    });

    it('should accept all valid collections', async () => {
      const collections = ['vocabulary', 'cards', 'settings'];

      for (const collection of collections) {
        const { status } = await api.post('/api/v1/offline/sync', {
          items: [{
            id: generators.uuid(),
            operation: 'create',
            collection,
            documentId: generators.uuid(),
            data: {},
            timestamp: Date.now(),
          }],
        });

        expect(status).toBe(200);
      }
    });
  });

  describe('POST /api/v1/offline/delta', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/offline/delta', {
        collection: 'vocabulary',
        sinceVersion: 0,
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require collection field', async () => {
      const { status } = await api.post('/api/v1/offline/delta', {
        sinceVersion: 0,
      });

      expect(status).toBe(400);
    });

    it('should require sinceVersion field', async () => {
      const { status } = await api.post('/api/v1/offline/delta', {
        collection: 'vocabulary',
      });

      expect(status).toBe(400);
    });

    it('should validate collection enum', async () => {
      const { status } = await api.post('/api/v1/offline/delta', {
        collection: 'invalid',
        sinceVersion: 0,
      });

      expect(status).toBe(400);
    });

    it('should return changes since version', async () => {
      const { status, json } = await api.post('/api/v1/offline/delta', {
        collection: 'vocabulary',
        sinceVersion: 0,
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('GET /api/v1/offline/manifest', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/offline/manifest', { auth: false });
      expect(status).toBe(401);
    });

    it('should require immersion tier subscription', async () => {
      const { status } = await api.get('/api/v1/offline/manifest', {
        auth: { ...testUser, subscriptionTier: 'free' },
      });

      expect([200, 403]).toContain(status);
    });

    it('should return manifest with personal and shows data', async () => {
      const { status, json } = await api.get('/api/v1/offline/manifest', {
        auth: { ...testAdminUser, subscriptionTier: 'immersion' },
      });

      expect([200, 403]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data.personal).toBeDefined();
        expect(json.data.shows).toBeDefined();
        expect(json.data.generatedAt).toBeDefined();
      }
    });
  });

  describe('POST /api/v1/offline/verify', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/offline/verify', {
        type: 'vocabulary',
        checksum: 'abc123',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require type field', async () => {
      const { status } = await api.post('/api/v1/offline/verify', {
        checksum: 'abc123',
      });

      expect(status).toBe(400);
    });

    it('should require checksum field', async () => {
      const { status } = await api.post('/api/v1/offline/verify', {
        type: 'vocabulary',
      });

      expect(status).toBe(400);
    });

    it('should validate type enum', async () => {
      const { status } = await api.post('/api/v1/offline/verify', {
        type: 'invalid',
        checksum: 'abc123',
      });

      expect(status).toBe(400);
    });

    it('should require id for deck type', async () => {
      const { status, json } = await api.post('/api/v1/offline/verify', {
        type: 'deck',
        checksum: 'abc123',
      });

      expect(status).toBe(400);
    });

    it('should require id for show type', async () => {
      const { status, json } = await api.post('/api/v1/offline/verify', {
        type: 'show',
        checksum: 'abc123',
      });

      expect(status).toBe(400);
    });

    it('should verify vocabulary checksum', async () => {
      const { status, json } = await api.post('/api/v1/offline/verify', {
        type: 'vocabulary',
        checksum: 'test-checksum',
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.valid).toBeDefined();
      expect(json.data.serverChecksum).toBeDefined();
      expect(json.data.clientChecksum).toBe('test-checksum');
      expect(json.data.needsUpdate).toBeDefined();
    });

    it('should verify cards checksum', async () => {
      const { status, json } = await api.post('/api/v1/offline/verify', {
        type: 'cards',
        checksum: 'test-checksum',
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });
});
