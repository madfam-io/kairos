import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import { createRequestHelpers, generators } from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Onboarding API', () => {
  describe('GET /api/v1/onboarding/status', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/onboarding/status', { auth: false });
      expect(status).toBe(401);
    });

    it('should return onboarding status', async () => {
      const { status, json } = await api.get('/api/v1/onboarding/status');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.currentStep).toBeDefined();
      expect(json.data.completedSteps).toBeDefined();
      expect(Array.isArray(json.data.completedSteps)).toBe(true);
    });
  });

  describe('POST /api/v1/onboarding/step', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/onboarding/step', {
        step: 'welcome',
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should validate step value', async () => {
      const { status } = await api.post('/api/v1/onboarding/step', {
        step: 'invalid_step',
      });
      expect(status).toBe(400);
    });

    it('should accept valid step', async () => {
      const { status, json } = await api.post('/api/v1/onboarding/step', {
        step: 'language_background',
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.currentStep).toBe('language_background');
    });
  });

  describe('POST /api/v1/onboarding/skip', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/onboarding/skip', {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should allow skipping onboarding', async () => {
      const { status, json } = await api.post('/api/v1/onboarding/skip', {});

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('POST /api/v1/onboarding/language-background', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/onboarding/language-background', {
        nativeLanguage: 'en',
        hasStudiedChinese: false,
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should require nativeLanguage', async () => {
      const { status } = await api.post('/api/v1/onboarding/language-background', {
        hasStudiedChinese: false,
      });
      expect(status).toBe(400);
    });

    it('should require hasStudiedChinese', async () => {
      const { status } = await api.post('/api/v1/onboarding/language-background', {
        nativeLanguage: 'en',
      });
      expect(status).toBe(400);
    });

    it('should accept valid language background', async () => {
      const { status, json } = await api.post('/api/v1/onboarding/language-background', {
        nativeLanguage: 'en',
        hasStudiedChinese: true,
        yearsStudied: 2,
        previousMethods: ['classroom', 'app'],
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('POST /api/v1/onboarding/learning-goals', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/onboarding/learning-goals', {
        primaryGoal: 'travel',
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should require primaryGoal', async () => {
      const { status } = await api.post('/api/v1/onboarding/learning-goals', {});
      expect(status).toBe(400);
    });

    it('should validate primaryGoal enum', async () => {
      const { status } = await api.post('/api/v1/onboarding/learning-goals', {
        primaryGoal: 'invalid_goal',
      });
      expect(status).toBe(400);
    });

    it('should accept valid learning goals', async () => {
      const { status, json } = await api.post('/api/v1/onboarding/learning-goals', {
        primaryGoal: 'work',
        weeklyHoursTarget: 10,
        targetHskLevel: 4,
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('GET /api/v1/onboarding/assessment/questions', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/onboarding/assessment/questions', { auth: false });
      expect(status).toBe(401);
    });

    it('should return assessment questions', async () => {
      const { status, json } = await api.get('/api/v1/onboarding/assessment/questions');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.questions).toBeDefined();
      expect(Array.isArray(json.data.questions)).toBe(true);
      expect(json.data.totalQuestions).toBeGreaterThan(0);
    });

    it('should respect startLevel parameter', async () => {
      const { status, json } = await api.get('/api/v1/onboarding/assessment/questions?startLevel=3');

      expect(status).toBe(200);
      expect(json.data.startLevel).toBeDefined();
    });
  });

  describe('POST /api/v1/onboarding/assessment/submit', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/onboarding/assessment/submit', {
        answers: [],
        totalTimeSeconds: 60,
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should require answers array', async () => {
      const { status } = await api.post('/api/v1/onboarding/assessment/submit', {
        totalTimeSeconds: 60,
      });
      expect(status).toBe(400);
    });

    it('should require totalTimeSeconds', async () => {
      const { status } = await api.post('/api/v1/onboarding/assessment/submit', {
        answers: [],
      });
      expect(status).toBe(400);
    });

    it('should accept valid assessment submission', async () => {
      const { status, json } = await api.post('/api/v1/onboarding/assessment/submit', {
        answers: [
          { questionId: 0, answer: 'Hello' },
          { questionId: 1, answer: '水 (shuǐ)' },
        ],
        totalTimeSeconds: 120,
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.assessedLevel).toBeDefined();
      expect(json.data.confidenceScore).toBeDefined();
    });
  });

  describe('POST /api/v1/onboarding/preferences', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/onboarding/preferences', {
        preferredContentTypes: ['shows'],
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should accept valid preferences', async () => {
      const { status, json } = await api.post('/api/v1/onboarding/preferences', {
        preferredContentTypes: ['shows', 'movies'],
        preferredGenres: ['drama', 'comedy'],
        interestTopics: ['technology', 'food'],
        preferredSessionLength: 20,
        preferVoiceInput: true,
        preferWritingPractice: false,
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('GET /api/v1/onboarding/recommendations', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/onboarding/recommendations', { auth: false });
      expect(status).toBe(401);
    });

    it('should return recommendations', async () => {
      const { status, json } = await api.get('/api/v1/onboarding/recommendations');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.recommendations).toBeDefined();
      expect(Array.isArray(json.data.recommendations)).toBe(true);
    });

    it('should support category filter', async () => {
      const { status, json } = await api.get('/api/v1/onboarding/recommendations?category=for_you');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });
});
