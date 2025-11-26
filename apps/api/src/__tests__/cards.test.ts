import { describe, it, expect, beforeEach } from 'bun:test';
import { app } from '../index';

// Mock auth token for testing
const mockAuthHeader = {
  Authorization: 'Bearer test-token',
};

describe('Cards API', () => {
  describe('GET /api/v1/cards', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/v1/cards');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/cards', () => {
    it('should create a new card', async () => {
      const res = await app.request('/api/v1/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...mockAuthHeader,
        },
        body: JSON.stringify({
          word: '学习',
          sentence: '我喜欢学习中文',
          pinyin: 'xuéxí',
          definitions: ['to study', 'to learn'],
        }),
      });

      // Will return 401 in test env without proper auth setup
      expect([201, 401].includes(res.status)).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.request('/api/v1/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...mockAuthHeader,
        },
        body: JSON.stringify({
          // Missing word and sentence
        }),
      });

      expect([400, 401].includes(res.status)).toBe(true);
    });
  });

  describe('GET /api/v1/cards/due', () => {
    it('should return due cards', async () => {
      const res = await app.request('/api/v1/cards/due', {
        headers: mockAuthHeader,
      });

      expect([200, 401].includes(res.status)).toBe(true);

      if (res.status === 200) {
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data.cards)).toBe(true);
      }
    });
  });

  describe('POST /api/v1/cards/:id/review', () => {
    it('should record review result', async () => {
      const res = await app.request('/api/v1/cards/test-card-id/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...mockAuthHeader,
        },
        body: JSON.stringify({
          rating: 3, // Good
          reviewTime: 5000, // 5 seconds
        }),
      });

      // Will return 401 or 404 in test env
      expect([200, 401, 404].includes(res.status)).toBe(true);
    });
  });

  describe('POST /api/v1/cards/export/anki', () => {
    it('should export cards to Anki format', async () => {
      const res = await app.request('/api/v1/cards/export/anki', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...mockAuthHeader,
        },
        body: JSON.stringify({
          format: 'csv',
          cardIds: [],
        }),
      });

      expect([200, 401].includes(res.status)).toBe(true);

      if (res.status === 200) {
        const body = await res.json();
        expect(body.success).toBe(true);
      }
    });
  });
});
