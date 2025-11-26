import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../index';

describe('Health Endpoint', () => {
  it('should return healthy status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});
