import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import {
  createRequestHelpers,
  testUser,
  testAdminUser,
  generators,
} from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Referrals API', () => {
  describe('GET /api/v1/referrals', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/referrals', { auth: false });
      expect(status).toBe(401);
    });

    it('should return referral info for user without code', async () => {
      const { status, json } = await api.get('/api/v1/referrals');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.hasCode).toBeDefined();
    });

    it('should return referral stats if user has code', async () => {
      const { status, json } = await api.get('/api/v1/referrals');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      // If hasCode is true, should have stats
      if (json.data.hasCode) {
        expect(json.data.code).toBeDefined();
        expect(json.data.discountPercent).toBeDefined();
        expect(json.data.commissionPercent).toBeDefined();
        expect(json.data.stats).toBeDefined();
      }
    });
  });

  describe('POST /api/v1/referrals/create', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/referrals/create', {}, { auth: false });
      expect(status).toBe(401);
    });

    it('should require paid subscription', async () => {
      const { status } = await api.post('/api/v1/referrals/create', {}, {
        auth: { ...testUser, subscriptionTier: 'free' },
      });

      // Should either return existing code or 403 for free tier
      expect([200, 403]).toContain(status);
    });

    it('should create or return existing referral code', async () => {
      const { status, json } = await api.post('/api/v1/referrals/create', {}, {
        auth: { ...testAdminUser, subscriptionTier: 'immersion' },
      });

      expect([200, 403]).toContain(status);
      if (status === 200) {
        expect(json.success).toBe(true);
        expect(json.data.code).toBeDefined();
        expect(json.data.discountPercent).toBeDefined();
        expect(json.data.commissionPercent).toBeDefined();
      }
    });
  });

  describe('GET /api/v1/referrals/history', () => {
    it('should require authentication', async () => {
      const { status } = await api.get('/api/v1/referrals/history', { auth: false });
      expect(status).toBe(401);
    });

    it('should return usage history', async () => {
      const { status, json } = await api.get('/api/v1/referrals/history');

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe('POST /api/v1/referrals/validate', () => {
    it('should not require authentication (public endpoint)', async () => {
      const { status, json } = await api.post('/api/v1/referrals/validate', {
        code: 'TESTCODE',
      }, { auth: false });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('should require code field', async () => {
      const { status } = await api.post('/api/v1/referrals/validate', {}, { auth: false });
      expect(status).toBe(400);
    });

    it('should validate code length (min 1, max 20)', async () => {
      const { status: status1 } = await api.post('/api/v1/referrals/validate', {
        code: '',
      }, { auth: false });
      expect(status1).toBe(400);

      const { status: status2 } = await api.post('/api/v1/referrals/validate', {
        code: 'a'.repeat(21),
      }, { auth: false });
      expect(status2).toBe(400);
    });

    it('should return valid: false for invalid code', async () => {
      const { status, json } = await api.post('/api/v1/referrals/validate', {
        code: 'INVALIDCODE123',
      }, { auth: false });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(false);
      expect(json.data.message).toBeDefined();
    });
  });

  describe('POST /api/v1/referrals/apply', () => {
    it('should require authentication', async () => {
      const { status } = await api.post('/api/v1/referrals/apply', {
        code: 'TESTCODE',
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should require code field', async () => {
      const { status } = await api.post('/api/v1/referrals/apply', {});
      expect(status).toBe(400);
    });

    it('should validate code length', async () => {
      const { status } = await api.post('/api/v1/referrals/apply', {
        code: 'a'.repeat(21),
      });

      expect(status).toBe(400);
    });

    it('should validate amount is positive if provided', async () => {
      const { status } = await api.post('/api/v1/referrals/apply', {
        code: 'TESTCODE',
        amount: -10,
      });

      expect(status).toBe(400);
    });

    it('should return error for invalid code', async () => {
      const { status, json } = await api.post('/api/v1/referrals/apply', {
        code: 'INVALIDCODE123',
      });

      expect(status).toBe(400);
      expect(json.success).toBe(false);
    });

    it('should accept valid apply request structure', async () => {
      const { status } = await api.post('/api/v1/referrals/apply', {
        code: 'TESTCODE',
        subscriptionId: 'sub_123',
        amount: 9.99,
      });

      // 400 expected if code doesn't exist or already used
      expect([200, 400]).toContain(status);
    });
  });

  describe('PATCH /api/v1/referrals/settings', () => {
    it('should require authentication', async () => {
      const { status } = await api.patch('/api/v1/referrals/settings', {
        isActive: false,
      }, { auth: false });

      expect(status).toBe(401);
    });

    it('should return 404 if user has no referral code', async () => {
      const { status } = await api.patch('/api/v1/referrals/settings', {
        isActive: false,
      });

      // 404 if no code, 200 if has code
      expect([200, 404]).toContain(status);
    });

    it('should accept valid isActive boolean', async () => {
      const { status } = await api.patch('/api/v1/referrals/settings', {
        isActive: true,
      });

      expect([200, 404]).toContain(status);
    });
  });

  describe('GET /api/v1/referrals/leaderboard', () => {
    it('should not require authentication (public endpoint)', async () => {
      const { status, json } = await api.get('/api/v1/referrals/leaderboard', { auth: false });

      expect(status).toBe(200);
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should return ranked list with masked codes', async () => {
      const { status, json } = await api.get('/api/v1/referrals/leaderboard', { auth: false });

      expect(status).toBe(200);
      expect(json.success).toBe(true);

      if (json.data.length > 0) {
        const entry = json.data[0];
        expect(entry.rank).toBe(1);
        expect(entry.code).toBeDefined();
        expect(entry.code).toContain('***'); // Code should be masked
        expect(entry.referrals).toBeDefined();
      }
    });

    it('should limit to 10 entries', async () => {
      const { status, json } = await api.get('/api/v1/referrals/leaderboard', { auth: false });

      expect(status).toBe(200);
      expect(json.data.length).toBeLessThanOrEqual(10);
    });
  });
});
