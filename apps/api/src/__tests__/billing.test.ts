import { describe, it, expect } from 'bun:test';
import { app } from '../index';

describe('Billing API', () => {
  describe('GET /api/v1/billing/providers', () => {
    it('should return available payment providers', async () => {
      const res = await app.request('/api/v1/billing/providers');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.providers)).toBe(true);
      expect(body.pricing).toBeDefined();
    });
  });

  describe('GET /api/v1/billing/providers/recommend/:countryCode', () => {
    it('should recommend Stripe for US', async () => {
      const res = await app.request('/api/v1/billing/providers/recommend/US');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.provider).toBe('stripe');
      expect(body.country).toBe('US');
    });

    it('should recommend Conekta for Mexico', async () => {
      const res = await app.request('/api/v1/billing/providers/recommend/MX');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.provider).toBe('conekta');
      expect(body.country).toBe('MX');
    });

    it('should handle lowercase country codes', async () => {
      const res = await app.request('/api/v1/billing/providers/recommend/us');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.country).toBe('US');
    });
  });

  describe('GET /api/v1/billing/subscription', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/v1/billing/subscription');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/billing/checkout', () => {
    it('should return 401 without auth', async () => {
      const res = await app.request('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: 'learner',
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Webhooks', () => {
    it('should reject Stripe webhook without signature', async () => {
      const res = await app.request('/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test' }),
      });
      expect(res.status).toBe(400);
    });

    it('should reject Conekta webhook without signature', async () => {
      const res = await app.request('/webhooks/conekta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test' }),
      });
      expect(res.status).toBe(400);
    });

    it('should reject Polar webhook without signature', async () => {
      const res = await app.request('/webhooks/polar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test' }),
      });
      expect(res.status).toBe(400);
    });
  });
});
