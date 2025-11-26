import { describe, it, expect } from 'bun:test';
import { app } from '../index';

describe('Observability Endpoints', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.version).toBeDefined();
      expect(body.timestamp).toBeDefined();
      expect(body.environment).toBeDefined();
    });

    it('should include request ID header', async () => {
      const res = await app.request('/health');
      const requestId = res.headers.get('X-Request-Id');
      expect(requestId).toBeDefined();
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should use provided request ID', async () => {
      const customId = 'custom-request-id-123';
      const res = await app.request('/health', {
        headers: { 'X-Request-Id': customId },
      });
      expect(res.headers.get('X-Request-Id')).toBe(customId);
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const res = await app.request('/metrics');
      expect(res.status).toBe(200);

      const contentType = res.headers.get('Content-Type');
      expect(contentType).toContain('text/plain');

      const body = await res.text();
      expect(body).toContain('# HELP');
      expect(body).toContain('# TYPE');
      expect(body).toContain('process_uptime_seconds');
      expect(body).toContain('http_requests_total');
    });

    it('should include histogram buckets', async () => {
      // Make a request first to populate metrics
      await app.request('/health');

      const res = await app.request('/metrics');
      const body = await res.text();

      expect(body).toContain('http_request_duration_ms_bucket');
      expect(body).toContain('le="100"');
      expect(body).toContain('le="500"');
    });
  });

  describe('GET /metrics/json', () => {
    it('should return JSON metrics', async () => {
      const res = await app.request('/metrics/json');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.uptime).toBeGreaterThan(0);
      expect(body.requests).toBeDefined();
      expect(body.errors).toBeDefined();
      expect(body.memory).toBeDefined();
      expect(body.memory.heapUsed).toBeGreaterThan(0);
    });
  });

  describe('GET /ready', () => {
    it('should check database connectivity', async () => {
      const res = await app.request('/ready');

      // May return 200 or 503 depending on DB availability
      expect([200, 503].includes(res.status)).toBe(true);

      const body = await res.json();
      expect(body.status).toMatch(/^(ready|not_ready)$/);
      expect(body.timestamp).toBeDefined();
      expect(body.checks).toBeDefined();
      expect(body.checks.database).toMatch(/^(ok|failed)$/);
    });
  });
});

describe('Security Headers', () => {
  it('should include security headers', async () => {
    const res = await app.request('/health');

    // Hono's secureHeaders middleware
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBeDefined();
  });

  it('should include rate limit headers on API routes', async () => {
    const res = await app.request('/api/v1/user');

    // Rate limit headers should be present
    expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });
});

describe('Error Handling', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await app.request('/api/v1/nonexistent-endpoint');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.meta.requestId).toBeDefined();
  });

  it('should return 401 for protected routes without auth', async () => {
    const res = await app.request('/api/v1/user');
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });
});

describe('CORS', () => {
  it('should handle preflight requests', async () => {
    const res = await app.request('/api/v1/cards', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    expect(res.headers.get('Access-Control-Allow-Methods')).toBeDefined();
  });
});
