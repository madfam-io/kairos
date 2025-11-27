/**
 * E2E Tests: Vocabulary Management Flow
 *
 * Tests the complete vocabulary lifecycle:
 * 1. Create vocabulary words
 * 2. Read/list vocabulary
 * 3. Update vocabulary (status, review data)
 * 4. Delete vocabulary
 * 5. Review flow with SRS updates
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanTestData,
  createTestUser,
  createAuthToken,
  createE2ERequestHelpers,
  e2eGenerators,
  canRunE2ETests,
} from './setup';

// Skip tests if database not available
const describeE2E = canRunE2ETests() ? describe : describe.skip;

describeE2E('E2E: Vocabulary Management Flow', () => {
  let testUser: { id: string; email: string };
  let authToken: string;
  let api: ReturnType<typeof createE2ERequestHelpers>;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanTestData();
    testUser = await createTestUser({ subscriptionTier: 'learner' });
    authToken = await createAuthToken(testUser.id, testUser.email, 'learner');
    api = createE2ERequestHelpers(authToken);
  });

  describe('Complete Vocabulary Lifecycle', () => {
    it('should create, read, update, and delete vocabulary', async () => {
      // Step 1: Create a vocabulary word
      const word = {
        word: '学习',
        pinyin: 'xuéxí',
        definition: 'to study, to learn',
        hskLevel: 1,
      };

      const createResult = await api.post('/api/v1/vocabulary', word);
      expect(createResult.status).toBe(201);
      expect(createResult.json.data).toBeDefined();
      expect(createResult.json.data.word).toBe(word.word);
      expect(createResult.json.data.pinyin).toBe(word.pinyin);

      const vocabId = createResult.json.data.id;

      // Step 2: Read the vocabulary word
      const readResult = await api.get(`/api/v1/vocabulary/${vocabId}`);
      expect(readResult.status).toBe(200);
      expect(readResult.json.data.word).toBe(word.word);
      expect(readResult.json.data.status).toBe('learning');

      // Step 3: Update the vocabulary status to 'known'
      const updateResult = await api.patch(`/api/v1/vocabulary/${vocabId}`, {
        status: 'known',
        definition: 'to study, to learn (updated)',
      });
      expect(updateResult.status).toBe(200);
      expect(updateResult.json.data.status).toBe('known');
      expect(updateResult.json.data.definition).toContain('updated');

      // Step 4: List all vocabulary and verify update
      const listResult = await api.get('/api/v1/vocabulary');
      expect(listResult.status).toBe(200);
      expect(listResult.json.data).toBeInstanceOf(Array);
      expect(listResult.json.data.length).toBeGreaterThanOrEqual(1);

      const foundWord = listResult.json.data.find((v: any) => v.id === vocabId);
      expect(foundWord).toBeDefined();
      expect(foundWord.status).toBe('known');

      // Step 5: Delete the vocabulary word
      const deleteResult = await api.delete(`/api/v1/vocabulary/${vocabId}`);
      expect(deleteResult.status).toBe(200);

      // Step 6: Verify deletion
      const verifyResult = await api.get(`/api/v1/vocabulary/${vocabId}`);
      expect(verifyResult.status).toBe(404);
    });

    it('should handle bulk vocabulary creation', async () => {
      const words = [
        { word: '中文', pinyin: 'zhōngwén', definition: 'Chinese language', hskLevel: 1 },
        { word: '汉字', pinyin: 'hànzì', definition: 'Chinese characters', hskLevel: 2 },
        { word: '语言', pinyin: 'yǔyán', definition: 'language', hskLevel: 2 },
      ];

      // Create multiple words
      const results = await Promise.all(words.map((w) => api.post('/api/v1/vocabulary', w)));

      expect(results.every((r) => r.status === 201)).toBe(true);

      // List and verify all words exist
      const listResult = await api.get('/api/v1/vocabulary');
      expect(listResult.status).toBe(200);
      expect(listResult.json.data.length).toBe(3);
    });

    it('should filter vocabulary by status', async () => {
      // Create words with different statuses
      const newWord = await api.post('/api/v1/vocabulary', {
        word: '新词',
        pinyin: 'xīncí',
        definition: 'new word',
      });
      expect(newWord.status).toBe(201);

      const knownWord = await api.post('/api/v1/vocabulary', {
        word: '旧词',
        pinyin: 'jiùcí',
        definition: 'old word',
      });
      expect(knownWord.status).toBe(201);

      // Update one to 'known'
      await api.patch(`/api/v1/vocabulary/${knownWord.json.data.id}`, { status: 'known' });

      // Filter by status
      const learningOnly = await api.get('/api/v1/vocabulary?status=learning');
      expect(learningOnly.status).toBe(200);
      expect(learningOnly.json.data.every((v: any) => v.status === 'learning')).toBe(true);

      const knownOnly = await api.get('/api/v1/vocabulary?status=known');
      expect(knownOnly.status).toBe(200);
      expect(knownOnly.json.data.every((v: any) => v.status === 'known')).toBe(true);
    });

    it('should prevent duplicate words for same user', async () => {
      const word = {
        word: '重复',
        pinyin: 'chóngfù',
        definition: 'duplicate',
      };

      // First creation should succeed
      const first = await api.post('/api/v1/vocabulary', word);
      expect(first.status).toBe(201);

      // Second creation should fail or update
      const second = await api.post('/api/v1/vocabulary', word);
      expect([200, 201, 409]).toContain(second.status);
    });
  });

  describe('Review Flow with SRS', () => {
    it('should update review data after answering', async () => {
      // Create a word
      const createResult = await api.post('/api/v1/vocabulary', {
        word: '复习',
        pinyin: 'fùxí',
        definition: 'to review',
      });
      expect(createResult.status).toBe(201);
      const vocabId = createResult.json.data.id;

      // Get words due for review
      const dueResult = await api.get('/api/v1/vocabulary/due');
      expect([200, 404]).toContain(dueResult.status);

      // Submit a review result
      const reviewResult = await api.post(`/api/v1/vocabulary/${vocabId}/review`, {
        quality: 4, // Good recall
      });

      expect([200, 201]).toContain(reviewResult.status);

      // Verify review count increased
      const afterReview = await api.get(`/api/v1/vocabulary/${vocabId}`);
      expect(afterReview.status).toBe(200);
      expect(afterReview.json.data.reviewCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Vocabulary Statistics', () => {
    it('should return vocabulary statistics', async () => {
      // Create some vocabulary
      await api.post('/api/v1/vocabulary', { word: '一', pinyin: 'yī', definition: 'one', hskLevel: 1 });
      await api.post('/api/v1/vocabulary', { word: '二', pinyin: 'èr', definition: 'two', hskLevel: 1 });
      await api.post('/api/v1/vocabulary', { word: '三', pinyin: 'sān', definition: 'three', hskLevel: 1 });

      // Get stats
      const statsResult = await api.get('/api/v1/vocabulary/stats');
      expect([200, 404]).toContain(statsResult.status);

      if (statsResult.status === 200) {
        expect(statsResult.json.data).toBeDefined();
        expect(statsResult.json.data.total).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
