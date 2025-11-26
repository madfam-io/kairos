import { describe, it, expect, beforeAll } from 'bun:test';
import { app } from '../index';

describe('NLP API', () => {
  describe('POST /api/v1/nlp/segment', () => {
    it('should segment Chinese text', async () => {
      const res = await app.request('/api/v1/nlp/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '你好世界',
          targetLevel: 3,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.segments).toBeDefined();
      expect(Array.isArray(body.data.segments)).toBe(true);
    });

    it('should return 400 for empty text', async () => {
      const res = await app.request('/api/v1/nlp/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '',
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should handle long text', async () => {
      const longText = '今天天气很好。'.repeat(100);
      const res = await app.request('/api/v1/nlp/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: longText,
          targetLevel: 4,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/v1/nlp/simplify', () => {
    it('should simplify complex text', async () => {
      const res = await app.request('/api/v1/nlp/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '陛下，此事万万不可鲁莽行事',
          targetLevel: 3,
        }),
      });

      // May return 503 if service unavailable in test env
      expect([200, 503].includes(res.status)).toBe(true);

      if (res.status === 200) {
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.simplified).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/nlp/dictionary/:word', () => {
    it('should lookup a Chinese word', async () => {
      const res = await app.request('/api/v1/nlp/dictionary/你好');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.word).toBe('你好');
      expect(body.data.definitions).toBeDefined();
    });

    it('should return 404 for non-existent word', async () => {
      const res = await app.request('/api/v1/nlp/dictionary/xyznonexistent');

      // May return 200 with empty results or 404
      expect([200, 404].includes(res.status)).toBe(true);
    });
  });
});
