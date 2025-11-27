import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import { createRequestHelpers } from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Progress API', () => {
  describe('GET /api/v1/progress/summary', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/progress/summary', { auth: false });
      expect(status).toBe(401);
    });

    it('should return progress summary', async () => {
      const { status, json } = await api.get('/api/v1/progress/summary');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.estimatedHskLevel).toBeDefined();
      expect(json.data.hskProgress).toBeDefined();
      expect(json.data.vocabulary).toBeDefined();
      expect(json.data.streak).toBeDefined();
      expect(json.data.level).toBeDefined();
      expect(json.data.totalXp).toBeDefined();
    });
  });

  describe('GET /api/v1/progress/hsk', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/progress/hsk', { auth: false });
      expect(status).toBe(401);
    });

    it('should return HSK level progress', async () => {
      const { status, json } = await api.get('/api/v1/progress/hsk');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBe(6); // HSK 1-6

      // Check structure of each level
      if (json.data.length > 0) {
        expect(json.data[0].level).toBeDefined();
        expect(json.data[0].wordsLearned).toBeDefined();
        expect(json.data[0].wordsKnown).toBeDefined();
        expect(json.data[0].totalWords).toBeDefined();
        expect(json.data[0].progress).toBeDefined();
        expect(json.data[0].isComplete).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/progress/vocabulary-tree', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/progress/vocabulary-tree', { auth: false });
      expect(status).toBe(401);
    });

    it('should return vocabulary tree', async () => {
      const { status, json } = await api.get('/api/v1/progress/vocabulary-tree');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.name).toBeDefined();
      expect(json.data.type).toBe('root');
      expect(json.data.count).toBeDefined();
      expect(json.data.mastered).toBeDefined();
    });
  });

  describe('GET /api/v1/progress/velocity', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/progress/velocity', { auth: false });
      expect(status).toBe(401);
    });

    it('should return learning velocity', async () => {
      const { status, json } = await api.get('/api/v1/progress/velocity');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      // Check structure of velocity data
      if (json.data.length > 0) {
        expect(json.data[0].date).toBeDefined();
        expect(json.data[0].wordsLearned).toBeDefined();
        expect(json.data[0].wordsReviewed).toBeDefined();
        expect(json.data[0].studyMinutes).toBeDefined();
        expect(json.data[0].accuracy).toBeDefined();
      }
    });

    it('should support days parameter', async () => {
      const { status, json } = await api.get('/api/v1/progress/velocity?days=7');

      expect(status).toBe(200);
      expect(json.data.length).toBeLessThanOrEqual(8); // 7 days + today
    });

    it('should cap days at 365', async () => {
      const { status, json } = await api.get('/api/v1/progress/velocity?days=1000');

      expect(status).toBe(200);
      // Should be capped at 365
      expect(json.data.length).toBeLessThanOrEqual(366);
    });
  });

  describe('GET /api/v1/progress/milestones', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/progress/milestones', { auth: false });
      expect(status).toBe(401);
    });

    it('should return milestones', async () => {
      const { status, json } = await api.get('/api/v1/progress/milestones');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.achieved).toBeDefined();
      expect(json.data.pending).toBeDefined();
      expect(json.data.total).toBeDefined();
      expect(json.data.completedCount).toBeDefined();
      expect(Array.isArray(json.data.achieved)).toBe(true);
      expect(Array.isArray(json.data.pending)).toBe(true);
    });
  });

  describe('GET /api/v1/progress/retention', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/progress/retention', { auth: false });
      expect(status).toBe(401);
    });

    it('should return retention curve data', async () => {
      const { status, json } = await api.get('/api/v1/progress/retention');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      // Check structure if data exists
      if (json.data.length > 0) {
        expect(json.data[0].daysSinceReview).toBeDefined();
        expect(json.data[0].retention).toBeDefined();
        expect(json.data[0].wordCount).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/progress/study-time', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/progress/study-time', { auth: false });
      expect(status).toBe(401);
    });

    it('should return study time distribution', async () => {
      const { status, json } = await api.get('/api/v1/progress/study-time');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.distribution).toBeDefined();
      expect(Array.isArray(json.data.distribution)).toBe(true);
      expect(json.data.distribution.length).toBe(24); // 24 hours
      expect(json.data.totalMinutes).toBeDefined();
    });
  });

  describe('GET /api/v1/progress/charts', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/progress/charts', { auth: false });
      expect(status).toBe(401);
    });

    it('should return all chart data', async () => {
      const { status, json } = await api.get('/api/v1/progress/charts');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.velocity).toBeDefined();
      expect(json.data.hskProgress).toBeDefined();
      expect(json.data.retention).toBeDefined();
      expect(json.data.studyTimeDistribution).toBeDefined();
    });

    it('should support days parameter', async () => {
      const { status, json } = await api.get('/api/v1/progress/charts?days=14');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });
});
