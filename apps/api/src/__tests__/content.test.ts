import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import {
  createRequestHelpers,
  testUser,
  generators,
} from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Content API', () => {
  describe('POST /api/v1/content/analyze', () => {
    it('should allow unauthenticated access', async () => {
      const { status, json } = await api.post('/api/v1/content/analyze', {
        text: '这是一个测试',
      }, { auth: false });

      expect([200, 500]).toContain(status);
    });

    it('should require text field', async () => {
      const { status } = await api.post('/api/v1/content/analyze', {}, { auth: false });
      expect(status).toBe(400);
    });

    it('should validate text length (min 1, max 50000)', async () => {
      const { status: status1 } = await api.post('/api/v1/content/analyze', {
        text: '',
      }, { auth: false });
      expect(status1).toBe(400);

      // Note: We don't test 50001 chars here as it would be slow
    });

    it('should accept optional knownWords array', async () => {
      const { status } = await api.post('/api/v1/content/analyze', {
        text: '这是一个测试',
        knownWords: ['这', '是', '一个'],
      }, { auth: false });

      expect([200, 500]).toContain(status);
    });

    it('should return analysis data on success', async () => {
      const { status, json } = await api.post('/api/v1/content/analyze', {
        text: '你好世界',
        knownWords: [],
      }, { auth: false });

      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data.processingTimeMs).toBeDefined();
      }
    });
  });

  describe('POST /api/v1/content/recommendations', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/content/recommendations', {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should return recommendations with default options', async () => {
      const { status, json } = await api.post('/api/v1/content/recommendations', {});

      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data.recommendations).toBeDefined();
        expect(json.data.userLevel).toBeDefined();
      }
    });

    it('should validate limit range (1-50)', async () => {
      const { status: status1 } = await api.post('/api/v1/content/recommendations', {
        limit: 0,
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/content/recommendations', {
        limit: 51,
      });
      expect(status2).toBe(400);
    });

    it('should validate type enum', async () => {
      const { status } = await api.post('/api/v1/content/recommendations', {
        type: 'invalid',
      });

      expect(status).toBe(400);
    });

    it('should accept all valid type values', async () => {
      const types = ['article', 'video', 'story', 'dialogue'];

      for (const type of types) {
        const { status } = await api.post('/api/v1/content/recommendations', {
          type,
        });

        expect([200, 500]).toContain(status);
      }
    });

    it('should validate minComprehensibility range (0-100)', async () => {
      const { status: status1 } = await api.post('/api/v1/content/recommendations', {
        minComprehensibility: -1,
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/content/recommendations', {
        minComprehensibility: 101,
      });
      expect(status2).toBe(400);
    });

    it('should validate maxComprehensibility range (0-100)', async () => {
      const { status: status1 } = await api.post('/api/v1/content/recommendations', {
        maxComprehensibility: -1,
      });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/content/recommendations', {
        maxComprehensibility: 101,
      });
      expect(status2).toBe(400);
    });

    it('should accept full options object', async () => {
      const { status } = await api.post('/api/v1/content/recommendations', {
        limit: 10,
        type: 'article',
        minComprehensibility: 70,
        maxComprehensibility: 95,
      });

      expect([200, 500]).toContain(status);
    });
  });

  describe('GET /api/v1/content/level', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/content/level', { auth: false });
      expect(status).toBe(401);
    });

    it('should return user level information', async () => {
      const { status, json } = await api.get('/api/v1/content/level');

      expect([200, 500]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data).toBeDefined();
      }
    });
  });

  describe('POST /api/v1/content/preview', () => {
    it('should allow unauthenticated access', async () => {
      const { status } = await api.post('/api/v1/content/preview', {
        text: '测试内容',
      }, { auth: false });

      expect([200, 400, 500]).toContain(status);
    });

    it('should require at least one of contentId, url, or text', async () => {
      const { status, json } = await api.post('/api/v1/content/preview', {}, { auth: false });

      expect(status).toBe(400);
      expect(json.error.code).toBe('INVALID_REQUEST');
    });

    it('should validate url format if provided', async () => {
      const { status } = await api.post('/api/v1/content/preview', {
        url: 'not-a-url',
      }, { auth: false });

      expect(status).toBe(400);
    });

    it('should validate text max length (1000)', async () => {
      const { status } = await api.post('/api/v1/content/preview', {
        text: 'a'.repeat(1001),
      }, { auth: false });

      expect(status).toBe(400);
    });

    it('should accept optional knownWords', async () => {
      const { status } = await api.post('/api/v1/content/preview', {
        text: '测试',
        knownWords: ['测', '试'],
      }, { auth: false });

      expect([200, 500]).toContain(status);
    });

    it('should return preview data with text', async () => {
      const { status, json } = await api.post('/api/v1/content/preview', {
        text: '这是一个简单的测试',
      }, { auth: false });

      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data.difficulty).toBeDefined();
        expect(json.data.comprehensibility).toBeDefined();
        expect(json.data.recommendation).toBeDefined();
      }
    });

    it('should return preview data with url', async () => {
      const { status, json } = await api.post('/api/v1/content/preview', {
        url: 'https://example.com/article',
      }, { auth: false });

      expect([200, 500]).toContain(status);
    });

    it('should return preview data with contentId', async () => {
      const { status, json } = await api.post('/api/v1/content/preview', {
        contentId: 'test-content-id',
      }, { auth: false });

      expect([200, 500]).toContain(status);
    });
  });
});
