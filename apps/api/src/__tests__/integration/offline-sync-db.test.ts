/**
 * Database Integration Tests: Offline Sync Service
 *
 * Tests offline sync operations including:
 * - Sync queue processing
 * - Delta change detection
 * - Conflict resolution
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { eq, and, sql } from 'drizzle-orm';
import {
  getTestDatabase,
  closeTestDatabase,
  cleanTables,
  createDbTestUser,
  createDbTestVocabulary,
  createDbTestCard,
  canRunIntegrationTests,
} from './db-setup';
import * as schema from '../../db/schema';
import {
  generateVocabularyPack,
  generateCardsPack,
  getChangesSince,
  processSyncQueue,
  calculateChecksum,
  type SyncQueueItem,
} from '../../services/offline';

const describeIntegration = canRunIntegrationTests() ? describe : describe.skip;

describeIntegration('Integration: Offline Sync Database Operations', () => {
  beforeAll(async () => {
    await getTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTables('sync_changes', 'cards', 'vocabulary', 'user_stats', 'users');
  });

  describe('Vocabulary Pack Generation', () => {
    it('should generate vocabulary pack for user', async () => {
      const user = await createDbTestUser();

      await createDbTestVocabulary(user.id, { word: '同步', definition: 'to sync' });
      await createDbTestVocabulary(user.id, { word: '离线', definition: 'offline' });
      await createDbTestVocabulary(user.id, { word: '数据', definition: 'data' });

      const pack = await generateVocabularyPack(user.id);

      expect(pack.version).toBeDefined();
      expect(pack.words.length).toBe(3);
      expect(pack.words.some((w) => w.word === '同步')).toBe(true);
      expect(pack.words.some((w) => w.word === '离线')).toBe(true);
    });

    it('should return empty pack for user with no vocabulary', async () => {
      const user = await createDbTestUser();

      const pack = await generateVocabularyPack(user.id);

      expect(pack.words.length).toBe(0);
      expect(pack.version).toBeDefined();
    });

    it('should include all required fields in vocabulary pack', async () => {
      const user = await createDbTestUser();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await createDbTestVocabulary(user.id, {
        word: '完整',
        pinyin: 'wánzhěng',
        definition: 'complete',
        hskLevel: 3,
        status: 'learning',
        easeFactor: 2.7,
        nextReview: tomorrow,
        reviewCount: 5,
      });

      const pack = await generateVocabularyPack(user.id);
      const word = pack.words[0];

      expect(word.id).toBeDefined();
      expect(word.word).toBe('完整');
      expect(word.pinyin).toBe('wánzhěng');
      expect(word.definition).toBe('complete');
      expect(word.hskLevel).toBe(3);
      expect(word.status).toBe('learning');
      expect(word.easeFactor).toBe(2.7);
      expect(word.nextReview).toBeDefined();
      expect(word.reviewCount).toBe(5);
      expect(word.createdAt).toBeDefined();
      expect(word.updatedAt).toBeDefined();
    });
  });

  describe('Cards Pack Generation', () => {
    it('should generate cards pack for user', async () => {
      const user = await createDbTestUser();

      await createDbTestCard(user.id, { word: '卡片1', sentence: '第一个卡片' });
      await createDbTestCard(user.id, { word: '卡片2', sentence: '第二个卡片' });

      const pack = await generateCardsPack(user.id);

      expect(pack.version).toBeDefined();
      expect(pack.cards.length).toBe(2);
    });

    it('should include export status in cards pack', async () => {
      const user = await createDbTestUser();

      await createDbTestCard(user.id, { word: '已导出', exportedToAnki: true });
      await createDbTestCard(user.id, { word: '未导出', exportedToAnki: false });

      const pack = await generateCardsPack(user.id);

      const exported = pack.cards.find((c) => c.word === '已导出');
      const notExported = pack.cards.find((c) => c.word === '未导出');

      expect(exported?.exportedToAnki).toBe(true);
      expect(notExported?.exportedToAnki).toBe(false);
    });
  });

  describe('Delta Change Detection', () => {
    it('should detect vocabulary changes since timestamp', async () => {
      const user = await createDbTestUser();

      // Create a word at a known time
      const pastTime = Date.now() - 60000; // 1 minute ago
      await createDbTestVocabulary(user.id, { word: '旧词' });

      // Record the "since" time
      const sinceTime = Date.now();

      // Wait a tiny bit then create new word
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createDbTestVocabulary(user.id, { word: '新词' });

      const changes = await getChangesSince(user.id, 'vocabulary', sinceTime);

      expect(changes.currentVersion).toBeGreaterThan(sinceTime);
      // New word should be in changes
      expect(changes.changes.some((c) => c.data?.word === '新词')).toBe(true);
    });

    it('should return empty changes when nothing changed', async () => {
      const user = await createDbTestUser();

      await createDbTestVocabulary(user.id, { word: '不变' });

      // Get changes from future time
      const futureTime = Date.now() + 60000;
      const changes = await getChangesSince(user.id, 'vocabulary', futureTime);

      expect(changes.changes.length).toBe(0);
    });
  });

  describe('Sync Queue Processing', () => {
    it('should process vocabulary create operations', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();

      const documentId = crypto.randomUUID();
      const syncItems: SyncQueueItem[] = [
        {
          id: crypto.randomUUID(),
          operation: 'create',
          collection: 'vocabulary',
          documentId,
          data: {
            word: '同步创建',
            pinyin: 'tóngbù chuàngjiàn',
            definition: 'sync create',
          },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      const result = await processSyncQueue(user.id, syncItems);

      expect(result.processed).toBe(1);
      expect(result.failed.length).toBe(0);

      // Verify word was created
      const [created] = await db
        .select()
        .from(schema.vocabulary)
        .where(eq(schema.vocabulary.id, documentId));

      expect(created).toBeDefined();
      expect(created.word).toBe('同步创建');
    });

    it('should process vocabulary update operations', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();
      const vocab = await createDbTestVocabulary(user.id, { word: '更新前', status: 'new' });

      const syncItems: SyncQueueItem[] = [
        {
          id: crypto.randomUUID(),
          operation: 'update',
          collection: 'vocabulary',
          documentId: vocab.id,
          data: {
            status: 'known',
            definition: 'updated definition',
          },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      const result = await processSyncQueue(user.id, syncItems);

      expect(result.processed).toBe(1);

      // Verify update
      const [updated] = await db
        .select()
        .from(schema.vocabulary)
        .where(eq(schema.vocabulary.id, vocab.id));

      expect(updated.status).toBe('known');
      expect(updated.definition).toBe('updated definition');
    });

    it('should process vocabulary delete operations', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();
      const vocab = await createDbTestVocabulary(user.id, { word: '删除我' });

      const syncItems: SyncQueueItem[] = [
        {
          id: crypto.randomUUID(),
          operation: 'delete',
          collection: 'vocabulary',
          documentId: vocab.id,
          data: {},
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      const result = await processSyncQueue(user.id, syncItems);

      expect(result.processed).toBe(1);

      // Verify deletion
      const [deleted] = await db
        .select()
        .from(schema.vocabulary)
        .where(eq(schema.vocabulary.id, vocab.id));

      expect(deleted).toBeUndefined();
    });

    it('should handle mixed operations batch', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();

      const existingVocab = await createDbTestVocabulary(user.id, { word: '已存在' });
      const toDelete = await createDbTestVocabulary(user.id, { word: '待删除' });

      const newId = crypto.randomUUID();
      const syncItems: SyncQueueItem[] = [
        {
          id: crypto.randomUUID(),
          operation: 'create',
          collection: 'vocabulary',
          documentId: newId,
          data: { word: '新建' },
          timestamp: Date.now(),
          retryCount: 0,
        },
        {
          id: crypto.randomUUID(),
          operation: 'update',
          collection: 'vocabulary',
          documentId: existingVocab.id,
          data: { status: 'known' },
          timestamp: Date.now(),
          retryCount: 0,
        },
        {
          id: crypto.randomUUID(),
          operation: 'delete',
          collection: 'vocabulary',
          documentId: toDelete.id,
          data: {},
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];

      const result = await processSyncQueue(user.id, syncItems);

      expect(result.processed).toBe(3);
      expect(result.failed.length).toBe(0);
    });
  });

  describe('Checksum Verification', () => {
    it('should generate consistent checksums', async () => {
      const user = await createDbTestUser();

      await createDbTestVocabulary(user.id, { word: '校验' });

      const pack1 = await generateVocabularyPack(user.id);
      const pack2 = await generateVocabularyPack(user.id);

      // Same data should produce same checksum
      const checksum1 = calculateChecksum(pack1.words);
      const checksum2 = calculateChecksum(pack2.words);

      expect(checksum1).toBe(checksum2);
    });

    it('should detect data changes via checksum', async () => {
      const db = await getTestDatabase();
      const user = await createDbTestUser();

      await createDbTestVocabulary(user.id, { word: '原始' });

      const pack1 = await generateVocabularyPack(user.id);
      const checksum1 = calculateChecksum(pack1.words);

      // Modify the data
      await db
        .update(schema.vocabulary)
        .set({ definition: 'modified' })
        .where(eq(schema.vocabulary.userId, user.id));

      const pack2 = await generateVocabularyPack(user.id);
      const checksum2 = calculateChecksum(pack2.words);

      expect(checksum1).not.toBe(checksum2);
    });
  });
});
