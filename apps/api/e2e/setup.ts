/**
 * E2E Test Setup
 *
 * Provides utilities for end-to-end testing with a real test database.
 * Tests run against a PostgreSQL test database and clean up after themselves.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { app } from '../src/index';
import { sign } from 'hono/jwt';

// Test database URL - must be a separate database from production!
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!TEST_DATABASE_URL) {
  console.warn('TEST_DATABASE_URL not set, E2E tests will be skipped');
}

// Test database client
let testClient: ReturnType<typeof postgres> | null = null;
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Initialize test database connection
 */
export async function setupTestDatabase() {
  if (!TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is required for E2E tests');
  }

  testClient = postgres(TEST_DATABASE_URL, { max: 5 });
  testDb = drizzle(testClient, { schema });

  return testDb;
}

/**
 * Get the test database instance
 */
export function getTestDb() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
}

/**
 * Clean up test database connection
 */
export async function teardownTestDatabase() {
  if (testClient) {
    await testClient.end();
    testClient = null;
    testDb = null;
  }
}

/**
 * Clean all test data from the database
 * Uses TRUNCATE with CASCADE to clear all tables
 */
export async function cleanTestData() {
  if (!testDb) return;

  // Truncate tables in reverse dependency order
  const tables = [
    'webhook_deliveries',
    'webhook_endpoints',
    'api_usage_logs',
    'oauth_authorization_codes',
    'oauth_tokens',
    'api_keys',
    'api_applications',
    'lti_launches',
    'lti_platforms',
    'external_integrations',
    'organization_license_history',
    'organization_audit_logs',
    'organization_sso_configs',
    'organization_decks',
    'organization_invites',
    'organization_members',
    'organization_departments',
    'organizations',
    'learning_insights',
    'content_consumption',
    'learning_goals',
    'word_mastery',
    'review_sessions',
    'daily_stats',
    'assignment_progress',
    'classroom_assignments',
    'classroom_students',
    'classrooms',
    'referral_usages',
    'referral_codes',
    'user_deck_downloads',
    'shared_deck_likes',
    'shared_deck_words',
    'shared_decks',
    'grammar_patterns',
    'user_stats',
    'sync_changes',
    'analytics_events',
    'show_simplifications',
    'simplification_cache',
    'cards',
    'vocabulary',
    'users',
  ];

  for (const table of tables) {
    try {
      await testDb.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`));
    } catch {
      // Table might not exist, continue
    }
  }
}

/**
 * Create a test user in the database
 */
export async function createTestUser(overrides: Partial<typeof schema.users.$inferInsert> = {}) {
  const db = getTestDb();
  const userId = crypto.randomUUID();

  const [user] = await db
    .insert(schema.users)
    .values({
      id: userId,
      email: overrides.email || `test-${userId.slice(0, 8)}@example.com`,
      subscriptionTier: overrides.subscriptionTier || 'free',
      settings: overrides.settings || {},
      ...overrides,
    })
    .returning();

  return user;
}

/**
 * Generate a valid JWT token for a test user
 */
export async function createAuthToken(userId: string, email: string, tier: string = 'free') {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only';
  const payload = {
    sub: userId,
    email,
    tier,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return sign(payload, secret);
}

/**
 * Create request helpers for E2E tests
 */
export function createE2ERequestHelpers(authToken?: string) {
  const makeRequest = async (
    method: string,
    path: string,
    options: { body?: unknown; headers?: Record<string, string> } = {}
  ) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const res = await app.request(path, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const json = await res.json().catch(() => null);
    return { res, json, status: res.status };
  };

  return {
    get: (path: string, options?: { headers?: Record<string, string> }) =>
      makeRequest('GET', path, options),
    post: (path: string, body?: unknown, options?: { headers?: Record<string, string> }) =>
      makeRequest('POST', path, { body, ...options }),
    patch: (path: string, body?: unknown, options?: { headers?: Record<string, string> }) =>
      makeRequest('PATCH', path, { body, ...options }),
    put: (path: string, body?: unknown, options?: { headers?: Record<string, string> }) =>
      makeRequest('PUT', path, { body, ...options }),
    delete: (path: string, options?: { headers?: Record<string, string> }) =>
      makeRequest('DELETE', path, options),
  };
}

/**
 * Test data generators for E2E tests
 */
export const e2eGenerators = {
  uuid: () => crypto.randomUUID(),
  email: () => `e2e-${crypto.randomUUID().slice(0, 8)}@example.com`,
  word: () => ['学习', '中文', '汉字', '语言', '阅读', '写作', '听力'][Math.floor(Math.random() * 7)],
  pinyin: () => ['xuéxí', 'zhōngwén', 'hànzì', 'yǔyán', 'yuèdú', 'xiězuò', 'tīnglì'][Math.floor(Math.random() * 7)],
  sentence: () => [
    '我喜欢学习中文',
    '今天天气很好',
    '这本书很有意思',
    '我每天都学习',
    '中文很有趣',
    '明天见',
    '你好世界',
  ][Math.floor(Math.random() * 7)],
  hskLevel: () => Math.floor(Math.random() * 6) + 1,
  deckName: () => `Test Deck ${crypto.randomUUID().slice(0, 8)}`,
  classroomName: () => `Test Classroom ${crypto.randomUUID().slice(0, 8)}`,
};

/**
 * Wait helper for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if E2E tests can run (database is available)
 */
export function canRunE2ETests(): boolean {
  return !!TEST_DATABASE_URL;
}
