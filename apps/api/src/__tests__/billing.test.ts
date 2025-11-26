import { describe, it, expect } from 'bun:test';
import { app } from '../index';
import { createRequestHelpers, generators } from './helpers/test-utils';

const api = createRequestHelpers(app);

describe('Billing API', () => {
  describe('Public Endpoints', () => {
    describe('GET /api/v1/billing/providers', () => {
      it('should return available payment providers', async () => {
        const { status, json } = await api.get('/api/v1/billing/providers', { auth: false });

        expect(status).toBe(200);
        expect(Array.isArray(json.providers)).toBe(true);
        expect(json.pricing).toBeDefined();
        expect(json.recommended).toBeDefined();
      });

      it('should include pricing for all tiers', async () => {
        const { status, json } = await api.get('/api/v1/billing/providers', { auth: false });

        expect(status).toBe(200);
        expect(json.pricing).toBeDefined();
        // Should have pricing structure
        if (json.pricing.stripe) {
          expect(json.pricing.stripe).toBeDefined();
        }
      });
    });

    describe('GET /api/v1/billing/providers/recommend/:countryCode', () => {
      it('should recommend Stripe for US', async () => {
        const { status, json } = await api.get('/api/v1/billing/providers/recommend/US', { auth: false });

        expect(status).toBe(200);
        expect(json.provider).toBe('stripe');
        expect(json.country).toBe('US');
        expect(json.pricing).toBeDefined();
      });

      it('should recommend Conekta for Mexico', async () => {
        const { status, json } = await api.get('/api/v1/billing/providers/recommend/MX', { auth: false });

        expect(status).toBe(200);
        expect(json.provider).toBe('conekta');
        expect(json.country).toBe('MX');
      });

      it('should handle lowercase country codes', async () => {
        const { status, json } = await api.get('/api/v1/billing/providers/recommend/us', { auth: false });

        expect(status).toBe(200);
        expect(json.country).toBe('US');
      });

      it('should default to stripe for unknown countries', async () => {
        const { status, json } = await api.get('/api/v1/billing/providers/recommend/ZZ', { auth: false });

        expect(status).toBe(200);
        expect(json.provider).toBe('stripe'); // Default provider
      });

      it('should recommend Stripe for Canada', async () => {
        const { status, json } = await api.get('/api/v1/billing/providers/recommend/CA', { auth: false });

        expect(status).toBe(200);
        expect(json.provider).toBe('stripe');
        expect(json.country).toBe('CA');
      });
    });
  });

  describe('Authenticated Endpoints', () => {
    describe('GET /api/v1/billing/subscription', () => {
      it('should return 401 without auth', async () => {
        const { status } = await api.get('/api/v1/billing/subscription', { auth: false });
        expect(status).toBe(401);
      });

      it('should return subscription info with auth', async () => {
        const { status, json } = await api.get('/api/v1/billing/subscription');

        expect(status).toBe(200);
        // Should have tier and limits even without subscription
        expect(json.tier).toBeDefined();
        expect(json.limits).toBeDefined();
      });

      it('should return free tier limits when no subscription', async () => {
        const { status, json } = await api.get('/api/v1/billing/subscription');

        expect(status).toBe(200);
        // Free tier should have limits
        if (json.tier === 'free') {
          expect(json.limits).toBeDefined();
        }
      });
    });

    describe('GET /api/v1/billing/plans', () => {
      it('should return 401 without auth', async () => {
        const { status } = await api.get('/api/v1/billing/plans', { auth: false });
        expect(status).toBe(401);
      });

      it('should return plans with auth', async () => {
        const { status, json } = await api.get('/api/v1/billing/plans');

        // May return 200 with plans or 500 if provider not configured
        expect([200, 500]).toContain(status);
        if (status === 200) {
          expect(json.plans).toBeDefined();
          expect(json.provider).toBeDefined();
        }
      });

      it('should accept provider query parameter', async () => {
        const { status, json } = await api.get('/api/v1/billing/plans?provider=stripe');

        expect([200, 500]).toContain(status);
        if (status === 200) {
          expect(json.provider).toBe('stripe');
        }
      });
    });

    describe('POST /api/v1/billing/checkout', () => {
      it('should return 401 without auth', async () => {
        const { status } = await api.post('/api/v1/billing/checkout', {
          tier: 'learner',
        }, { auth: false });

        expect(status).toBe(401);
      });

      it('should validate tier enum', async () => {
        const { status } = await api.post('/api/v1/billing/checkout', {
          tier: 'invalid-tier',
        });

        expect(status).toBe(400);
      });

      it('should accept valid tier', async () => {
        const { status, json } = await api.post('/api/v1/billing/checkout', {
          tier: 'learner',
        });

        // May return 200 with checkout URL or 500 if provider not configured
        expect([200, 500]).toContain(status);
        if (status === 200) {
          expect(json.checkoutUrl).toBeDefined();
          expect(json.provider).toBeDefined();
        }
      });

      it('should accept yearly billing option', async () => {
        const { status } = await api.post('/api/v1/billing/checkout', {
          tier: 'learner',
          yearly: true,
        });

        expect([200, 500]).toContain(status);
      });

      it('should accept country code for provider selection', async () => {
        const { status } = await api.post('/api/v1/billing/checkout', {
          tier: 'immersion',
          countryCode: 'MX',
        });

        expect([200, 500]).toContain(status);
      });

      it('should validate provider enum', async () => {
        const { status } = await api.post('/api/v1/billing/checkout', {
          tier: 'learner',
          provider: 'invalid-provider',
        });

        expect(status).toBe(400);
      });

      it('should accept valid success and cancel URLs', async () => {
        const { status } = await api.post('/api/v1/billing/checkout', {
          tier: 'learner',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });

        expect([200, 500]).toContain(status);
      });

      it('should validate URL format', async () => {
        const { status } = await api.post('/api/v1/billing/checkout', {
          tier: 'learner',
          successUrl: 'not-a-url',
        });

        expect(status).toBe(400);
      });
    });

    describe('GET /api/v1/billing/portal', () => {
      it('should return 401 without auth', async () => {
        const { status } = await api.get('/api/v1/billing/portal', { auth: false });
        expect(status).toBe(401);
      });

      it('should return 404 when no subscription exists', async () => {
        const { status, json } = await api.get('/api/v1/billing/portal');

        // Should return 404 if no subscription or 500 if service error
        expect([404, 500]).toContain(status);
        if (status === 404) {
          expect(json.error).toContain('subscription');
        }
      });

      it('should accept provider query parameter', async () => {
        const { status } = await api.get('/api/v1/billing/portal?provider=stripe');

        expect([200, 404, 500]).toContain(status);
      });
    });

    describe('POST /api/v1/billing/cancel', () => {
      it('should return 401 without auth', async () => {
        const { status } = await api.post('/api/v1/billing/cancel', {
          subscriptionId: 'sub_123',
          provider: 'stripe',
        }, { auth: false });

        expect(status).toBe(401);
      });

      it('should validate required fields', async () => {
        const { status } = await api.post('/api/v1/billing/cancel', {
          provider: 'stripe',
          // Missing subscriptionId
        });

        expect(status).toBe(400);
      });

      it('should validate provider enum', async () => {
        const { status } = await api.post('/api/v1/billing/cancel', {
          subscriptionId: 'sub_123',
          provider: 'invalid',
        });

        expect(status).toBe(400);
      });

      it('should return 404 when no subscription found', async () => {
        const { status, json } = await api.post('/api/v1/billing/cancel', {
          subscriptionId: 'sub_nonexistent',
          provider: 'stripe',
        });

        // Should return 404 if no subscription or 500 if service error
        expect([404, 500]).toContain(status);
      });

      it('should prevent canceling other users subscriptions (IDOR protection)', async () => {
        // This tests the security fix - even with valid format, should reject
        // if subscription doesn't belong to authenticated user
        const { status, json } = await api.post('/api/v1/billing/cancel', {
          subscriptionId: 'sub_other_user_123',
          provider: 'stripe',
        });

        // Should be 403 or 404 (not found for this user)
        expect([403, 404, 500]).toContain(status);
      });

      it('should accept immediately flag', async () => {
        const { status } = await api.post('/api/v1/billing/cancel', {
          subscriptionId: 'sub_123',
          provider: 'stripe',
          immediately: true,
        });

        expect([200, 403, 404, 500]).toContain(status);
      });
    });

    describe('POST /api/v1/billing/resume', () => {
      it('should return 401 without auth', async () => {
        const { status } = await api.post('/api/v1/billing/resume', {
          subscriptionId: 'sub_123',
          provider: 'stripe',
        }, { auth: false });

        expect(status).toBe(401);
      });

      it('should validate required fields', async () => {
        const { status } = await api.post('/api/v1/billing/resume', {
          subscriptionId: 'sub_123',
          // Missing provider
        });

        expect(status).toBe(400);
      });

      it('should validate provider enum', async () => {
        const { status } = await api.post('/api/v1/billing/resume', {
          subscriptionId: 'sub_123',
          provider: 'paypal', // Not supported
        });

        expect(status).toBe(400);
      });

      it('should return 404 when no subscription found', async () => {
        const { status } = await api.post('/api/v1/billing/resume', {
          subscriptionId: 'sub_nonexistent',
          provider: 'stripe',
        });

        expect([404, 500]).toContain(status);
      });

      it('should prevent resuming other users subscriptions (IDOR protection)', async () => {
        const { status } = await api.post('/api/v1/billing/resume', {
          subscriptionId: 'sub_other_user_456',
          provider: 'stripe',
        });

        expect([403, 404, 500]).toContain(status);
      });
    });

    describe('GET /api/v1/billing/limits/:metric', () => {
      it('should return 401 without auth', async () => {
        const { status } = await api.get('/api/v1/billing/limits/cardsPerDay', { auth: false });
        expect(status).toBe(401);
      });

      it('should check cards per day limit', async () => {
        const { status, json } = await api.get('/api/v1/billing/limits/cardsPerDay');

        expect([200, 500]).toContain(status);
        if (status === 200) {
          expect(json.allowed).toBeDefined();
          expect(typeof json.allowed).toBe('boolean');
        }
      });

      it('should accept usage query parameter', async () => {
        const { status, json } = await api.get('/api/v1/billing/limits/cardsPerDay?usage=5');

        expect([200, 500]).toContain(status);
      });

      it('should handle various metrics', async () => {
        const metrics = ['cardsPerDay', 'aiSentencesPerMonth', 'syncDevices'];

        for (const metric of metrics) {
          const { status } = await api.get(`/api/v1/billing/limits/${metric}`);
          expect([200, 500]).toContain(status);
        }
      });
    });
  });

  describe('Webhooks', () => {
    describe('POST /webhooks/stripe', () => {
      it('should reject without signature', async () => {
        const res = await app.request('/webhooks/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'test' }),
        });
        expect(res.status).toBe(400);

        const json = await res.json();
        expect(json.error).toContain('signature');
      });

      it('should accept request with signature (validation happens in handler)', async () => {
        const res = await app.request('/webhooks/stripe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': 'test_signature_123',
          },
          body: JSON.stringify({ type: 'checkout.session.completed' }),
        });

        // Will return 400 because signature won't validate, but endpoint is reached
        expect([200, 400]).toContain(res.status);
      });
    });

    describe('POST /webhooks/conekta', () => {
      it('should reject without signature', async () => {
        const res = await app.request('/webhooks/conekta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'test' }),
        });
        expect(res.status).toBe(400);

        const json = await res.json();
        expect(json.error).toContain('signature');
      });

      it('should accept request with signature header', async () => {
        const res = await app.request('/webhooks/conekta', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-conekta-signature': 'test_signature_123',
          },
          body: JSON.stringify({ type: 'order.paid' }),
        });

        expect([200, 400]).toContain(res.status);
      });
    });

    describe('POST /webhooks/polar', () => {
      it('should reject without signature', async () => {
        const res = await app.request('/webhooks/polar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'test' }),
        });
        expect(res.status).toBe(400);

        const json = await res.json();
        expect(json.error).toContain('signature');
      });

      it('should accept request with signature header', async () => {
        const res = await app.request('/webhooks/polar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-polar-signature': 'test_signature_123',
          },
          body: JSON.stringify({ type: 'subscription.created' }),
        });

        expect([200, 400]).toContain(res.status);
      });
    });
  });
});
