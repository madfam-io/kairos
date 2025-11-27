/**
 * Database Integration Test Setup
 *
 * Provides utilities for integration tests that require database access.
 * Tests use a real PostgreSQL database connection but clean up after themselves.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from '../../db/schema';

// Test database URL
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

// Singleton database connection
let testClient: ReturnType<typeof postgres> | null = null;
let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Check if integration tests can run
 */
export function canRunIntegrationTests(): boolean {
  return !!TEST_DATABASE_URL;
}

/**
 * Get or create test database connection
 */
export async function getTestDatabase() {
  if (testDb) return testDb;

  if (!TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL is required for integration tests');
  }

  testClient = postgres(TEST_DATABASE_URL, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  testDb = drizzle(testClient, { schema });
  return testDb;
}

/**
 * Close test database connection
 */
export async function closeTestDatabase() {
  if (testClient) {
    await testClient.end();
    testClient = null;
    testDb = null;
  }
}

/**
 * Clean specific tables (faster than full truncate)
 */
export async function cleanTables(...tableNames: string[]) {
  if (!testDb) return;

  for (const table of tableNames) {
    try {
      await testDb.execute(sql.raw(`DELETE FROM "${table}"`));
    } catch (error) {
      // Table might not exist
      console.warn(`Could not clean table ${table}:`, error);
    }
  }
}

/**
 * Create a test user directly in the database
 */
export async function createDbTestUser(
  overrides: Partial<typeof schema.users.$inferInsert> = {}
) {
  const db = await getTestDatabase();
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
 * Create test vocabulary entry
 */
export async function createDbTestVocabulary(
  userId: string,
  overrides: Partial<typeof schema.vocabulary.$inferInsert> = {}
) {
  const db = await getTestDatabase();

  const [vocab] = await db
    .insert(schema.vocabulary)
    .values({
      userId,
      word: overrides.word || '测试',
      pinyin: overrides.pinyin || 'cèshì',
      definition: overrides.definition || 'test',
      hskLevel: overrides.hskLevel || 1,
      status: overrides.status || 'learning',
      easeFactor: overrides.easeFactor || 2.5,
      reviewCount: overrides.reviewCount || 0,
      ...overrides,
    })
    .returning();

  return vocab;
}

/**
 * Create test card entry
 */
export async function createDbTestCard(
  userId: string,
  overrides: Partial<typeof schema.cards.$inferInsert> = {}
) {
  const db = await getTestDatabase();

  const [card] = await db
    .insert(schema.cards)
    .values({
      userId,
      word: overrides.word || '测试词',
      sentence: overrides.sentence || '这是一个测试句子。',
      exportedToAnki: overrides.exportedToAnki || false,
      ...overrides,
    })
    .returning();

  return card;
}

/**
 * Create test shared deck
 */
export async function createDbTestDeck(
  authorId: string,
  overrides: Partial<typeof schema.sharedDecks.$inferInsert> = {}
) {
  const db = await getTestDatabase();

  const [deck] = await db
    .insert(schema.sharedDecks)
    .values({
      authorId,
      name: overrides.name || 'Test Deck',
      description: overrides.description || 'A test deck',
      isPublic: overrides.isPublic ?? false,
      category: overrides.category || 'custom',
      wordCount: overrides.wordCount || 0,
      ...overrides,
    })
    .returning();

  return deck;
}

/**
 * Create test classroom
 */
export async function createDbTestClassroom(
  tutorId: string,
  overrides: Partial<typeof schema.classrooms.$inferInsert> = {}
) {
  const db = await getTestDatabase();

  const [classroom] = await db
    .insert(schema.classrooms)
    .values({
      tutorId,
      name: overrides.name || 'Test Classroom',
      description: overrides.description || 'A test classroom',
      joinCode: overrides.joinCode || crypto.randomUUID().slice(0, 8).toUpperCase(),
      maxStudents: overrides.maxStudents || 30,
      isActive: overrides.isActive ?? true,
      settings: overrides.settings || {},
      ...overrides,
    })
    .returning();

  return classroom;
}

/**
 * Create test organization
 */
export async function createDbTestOrganization(
  overrides: Partial<typeof schema.organizations.$inferInsert> = {}
) {
  const db = await getTestDatabase();

  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: overrides.name || 'Test Organization',
      slug: overrides.slug || `test-org-${crypto.randomUUID().slice(0, 8)}`,
      type: overrides.type || 'company',
      licenseTier: overrides.licenseTier || 'standard',
      maxSeats: overrides.maxSeats || 50,
      usedSeats: overrides.usedSeats || 0,
      isActive: overrides.isActive ?? true,
      ...overrides,
    })
    .returning();

  return org;
}

/**
 * Add user to organization
 */
export async function addUserToOrganization(
  organizationId: string,
  userId: string,
  role: 'owner' | 'admin' | 'instructor' | 'member' = 'member'
) {
  const db = await getTestDatabase();

  const [member] = await db
    .insert(schema.organizationMembers)
    .values({
      organizationId,
      userId,
      role,
      isActive: true,
    })
    .returning();

  return member;
}

/**
 * Test data generators
 */
export const dbGenerators = {
  uuid: () => crypto.randomUUID(),
  email: () => `int-test-${crypto.randomUUID().slice(0, 8)}@example.com`,
  word: () => ['学习', '中文', '汉字', '语言', '阅读'][Math.floor(Math.random() * 5)],
  pinyin: () => ['xuéxí', 'zhōngwén', 'hànzì', 'yǔyán', 'yuèdú'][Math.floor(Math.random() * 5)],
};
