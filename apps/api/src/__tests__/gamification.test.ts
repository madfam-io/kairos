import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import { createRequestHelpers, generators } from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Gamification API', () => {
  describe('GET /api/v1/gamification/xp', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/gamification/xp', { auth: false });
      expect(status).toBe(401);
    });

    it('should return XP and level info', async () => {
      const { status, json } = await api.get('/api/v1/gamification/xp');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.totalXp).toBeDefined();
      expect(json.data.level).toBeDefined();
      expect(json.data.xpToNextLevel).toBeDefined();
    });
  });

  describe('GET /api/v1/gamification/achievements', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/gamification/achievements', { auth: false });
      expect(status).toBe(401);
    });

    it('should return all achievements with earned status', async () => {
      const { status, json } = await api.get('/api/v1/gamification/achievements');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('GET /api/v1/gamification/achievements/earned', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/gamification/achievements/earned', { auth: false });
      expect(status).toBe(401);
    });

    it('should return earned achievements', async () => {
      const { status, json } = await api.get('/api/v1/gamification/achievements/earned');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('POST /api/v1/gamification/achievements/check', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/gamification/achievements/check', {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should check for new achievements', async () => {
      const { status, json } = await api.post('/api/v1/gamification/achievements/check', {});

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.earned).toBeDefined();
      expect(Array.isArray(json.data.earned)).toBe(true);
    });
  });

  describe('GET /api/v1/gamification/goals', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/gamification/goals', { auth: false });
      expect(status).toBe(401);
    });

    it('should return daily goals and progress', async () => {
      const { status, json } = await api.get('/api/v1/gamification/goals');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.goals).toBeDefined();
      expect(json.data.progress).toBeDefined();
      expect(json.data.streak).toBeDefined();
    });
  });

  describe('PATCH /api/v1/gamification/goals', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch('/api/v1/gamification/goals', {
        wordsTarget: 15,
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should validate wordsTarget range', async () => {
      const { status } = await api.patch('/api/v1/gamification/goals', {
        wordsTarget: 200, // Max is 100
      });
      expect(status).toBe(400);
    });

    it('should accept valid goal updates', async () => {
      const { status, json } = await api.patch('/api/v1/gamification/goals', {
        wordsTarget: 20,
        reviewTarget: 30,
        studyMinutesTarget: 30,
        reminderEnabled: true,
        reminderTime: '09:00',
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe('GET /api/v1/gamification/leaderboard', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/gamification/leaderboard', { auth: false });
      expect(status).toBe(401);
    });

    it('should return leaderboard', async () => {
      const { status, json } = await api.get('/api/v1/gamification/leaderboard');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.periodType).toBeDefined();
      expect(json.data.entries).toBeDefined();
      expect(Array.isArray(json.data.entries)).toBe(true);
    });

    it('should support period parameter', async () => {
      const { status, json } = await api.get('/api/v1/gamification/leaderboard?period=monthly');

      expect(status).toBe(200);
      expect(json.data.periodType).toBe('monthly');
    });
  });

  describe('GET /api/v1/gamification/groups', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/gamification/groups', { auth: false });
      expect(status).toBe(401);
    });

    it('should return study groups', async () => {
      const { status, json } = await api.get('/api/v1/gamification/groups');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should support type filter', async () => {
      const { status } = await api.get('/api/v1/gamification/groups?type=mine');
      expect(status).toBe(200);
    });
  });

  describe('POST /api/v1/gamification/groups', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/gamification/groups', {
        name: 'Test Group',
      }, { auth: false });
      expect(status).toBe(401);
    });

    it('should require name', async () => {
      const { status } = await api.post('/api/v1/gamification/groups', {});
      expect(status).toBe(400);
    });

    it('should validate name length', async () => {
      const { status } = await api.post('/api/v1/gamification/groups', {
        name: 'ab', // Min is 3
      });
      expect(status).toBe(400);
    });

    it('should accept valid group creation', async () => {
      const { status, json } = await api.post('/api/v1/gamification/groups', {
        name: `Test Group ${Date.now()}`,
        description: 'A test study group',
        isPublic: true,
        maxMembers: 20,
        targetHskLevel: 3,
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.slug).toBeDefined();
    });
  });

  describe('GET /api/v1/gamification/following', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/gamification/following', { auth: false });
      expect(status).toBe(401);
    });

    it('should return following list', async () => {
      const { status, json } = await api.get('/api/v1/gamification/following');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('GET /api/v1/gamification/followers', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/gamification/followers', { auth: false });
      expect(status).toBe(401);
    });

    it('should return followers list', async () => {
      const { status, json } = await api.get('/api/v1/gamification/followers');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('GET /api/v1/gamification/feed', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/gamification/feed', { auth: false });
      expect(status).toBe(401);
    });

    it('should return activity feed', async () => {
      const { status, json } = await api.get('/api/v1/gamification/feed');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('GET /api/v1/gamification/summary', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/gamification/summary', { auth: false });
      expect(status).toBe(401);
    });

    it('should return gamification summary', async () => {
      const { status, json } = await api.get('/api/v1/gamification/summary');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.xp).toBeDefined();
      expect(json.data.achievementCount).toBeDefined();
      expect(json.data.dailyProgress).toBeDefined();
      expect(json.data.streak).toBeDefined();
    });
  });
});
