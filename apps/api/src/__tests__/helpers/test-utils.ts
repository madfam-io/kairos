import { sign } from 'hono/jwt';

/**
 * Test utilities for API tests
 */

// Test user data
export const testUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  tier: 'learner' as const,
  emailVerified: true,
};

// Generate a mock JWT token for testing
export async function createMockToken(
  user: typeof testUser = testUser,
  expiresIn = 3600
): Promise<string> {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };

  // Use a test secret - in real tests this should match your JWT_SECRET env var
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only';
  return sign(payload, secret);
}

// Create auth headers
export async function authHeaders(user?: typeof testUser): Promise<Record<string, string>> {
  const token = await createMockToken(user);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// JSON request helper
export function jsonBody(data: unknown): string {
  return JSON.stringify(data);
}

// Assert response shape
export function assertApiResponse(body: unknown): asserts body is {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  meta?: { requestId?: string };
} {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Response body must be an object');
  }
  if (!('success' in body)) {
    throw new Error('Response must have success field');
  }
}

// Assert error response
export function assertErrorResponse(
  body: unknown,
  expectedCode: string
): asserts body is { success: false; error: { code: string; message: string } } {
  assertApiResponse(body);
  if (body.success !== false) {
    throw new Error('Expected error response');
  }
  if (!body.error || body.error.code !== expectedCode) {
    throw new Error(`Expected error code ${expectedCode}, got ${body.error?.code}`);
  }
}

// Wait helper for async operations
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generate random test data
export const generators = {
  uuid: () => crypto.randomUUID(),
  email: () => `test-${crypto.randomUUID().slice(0, 8)}@example.com`,
  word: () => ['学习', '中文', '汉字', '语言', '阅读'][Math.floor(Math.random() * 5)],
  sentence: () =>
    [
      '我喜欢学习中文',
      '今天天气很好',
      '这本书很有意思',
      '我每天都学习',
      '中文很有趣',
    ][Math.floor(Math.random() * 5)],
};
