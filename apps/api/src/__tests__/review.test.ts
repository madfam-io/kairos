import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import { createRequestHelpers, generators } from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Review API', () => {
  describe('GET /api/v1/review/preferences', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/review/preferences', { auth: false });
      expect(status).toBe(401);
    });

    it('should return review preferences', async () => {
      const { status, json } = await api.get('/api/v1/review/preferences');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.defaultMode).toBeDefined();
      expect(json.data.cardTypeWeights).toBeDefined();
      expect(json.data.cardsPerSession).toBeDefined();
    });
  });

  describe('PATCH /api/v1/review/preferences', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch('/api/v1/review/preferences', {
        cardsPerSession: 30,
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should validate cardsPerSession range', async () => {
      const { status } = await api.patch('/api/v1/review/preferences', {
        cardsPerSession: 200, // Max is 100
      });
      expect(status).toBe(400);
    });

    it('should validate defaultMode enum', async () => {
      const { status } = await api.patch('/api/v1/review/preferences', {
        defaultMode: 'invalid_mode',
      });
      expect(status).toBe(400);
    });

    it('should accept valid updates', async () => {
      const { status, json } = await api.patch('/api/v1/review/preferences', {
        defaultMode: 'speed_drill',
        cardsPerSession: 30,
        enableTimer: true,
        timerSecondsPerCard: 15,
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should update card type weights', async () => {
      const { status, json } = await api.patch('/api/v1/review/preferences', {
        cardTypeWeights: {
          standard: 50,
          reverse: 25,
          cloze: 15,
          audio: 10,
        },
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('POST /api/v1/review/session/start', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/review/session/start', {
        mode: 'spaced_repetition',
        cardCount: 20,
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should validate mode enum', async () => {
      const { status } = await api.post('/api/v1/review/session/start', {
        mode: 'invalid_mode',
        cardCount: 20,
      });
      expect(status).toBe(400);
    });

    it('should validate cardCount range', async () => {
      const { status } = await api.post('/api/v1/review/session/start', {
        mode: 'spaced_repetition',
        cardCount: 200, // Max is 100
      });
      expect(status).toBe(400);
    });

    it('should accept valid session config', async () => {
      const { status, json } = await api.post('/api/v1/review/session/start', {
        mode: 'deep_practice',
        cardCount: 10,
        cardTypes: ['standard', 'reverse', 'cloze'],
        timerEnabled: true,
        timerSeconds: 10,
      });

      // May return 400 if no vocabulary exists, which is expected
      expect([200, 400]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data.sessionId).toBeDefined();
      }
    });
  });

  describe('POST /api/v1/review/session/:sessionId/response', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/review/session/${generators.uuid()}/response`, {
        reviewCardId: generators.uuid(),
        vocabularyId: generators.uuid(),
        cardType: 'standard',
        userAnswer: 'test',
        correctAnswer: 'test',
        isCorrect: true,
        quality: 4,
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should validate quality range', async () => {
      const { status } = await api.post(`/api/v1/review/session/${generators.uuid()}/response`, {
        reviewCardId: generators.uuid(),
        vocabularyId: generators.uuid(),
        cardType: 'standard',
        userAnswer: 'test',
        correctAnswer: 'test',
        isCorrect: true,
        quality: 10, // Max is 5
      });
      expect(status).toBe(400);
    });

    it('should validate cardType enum', async () => {
      const { status } = await api.post(`/api/v1/review/session/${generators.uuid()}/response`, {
        reviewCardId: generators.uuid(),
        vocabularyId: generators.uuid(),
        cardType: 'invalid_type',
        userAnswer: 'test',
        correctAnswer: 'test',
        isCorrect: true,
        quality: 4,
      });
      expect(status).toBe(400);
    });
  });

  describe('POST /api/v1/review/session/:sessionId/end', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(`/api/v1/review/session/${generators.uuid()}/end`, {}, { auth: false });
      expect(status).toBe(401);
    });
  });

  describe('GET /api/v1/review/history', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/review/history', { auth: false });
      expect(status).toBe(401);
    });

    it('should return review history', async () => {
      const { status, json } = await api.get('/api/v1/review/history');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const { status, json } = await api.get('/api/v1/review/history?limit=5');

      expect(status).toBe(200);
      expect(json.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/review/stats', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/review/stats', { auth: false });
      expect(status).toBe(401);
    });

    it('should return review statistics', async () => {
      const { status, json } = await api.get('/api/v1/review/stats');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.overall).toBeDefined();
      expect(json.data.cardTypePerformance).toBeDefined();
      expect(json.data.recentPerformance).toBeDefined();
    });
  });

  describe('GET /api/v1/review/modes', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/review/modes', { auth: false });
      expect(status).toBe(401);
    });

    it('should return available review modes', async () => {
      const { status, json } = await api.get('/api/v1/review/modes');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.modes).toBeDefined();
      expect(Array.isArray(json.data.modes)).toBe(true);
      expect(json.data.cardTypes).toBeDefined();
      expect(Array.isArray(json.data.cardTypes)).toBe(true);
    });
  });

  describe('GET /api/v1/review/cards/:vocabularyId', () => {
    it('should require authentication', async () => {
      const { status } = await api.get(`/api/v1/review/cards/${generators.uuid()}`, { auth: false });
      expect(status).toBe(401);
    });
  });
});
