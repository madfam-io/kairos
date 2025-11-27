import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import {
  createRequestHelpers,
  testUser,
  generators,
} from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Analytics API', () => {
  describe('POST /api/v1/analytics/event', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/analytics/event', {
        eventType: 'word_lookup',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require eventType field', async () => {
      const { status } = await api.post('/api/v1/analytics/event', {});
      expect(status).toBe(400);
    });

    it('should validate eventType enum', async () => {
      const { status } = await api.post('/api/v1/analytics/event', {
        eventType: 'invalid_event_type',
      });

      expect(status).toBe(400);
    });

    it('should accept all valid event types', async () => {
      const validEvents = [
        'session_start',
        'session_end',
        'video_play',
        'video_pause',
        'word_lookup',
        'card_mined',
        'card_exported',
        'simplification_used',
        'pitch_practice',
        'settings_changed',
        'error_occurred',
        'reader_opened',
        'shadowing_completed',
      ];

      for (const eventType of validEvents) {
        const { status, json } = await api.post('/api/v1/analytics/event', {
          eventType,
        });

        expect(status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.recorded).toBe(true);
      }
    });

    it('should accept optional eventData', async () => {
      const { status, json } = await api.post('/api/v1/analytics/event', {
        eventType: 'word_lookup',
        eventData: {
          word: '学习',
          source: 'video',
        },
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should accept optional timestamp', async () => {
      const { status, json } = await api.post('/api/v1/analytics/event', {
        eventType: 'word_lookup',
        timestamp: new Date().toISOString(),
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should validate timestamp format if provided', async () => {
      const { status } = await api.post('/api/v1/analytics/event', {
        eventType: 'word_lookup',
        timestamp: 'invalid-date',
      });

      expect(status).toBe(400);
    });

    it('should track session_end with duration', async () => {
      const { status, json } = await api.post('/api/v1/analytics/event', {
        eventType: 'session_end',
        eventData: {
          durationMinutes: 30,
        },
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('POST /api/v1/analytics/events', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/analytics/events', {
        events: [{ eventType: 'word_lookup' }],
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require events array', async () => {
      const { status } = await api.post('/api/v1/analytics/events', {});
      expect(status).toBe(400);
    });

    it('should require at least one event', async () => {
      const { status } = await api.post('/api/v1/analytics/events', {
        events: [],
      });

      expect(status).toBe(400);
    });

    it('should limit batch size to 100', async () => {
      const events = Array.from({ length: 101 }, () => ({
        eventType: 'word_lookup',
      }));

      const { status } = await api.post('/api/v1/analytics/events', { events });
      expect(status).toBe(400);
    });

    it('should accept valid batch of events', async () => {
      const { status, json } = await api.post('/api/v1/analytics/events', {
        events: [
          { eventType: 'word_lookup', eventData: { word: '学习' } },
          { eventType: 'card_mined' },
          { eventType: 'session_end', eventData: { durationMinutes: 15 } },
        ],
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.recorded).toBe(3);
    });

    it('should validate each event in batch', async () => {
      const { status } = await api.post('/api/v1/analytics/events', {
        events: [
          { eventType: 'word_lookup' },
          { eventType: 'invalid_type' },
        ],
      });

      expect(status).toBe(400);
    });
  });

  describe('GET /api/v1/analytics/progress', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/analytics/progress', { auth: false });
      expect(status).toBe(401);
    });

    it('should return progress data with default range', async () => {
      const { status, json } = await api.get('/api/v1/analytics/progress');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });

    it('should accept startDate and endDate query params', async () => {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { status, json } = await api.get(
        `/api/v1/analytics/progress?startDate=${startDate}&endDate=${endDate}`
      );

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should accept granularity parameter', async () => {
      const granularities = ['day', 'week', 'month'];

      for (const granularity of granularities) {
        const { status, json } = await api.get(
          `/api/v1/analytics/progress?granularity=${granularity}`
        );

        expect(status).toBe(200);
        expect(json.success).toBe(true);
      }
    });

    it('should validate granularity enum', async () => {
      const { status } = await api.get('/api/v1/analytics/progress?granularity=invalid');
      expect(status).toBe(400);
    });
  });

  describe('GET /api/v1/analytics/summary', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/analytics/summary', { auth: false });
      expect(status).toBe(401);
    });

    it('should return comprehensive dashboard summary', async () => {
      const { status, json } = await api.get('/api/v1/analytics/summary');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });
  });

  describe('GET /api/v1/analytics/heatmap', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/analytics/heatmap', { auth: false });
      expect(status).toBe(401);
    });

    it('should return heatmap data', async () => {
      const { status, json } = await api.get('/api/v1/analytics/heatmap');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });
  });

  describe('GET /api/v1/analytics/vocabulary-growth', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/analytics/vocabulary-growth', { auth: false });
      expect(status).toBe(401);
    });

    it('should return vocabulary growth data with default days', async () => {
      const { status, json } = await api.get('/api/v1/analytics/vocabulary-growth');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });

    it('should accept days query parameter', async () => {
      const { status, json } = await api.get('/api/v1/analytics/vocabulary-growth?days=30');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should clamp days to valid range (7-365)', async () => {
      // Too small
      const { status: status1 } = await api.get('/api/v1/analytics/vocabulary-growth?days=1');
      expect(status1).toBe(200);

      // Too large
      const { status: status2 } = await api.get('/api/v1/analytics/vocabulary-growth?days=1000');
      expect(status2).toBe(200);
    });
  });

  describe('GET /api/v1/analytics/retention', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/analytics/retention', { auth: false });
      expect(status).toBe(401);
    });

    it('should return retention and mastery data', async () => {
      const { status, json } = await api.get('/api/v1/analytics/retention');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });
  });

  describe('GET /api/v1/analytics/insights', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/analytics/insights', { auth: false });
      expect(status).toBe(401);
    });

    it('should return learning insights', async () => {
      const { status, json } = await api.get('/api/v1/analytics/insights');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });
  });

  describe('POST /api/v1/analytics/insights/:id/dismiss', () => {
    it('should require authentication', async () => {
      const { status } = await api.post(
        `/api/v1/analytics/insights/${generators.uuid()}/dismiss`,
        {},
        { auth: false }
      );

      expect(status).toBe(401);
    });

    it('should dismiss an insight (idempotent)', async () => {
      const { status, json } = await api.post(
        `/api/v1/analytics/insights/${generators.uuid()}/dismiss`,
        {}
      );

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.dismissed).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/goals', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/analytics/goals', { auth: false });
      expect(status).toBe(401);
    });

    it('should return user goals list', async () => {
      const { status, json } = await api.get('/api/v1/analytics/goals');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('POST /api/v1/analytics/goals', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/analytics/goals', {
        goalType: 'daily_words',
        targetValue: 10,
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require goalType field', async () => {
      const { status } = await api.post('/api/v1/analytics/goals', {
        targetValue: 10,
      });

      expect(status).toBe(400);
    });

    it('should require targetValue field', async () => {
      const { status } = await api.post('/api/v1/analytics/goals', {
        goalType: 'daily_words',
      });

      expect(status).toBe(400);
    });

    it('should validate goalType enum', async () => {
      const { status } = await api.post('/api/v1/analytics/goals', {
        goalType: 'invalid_goal_type',
        targetValue: 10,
      });

      expect(status).toBe(400);
    });

    it('should accept all valid goal types', async () => {
      const validGoalTypes = ['daily_words', 'daily_reviews', 'daily_time', 'weekly_words', 'streak'];

      for (const goalType of validGoalTypes) {
        const { status, json } = await api.post('/api/v1/analytics/goals', {
          goalType,
          targetValue: 10,
        });

        expect(status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.goalType).toBe(goalType);
        expect(json.data.targetValue).toBe(10);
        expect(json.data.currentValue).toBe(0);
        expect(json.data.progress).toBe(0);
        expect(json.data.isActive).toBe(true);
      }
    });

    it('should validate targetValue is at least 1', async () => {
      const { status } = await api.post('/api/v1/analytics/goals', {
        goalType: 'daily_words',
        targetValue: 0,
      });

      expect(status).toBe(400);
    });

    it('should create goal with proper structure', async () => {
      const { status, json } = await api.post('/api/v1/analytics/goals', {
        goalType: 'daily_words',
        targetValue: 20,
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.goalType).toBe('daily_words');
      expect(json.data.targetValue).toBe(20);
      expect(json.data.currentValue).toBe(0);
      expect(json.data.startDate).toBeDefined();
      expect(json.data.isActive).toBe(true);
      expect(json.data.progress).toBe(0);
    });
  });

  describe('DELETE /api/v1/analytics/goals/:id', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete(
        `/api/v1/analytics/goals/${generators.uuid()}`,
        { auth: false }
      );

      expect(status).toBe(401);
    });

    it('should deactivate goal (idempotent)', async () => {
      const { status, json } = await api.delete(
        `/api/v1/analytics/goals/${generators.uuid()}`
      );

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.deleted).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/milestones', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/analytics/milestones', { auth: false });
      expect(status).toBe(401);
    });

    it('should return milestones with progress', async () => {
      const { status, json } = await api.get('/api/v1/analytics/milestones');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.milestones).toBeDefined();
      expect(Array.isArray(json.data.milestones)).toBe(true);
      expect(json.data.achievedCount).toBeDefined();
      expect(json.data.totalCount).toBeDefined();
      expect(typeof json.data.achievedCount).toBe('number');
      expect(typeof json.data.totalCount).toBe('number');
    });

    it('should return milestones with correct structure', async () => {
      const { status, json } = await api.get('/api/v1/analytics/milestones');

      expect(status).toBe(200);

      if (json.data.milestones.length > 0) {
        const milestone = json.data.milestones[0];
        expect(milestone.id).toBeDefined();
        expect(milestone.name).toBeDefined();
        expect(milestone.description).toBeDefined();
        expect(typeof milestone.achieved).toBe('boolean');
        expect(typeof milestone.progress).toBe('number');
        expect(milestone.progress).toBeGreaterThanOrEqual(0);
        expect(milestone.progress).toBeLessThanOrEqual(100);
      }
    });
  });
});
