import { sign } from 'hono/jwt';
import { mock, type Mock } from 'bun:test';

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
  subscriptionTier: 'free' as const,
  subscriptionExpiresAt: null as Date | null,
  settings: {},
  stripeCustomerId: null as string | null,
  stripeSubscriptionId: null as string | null,
  createdAt: new Date(),
};

export const testAdminUser = {
  ...testUser,
  id: 'admin-user-456',
  email: 'admin@example.com',
  name: 'Admin User',
  tier: 'immersion' as const,
  subscriptionTier: 'immersion' as const,
};

// Generate a mock JWT token for testing
export async function createMockToken(
  user: Partial<typeof testUser> = testUser,
  expiresIn = 3600
): Promise<string> {
  const payload = {
    sub: user.id || testUser.id,
    email: user.email || testUser.email,
    name: user.name || testUser.name,
    tier: user.tier || testUser.tier,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };

  // Use a test secret - in real tests this should match your JWT_SECRET env var
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only';
  return sign(payload, secret);
}

// Create auth headers
export async function authHeaders(user?: Partial<typeof testUser>): Promise<Record<string, string>> {
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
  meta?: { requestId?: string; pagination?: unknown };
} {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Response body must be an object');
  }
  if (!('success' in body)) {
    throw new Error('Response must have success field');
  }
}

// Assert successful response
export function assertSuccessResponse<T = unknown>(
  body: unknown
): asserts body is { success: true; data: T } {
  assertApiResponse(body);
  if (body.success !== true) {
    const errorBody = body as { error?: { code: string; message: string } };
    throw new Error(`Expected success response, got error: ${errorBody.error?.message || 'unknown'}`);
  }
}

// Assert error response
export function assertErrorResponse(
  body: unknown,
  expectedCode?: string
): asserts body is { success: false; error: { code: string; message: string } } {
  assertApiResponse(body);
  if (body.success !== false) {
    throw new Error('Expected error response');
  }
  if (expectedCode && body.error?.code !== expectedCode) {
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
  pinyin: () => ['xuéxí', 'zhōngwén', 'hànzì', 'yǔyán', 'yuèdú'][Math.floor(Math.random() * 5)],
  sentence: () =>
    [
      '我喜欢学习中文',
      '今天天气很好',
      '这本书很有意思',
      '我每天都学习',
      '中文很有趣',
    ][Math.floor(Math.random() * 5)],
  hskLevel: () => Math.floor(Math.random() * 6) + 1,
};

// Mock database helper - creates mock functions for db operations
export function createMockDb() {
  return {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          orderBy: mock(() => ({
            limit: mock(() => ({
              offset: mock(() => Promise.resolve([])),
            })),
          })),
          limit: mock(() => Promise.resolve([])),
        })),
        orderBy: mock(() => ({
          limit: mock(() => Promise.resolve([])),
        })),
        limit: mock(() => Promise.resolve([])),
      })),
    })),
    insert: mock(() => ({
      values: mock(() => ({
        returning: mock(() => Promise.resolve([])),
        onConflictDoNothing: mock(() => Promise.resolve()),
        onConflictDoUpdate: mock(() => ({
          returning: mock(() => Promise.resolve([])),
        })),
      })),
    })),
    update: mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          returning: mock(() => Promise.resolve([])),
        })),
      })),
    })),
    delete: mock(() => ({
      where: mock(() => ({
        returning: mock(() => Promise.resolve([])),
      })),
    })),
    query: {
      vocabulary: {
        findFirst: mock(() => Promise.resolve(null)),
        findMany: mock(() => Promise.resolve([])),
      },
      users: {
        findFirst: mock(() => Promise.resolve(null)),
      },
      userStats: {
        findFirst: mock(() => Promise.resolve(null)),
      },
    },
    transaction: mock((fn: (tx: unknown) => Promise<unknown>) => fn({})),
  };
}

// Test vocabulary item
export function createTestVocabulary(overrides: Partial<{
  id: string;
  userId: string;
  word: string;
  pinyin: string;
  definition: string;
  hskLevel: number;
  status: string;
  easeFactor: number;
  nextReview: Date;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: overrides.id || generators.uuid(),
    userId: overrides.userId || testUser.id,
    word: overrides.word || generators.word(),
    pinyin: overrides.pinyin || generators.pinyin(),
    definition: overrides.definition || 'test definition',
    hskLevel: overrides.hskLevel || generators.hskLevel(),
    status: overrides.status || 'new',
    easeFactor: overrides.easeFactor || 2.5,
    nextReview: overrides.nextReview || new Date(),
    reviewCount: overrides.reviewCount || 0,
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
  };
}

// Test card item
export function createTestCard(overrides: Partial<{
  id: string;
  userId: string;
  word: string;
  sentence: string;
  simplifiedSentence: string;
  audioUrl: string;
  imageUrl: string;
  sourceUrl: string;
  sourceTitle: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: overrides.id || generators.uuid(),
    userId: overrides.userId || testUser.id,
    word: overrides.word || generators.word(),
    sentence: overrides.sentence || generators.sentence(),
    simplifiedSentence: overrides.simplifiedSentence || null,
    audioUrl: overrides.audioUrl || null,
    imageUrl: overrides.imageUrl || null,
    sourceUrl: overrides.sourceUrl || 'https://example.com',
    sourceTitle: overrides.sourceTitle || 'Test Source',
    status: overrides.status || 'mined',
    createdAt: overrides.createdAt || new Date(),
    updatedAt: overrides.updatedAt || new Date(),
  };
}

// Test sync change
export function createTestSyncChange(overrides: Partial<{
  id: string;
  userId: string;
  clientId: string;
  collection: string;
  operation: string;
  documentId: string;
  data: Record<string, unknown>;
  vectorClock: Record<string, unknown>;
  createdAt: Date;
  appliedAt: Date;
}> = {}) {
  return {
    id: overrides.id || generators.uuid(),
    userId: overrides.userId || testUser.id,
    clientId: overrides.clientId || 'test-client-1',
    collection: overrides.collection || 'vocabulary',
    operation: overrides.operation || 'create',
    documentId: overrides.documentId || generators.uuid(),
    data: overrides.data || { word: generators.word() },
    vectorClock: overrides.vectorClock || { 'test-client-1': { time: Date.now(), counter: 0 } },
    createdAt: overrides.createdAt || new Date(),
    appliedAt: overrides.appliedAt || new Date(),
  };
}

// Test organization
export function createTestOrganization(overrides: Partial<{
  id: string;
  name: string;
  slug: string;
  type: string;
  ownerId: string;
  isActive: boolean;
  licenseTier: string;
  maxSeats: number;
  usedSeats: number;
}> = {}) {
  return {
    id: overrides.id || generators.uuid(),
    name: overrides.name || 'Test Organization',
    slug: overrides.slug || 'test-org',
    type: overrides.type || 'company',
    ownerId: overrides.ownerId || testUser.id,
    isActive: overrides.isActive ?? true,
    licenseTier: overrides.licenseTier || 'standard',
    maxSeats: overrides.maxSeats || 100,
    usedSeats: overrides.usedSeats || 10,
    licenseExpiresAt: null,
    logoUrl: null,
    domain: null,
    billingEmail: null,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// Request helper for cleaner test syntax
export async function makeRequest(
  app: { request: (path: string, init?: RequestInit) => Promise<Response> },
  method: string,
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    auth?: Partial<typeof testUser> | false;
  } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.auth !== false) {
    const authHeader = await authHeaders(options.auth || testUser);
    Object.assign(headers, authHeader);
  }

  const res = await app.request(path, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json().catch(() => null);

  return { res, json, status: res.status };
}

// FormData request helper
export async function makeFormDataRequest(
  app: { request: (path: string, init?: RequestInit) => Promise<Response> },
  method: string,
  path: string,
  formData: FormData,
  options: {
    headers?: Record<string, string>;
    auth?: Partial<typeof testUser> | false;
  } = {}
) {
  const headers: Record<string, string> = {
    ...options.headers,
  };

  if (options.auth !== false) {
    const token = await createMockToken(options.auth || testUser);
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await app.request(path, {
    method,
    headers,
    body: formData,
  });

  const json = await res.json().catch(() => null);

  return { res, json, status: res.status };
}

// Shorthand request methods
export function createRequestHelpers(app: { request: (path: string, init?: RequestInit) => Promise<Response> }) {
  return {
    get: (path: string, options?: Parameters<typeof makeRequest>[3]) =>
      makeRequest(app, 'GET', path, options),
    post: (path: string, body?: unknown, options?: Parameters<typeof makeRequest>[3]) =>
      makeRequest(app, 'POST', path, { ...options, body }),
    postForm: (path: string, formData: FormData, options?: Parameters<typeof makeFormDataRequest>[4]) =>
      makeFormDataRequest(app, 'POST', path, formData, options),
    patch: (path: string, body?: unknown, options?: Parameters<typeof makeRequest>[3]) =>
      makeRequest(app, 'PATCH', path, { ...options, body }),
    put: (path: string, body?: unknown, options?: Parameters<typeof makeRequest>[3]) =>
      makeRequest(app, 'PUT', path, { ...options, body }),
    delete: (path: string, options?: Parameters<typeof makeRequest>[3]) =>
      makeRequest(app, 'DELETE', path, options),
  };
}
