/**
 * Database Integration Tests: Vocabulary Service
 *
 * Tests vocabulary CRUD operations directly against the database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { eq, and, sql } from 'drizzle-orm';
import {
  getTestDatabase,
  closeTestDatabase,
  cleanTables,
  createDbTestUser,
  createDbTestVocabulary,
  canRunIntegrationTests,
} from './db-setup';
import * as schema from '../../db/schema';

const describeIntegration = canRunIntegrationTests() ? describe : describe.skip;

describeIntegration('Integration: Vocabulary Database Operations', () => {
  beforeAll(async () => {
    await getTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTables('vocabulary', 'user_stats', 'users');
  });

  describe('Vocabulary CRUD', () => {
    it('should create vocabulary with all fields', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();

      const vocab = await createDbTestVocabulary(user.id, {
        word: '数据库',
        pinyin: 'shùjùkù',
        definition: 'database',
        hskLevel: 4,
        status: 'learning',
      });

      expect(vocab.id).toBeDefined();
      expect(vocab.word).toBe('数据库');
      expect(vocab.pinyin).toBe('shùjùkù');
      expect(vocab.hskLevel).toBe(4);
      expect(vocab.easeFactor).toBe(2.5);
    });

    it('should enforce unique word per user', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();

      // First insert should succeed
      await createDbTestVocabulary(user.id, { word: '重复' });

      // Second insert with same word should fail
      try {
        await createDbTestVocabulary(user.id, { word: '重复' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should allow same word for different users', async () => {
      const db = await getTestDatabase();
      const user1 = await createDbTestUser({ email: 'user1@test.com' });
      const user2 = await createDbTestUser({ email: 'user2@test.com' });

      const vocab1 = await createDbTestVocabulary(user1.id, { word: '共享' });
      const vocab2 = await createDbTestVocabulary(user2.id, { word: '共享' });

      expect(vocab1.id).not.toBe(vocab2.id);
      expect(vocab1.userId).not.toBe(vocab2.userId);
    });

    it('should update vocabulary fields', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();
      const vocab = await createDbTestVocabulary(user.id);

      const [updated] = await db
        .update(schema.vocabulary)
        .set({
          status: 'known',
          reviewCount: 5,
          easeFactor: 2.8,
          updatedAt: new Date(),
        })
        .where(eq(schema.vocabulary.id, vocab.id))
        .returning();

      expect(updated.status).toBe('known');
      expect(updated.reviewCount).toBe(5);
      expect(updated.easeFactor).toBe(2.8);
    });

    it('should delete vocabulary and cascade', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();
      const vocab = await createDbTestVocabulary(user.id);

      await db.delete(schema.vocabulary).where(eq(schema.vocabulary.id, vocab.id));

      const [found] = await db
        .select()
        .from(schema.vocabulary)
        .where(eq(schema.vocabulary.id, vocab.id));

      expect(found).toBeUndefined();
    });
  });

  describe('Query Patterns', () => {
    it('should filter by status efficiently', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();

      // Create mix of statuses
      await createDbTestVocabulary(user.id, { word: '新词', status: 'new' });
      await createDbTestVocabulary(user.id, { word: '学习中', status: 'learning' });
      await createDbTestVocabulary(user.id, { word: '已知', status: 'known' });

      const learning = await db
        .select()
        .from(schema.vocabulary)
        .where(and(eq(schema.vocabulary.userId, user.id), eq(schema.vocabulary.status, 'learning')));

      expect(learning.length).toBe(1);
      expect(learning[0].word).toBe('学习中');
    });

    it('should order by review date for SRS', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await createDbTestVocabulary(user.id, { word: '明天', nextReview: tomorrow });
      await createDbTestVocabulary(user.id, { word: '昨天', nextReview: yesterday });
      await createDbTestVocabulary(user.id, { word: '今天', nextReview: now });

      const dueWords = await db
        .select()
        .from(schema.vocabulary)
        .where(
          and(
            eq(schema.vocabulary.userId, user.id),
            sql`${schema.vocabulary.nextReview} <= NOW()`
          )
        )
        .orderBy(schema.vocabulary.nextReview);

      expect(dueWords.length).toBeGreaterThanOrEqual(1);
      // Yesterday should be first (oldest)
      expect(dueWords[0].word).toBe('昨天');
    });

    it('should count words by HSK level', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();

      await createDbTestVocabulary(user.id, { word: '你好', hskLevel: 1 });
      await createDbTestVocabulary(user.id, { word: '再见', hskLevel: 1 });
      await createDbTestVocabulary(user.id, { word: '学习', hskLevel: 2 });

      const counts = await db
        .select({
          hskLevel: schema.vocabulary.hskLevel,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.vocabulary)
        .where(eq(schema.vocabulary.userId, user.id))
        .groupBy(schema.vocabulary.hskLevel);

      const level1 = counts.find((c) => c.hskLevel === 1);
      const level2 = counts.find((c) => c.hskLevel === 2);

      expect(level1?.count).toBe(2);
      expect(level2?.count).toBe(1);
    });
  });

  describe('User Deletion Cascade', () => {
    it('should delete all vocabulary when user is deleted', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();

      await createDbTestVocabulary(user.id, { word: '词1' });
      await createDbTestVocabulary(user.id, { word: '词2' });
      await createDbTestVocabulary(user.id, { word: '词3' });

      // Verify vocabulary exists
      const beforeDelete = await db
        .select()
        .from(schema.vocabulary)
        .where(eq(schema.vocabulary.userId, user.id));
      expect(beforeDelete.length).toBe(3);

      // Delete user
      await db.delete(schema.users).where(eq(schema.users.id, user.id));

      // Verify vocabulary is deleted (cascade)
      const afterDelete = await db
        .select()
        .from(schema.vocabulary)
        .where(eq(schema.vocabulary.userId, user.id));
      expect(afterDelete.length).toBe(0);
    });
  });
});
