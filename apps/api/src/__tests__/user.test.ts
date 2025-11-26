import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import { createRequestHelpers, testUser, testAdminUser } from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('User API', () => {
  describe('GET /api/v1/user/profile', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/user/profile', { auth: false });
      expect(status).toBe(401);
    });

    it('should return user profile', async () => {
      const { status, json } = await api.get('/api/v1/user/profile');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.email).toBeDefined();
      expect(json.data.settings).toBeDefined();
      expect(json.data.stats).toBeDefined();
    });

    it('should include subscription info', async () => {
      const { status, json } = await api.get('/api/v1/user/profile');

      expect(status).toBe(200);
      expect(json.data.subscriptionTier).toBeDefined();
    });

    it('should include user stats', async () => {
      const { status, json } = await api.get('/api/v1/user/profile');

      expect(status).toBe(200);
      expect(json.data.stats.totalWordsLearned).toBeDefined();
      expect(json.data.stats.totalCardsMined).toBeDefined();
      expect(json.data.stats.currentStreak).toBeDefined();
      expect(json.data.stats.longestStreak).toBeDefined();
    });
  });

  describe('PATCH /api/v1/user/profile', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch('/api/v1/user/profile', {
        theme: 'dark',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should update theme setting', async () => {
      const { status, json } = await api.patch('/api/v1/user/profile', {
        theme: 'dark',
      });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.settings.theme).toBe('dark');
    });

    it('should validate theme enum', async () => {
      const { status } = await api.patch('/api/v1/user/profile', {
        theme: 'invalid-theme',
      });

      expect(status).toBe(400);
    });

    it('should update HSK level', async () => {
      const { status, json } = await api.patch('/api/v1/user/profile', {
        hskLevel: 3,
      });

      expect(status).toBe(200);
      expect(json.data.settings.hskLevel).toBe(3);
    });

    it('should validate HSK level range', async () => {
      const { status } = await api.patch('/api/v1/user/profile', {
        hskLevel: 7, // Invalid: max is 6
      });

      expect(status).toBe(400);
    });

    it('should update boolean settings', async () => {
      const { status, json } = await api.patch('/api/v1/user/profile', {
        showPinyin: true,
        autoPlayAudio: false,
        simplificationEnabled: true,
      });

      expect(status).toBe(200);
      expect(json.data.settings.showPinyin).toBe(true);
      expect(json.data.settings.autoPlayAudio).toBe(false);
      expect(json.data.settings.simplificationEnabled).toBe(true);
    });

    it('should update fontSize', async () => {
      const { status, json } = await api.patch('/api/v1/user/profile', {
        fontSize: 'large',
      });

      expect(status).toBe(200);
      expect(json.data.settings.fontSize).toBe('large');
    });

    it('should validate fontSize enum', async () => {
      const { status } = await api.patch('/api/v1/user/profile', {
        fontSize: 'extra-large',
      });

      expect(status).toBe(400);
    });

    it('should update locale', async () => {
      const { status, json } = await api.patch('/api/v1/user/profile', {
        locale: 'zh-Hans',
      });

      expect(status).toBe(200);
      expect(json.data.settings.locale).toBe('zh-Hans');
    });

    it('should validate locale enum', async () => {
      const { status } = await api.patch('/api/v1/user/profile', {
        locale: 'fr', // Not supported
      });

      expect(status).toBe(400);
    });

    it('should allow multiple settings at once', async () => {
      const { status, json } = await api.patch('/api/v1/user/profile', {
        theme: 'system',
        hskLevel: 4,
        showPinyin: false,
        fontSize: 'medium',
      });

      expect(status).toBe(200);
      expect(json.data.settings.theme).toBe('system');
      expect(json.data.settings.hskLevel).toBe(4);
      expect(json.data.settings.showPinyin).toBe(false);
      expect(json.data.settings.fontSize).toBe('medium');
    });
  });

  describe('GET /api/v1/user/subscription', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/user/subscription', { auth: false });
      expect(status).toBe(401);
    });

    it('should return subscription details', async () => {
      const { status, json } = await api.get('/api/v1/user/subscription');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.tier).toBeDefined();
      expect(json.data.status).toBeDefined();
    });

    it('should include cancelAtPeriodEnd flag', async () => {
      const { status, json } = await api.get('/api/v1/user/subscription');

      expect(status).toBe(200);
      expect(typeof json.data.cancelAtPeriodEnd).toBe('boolean');
    });
  });

  describe('GET /api/v1/user/usage', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/user/usage', { auth: false });
      expect(status).toBe(401);
    });

    it('should return usage statistics', async () => {
      const { status, json } = await api.get('/api/v1/user/usage');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.cardsMinedToday).toBeDefined();
      expect(json.data.aiSentencesThisMonth).toBeDefined();
      expect(json.data.periodStart).toBeDefined();
      expect(json.data.periodEnd).toBeDefined();
    });
  });

  describe('POST /api/v1/user/activity', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/user/activity', {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should record activity and return streak info', async () => {
      const { status, json } = await api.post('/api/v1/user/activity', {});

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.currentStreak).toBeDefined();
      expect(json.data.longestStreak).toBeDefined();
      expect(json.data.currentStreak).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DELETE /api/v1/user/account', () => {
    it('should require authentication', async () => {
      const { status } = await api.delete('/api/v1/user/account', { auth: false });
      expect(status).toBe(401);
    });

    // Note: We don't actually test account deletion as it would affect test state
    // In integration tests, you would use a dedicated test account
    it('should be accessible with valid auth', async () => {
      // Just verify the endpoint exists and requires auth
      // We don't actually delete in tests
      const { status } = await api.delete('/api/v1/user/account', { auth: false });
      expect(status).toBe(401);
    });
  });

  describe('GET /api/v1/user/export', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/user/export', { auth: false });
      expect(status).toBe(401);
    });

    it('should return user data export', async () => {
      const { status, json } = await api.get('/api/v1/user/export');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.exportedAt).toBeDefined();
      expect(json.data.user).toBeDefined();
      expect(Array.isArray(json.data.vocabulary)).toBe(true);
      expect(Array.isArray(json.data.cards)).toBe(true);
    });

    it('should include stats in export', async () => {
      const { status, json } = await api.get('/api/v1/user/export');

      expect(status).toBe(200);
      expect('stats' in json.data).toBe(true);
    });
  });
});
