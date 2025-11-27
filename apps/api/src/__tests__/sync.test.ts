import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import { createRequestHelpers, testUser, generators } from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Sync API', () => {
  const validHLCTimestamp = {
    time: Date.now(),
    counter: 0,
    node: 'test-client-1',
  };

  describe('POST /api/v1/sync/push', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/sync/push', {
        operations: [],
        clientId: 'test-client',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require clientId', async () => {
      const { status } = await api.post('/api/v1/sync/push', {
        operations: [],
      });

      expect(status).toBe(400);
    });

    it('should accept empty operations array', async () => {
      const { status, json } = await api.post('/api/v1/sync/push', {
        operations: [],
        clientId: 'test-client-1',
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.accepted).toBe(0);
      expect(json.data.timestamp).toBeDefined();
    });

    it('should accept valid vocabulary create operation', async () => {
      const { status, json } = await api.post('/api/v1/sync/push', {
        operations: [
          {
            id: generators.uuid(),
            entityId: generators.uuid(),
            entityType: 'vocabulary',
            type: 'create',
            data: {
              word: '学习',
              pinyin: 'xuéxí',
              definition: 'to study',
            },
            timestamp: validHLCTimestamp,
          },
        ],
        clientId: 'test-client-1',
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.acceptedIds).toBeDefined();
      expect(json.data.timestamp).toBeDefined();
      expect(json.data.processingTimeMs).toBeDefined();
    });

    it('should accept valid cards create operation', async () => {
      const { status, json } = await api.post('/api/v1/sync/push', {
        operations: [
          {
            id: generators.uuid(),
            entityId: generators.uuid(),
            entityType: 'cards',
            type: 'create',
            data: {
              word: '你好',
              sentence: '你好，世界！',
            },
            timestamp: validHLCTimestamp,
          },
        ],
        clientId: 'test-client-1',
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should accept update operations', async () => {
      const entityId = generators.uuid();

      const { status, json } = await api.post('/api/v1/sync/push', {
        operations: [
          {
            id: generators.uuid(),
            entityId,
            entityType: 'vocabulary',
            type: 'update',
            data: {
              word: '学习',
              status: 'learning',
            },
            timestamp: validHLCTimestamp,
          },
        ],
        clientId: 'test-client-1',
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should accept delete operations', async () => {
      const { status, json } = await api.post('/api/v1/sync/push', {
        operations: [
          {
            id: generators.uuid(),
            entityId: generators.uuid(),
            entityType: 'vocabulary',
            type: 'delete',
            data: null,
            timestamp: validHLCTimestamp,
          },
        ],
        clientId: 'test-client-1',
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should validate entityType enum', async () => {
      const { status } = await api.post('/api/v1/sync/push', {
        operations: [
          {
            id: generators.uuid(),
            entityId: generators.uuid(),
            entityType: 'invalid-type',
            type: 'create',
            data: {},
            timestamp: validHLCTimestamp,
          },
        ],
        clientId: 'test-client-1',
      });

      expect(status).toBe(400);
    });

    it('should validate operation type enum', async () => {
      const { status } = await api.post('/api/v1/sync/push', {
        operations: [
          {
            id: generators.uuid(),
            entityId: generators.uuid(),
            entityType: 'vocabulary',
            type: 'invalid-operation',
            data: {},
            timestamp: validHLCTimestamp,
          },
        ],
        clientId: 'test-client-1',
      });

      expect(status).toBe(400);
    });

    it('should limit operations to 100', async () => {
      const operations = Array.from({ length: 101 }, () => ({
        id: generators.uuid(),
        entityId: generators.uuid(),
        entityType: 'vocabulary' as const,
        type: 'create' as const,
        data: { word: '测试' },
        timestamp: validHLCTimestamp,
      }));

      const { status } = await api.post('/api/v1/sync/push', {
        operations,
        clientId: 'test-client-1',
      });

      expect(status).toBe(400);
    });

    it('should validate timestamp structure', async () => {
      const { status } = await api.post('/api/v1/sync/push', {
        operations: [
          {
            id: generators.uuid(),
            entityId: generators.uuid(),
            entityType: 'vocabulary',
            type: 'create',
            data: { word: '测试' },
            timestamp: {
              time: 'invalid', // Should be number
              counter: 0,
              node: 'test',
            },
          },
        ],
        clientId: 'test-client-1',
      });

      expect(status).toBe(400);
    });
  });

  describe('GET /api/v1/sync/pull', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/sync/pull', { auth: false });
      expect(status).toBe(401);
    });

    it('should return operations list', async () => {
      const { status, json } = await api.get('/api/v1/sync/pull');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.operations)).toBe(true);
      expect(json.data.timestamp).toBeDefined();
      expect(typeof json.data.hasMore).toBe('boolean');
    });

    it('should accept since parameter', async () => {
      const since = `${Date.now().toString(36)}-0-server`;
      const { status, json } = await api.get(`/api/v1/sync/pull?since=${since}`);

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should accept clientId parameter', async () => {
      const { status, json } = await api.get('/api/v1/sync/pull?clientId=test-client-1');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const { status, json } = await api.get('/api/v1/sync/pull?limit=10');

      expect(status).toBe(200);
      expect(json.data.operations.length).toBeLessThanOrEqual(10);
    });

    it('should cap limit at 500', async () => {
      const { status, json } = await api.get('/api/v1/sync/pull?limit=1000');

      expect(status).toBe(200);
      // Limit should be capped at 500
    });
  });

  describe('GET /api/v1/sync/status', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/sync/status', { auth: false });
      expect(status).toBe(401);
    });

    it('should return sync status', async () => {
      const { status, json } = await api.get('/api/v1/sync/status');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.pendingChanges).toBeDefined();
      expect(json.data.totalVocabulary).toBeDefined();
      expect(json.data.totalCards).toBeDefined();
      expect(json.data.serverTime).toBeDefined();
    });

    it('should include last sync timestamp', async () => {
      const { status, json } = await api.get('/api/v1/sync/status');

      expect(status).toBe(200);
      // lastSyncTimestamp can be null if no syncs have occurred
      expect('lastSyncTimestamp' in json.data).toBe(true);
    });
  });

  describe('POST /api/v1/sync/full', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/sync/full', {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should return all user data', async () => {
      const { status, json } = await api.post('/api/v1/sync/full', {});

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.vocabulary)).toBe(true);
      expect(Array.isArray(json.data.cards)).toBe(true);
      expect(json.data.timestamp).toBeDefined();
    });
  });

  describe('DELETE /api/v1/sync/history', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete('/api/v1/sync/history', { auth: false });
      expect(status).toBe(401);
    });

    it('should clear sync history', async () => {
      const { status, json } = await api.delete('/api/v1/sync/history');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBeDefined();
    });
  });
});
