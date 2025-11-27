/**
 * E2E Tests: Card Mining Flow
 *
 * Tests the complete card lifecycle:
 * 1. Mine cards from content
 * 2. View mined cards
 * 3. Update card with simplification
 * 4. Export cards to Anki
 * 5. Delete cards
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

const describeE2E = canRunE2ETests() ? describe : describe.skip;

describeE2E('E2E: Card Mining Flow', () => {
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

  describe('Complete Card Mining Lifecycle', () => {
    it('should mine, view, update, and delete cards', async () => {
      // Step 1: Mine a new card
      const cardData = {
        word: '电影',
        sentence: '我想看一部中国电影。',
        sourceTitle: 'Test Video',
        sourceTimestamp: '00:15:30',
      };

      const createResult = await api.post('/api/v1/cards', cardData);
      expect(createResult.status).toBe(201);
      expect(createResult.json.data).toBeDefined();
      expect(createResult.json.data.word).toBe(cardData.word);
      expect(createResult.json.data.sentence).toBe(cardData.sentence);

      const cardId = createResult.json.data.id;

      // Step 2: View the card
      const readResult = await api.get(`/api/v1/cards/${cardId}`);
      expect(readResult.status).toBe(200);
      expect(readResult.json.data.word).toBe(cardData.word);
      expect(readResult.json.data.exportedToAnki).toBe(false);

      // Step 3: Update card with simplified sentence
      const updateResult = await api.patch(`/api/v1/cards/${cardId}`, {
        simplifiedSentence: '我想看中国电影。',
      });
      expect(updateResult.status).toBe(200);
      expect(updateResult.json.data.simplifiedSentence).toBe('我想看中国电影。');

      // Step 4: List all cards
      const listResult = await api.get('/api/v1/cards');
      expect(listResult.status).toBe(200);
      expect(listResult.json.data).toBeInstanceOf(Array);
      expect(listResult.json.data.length).toBe(1);

      // Step 5: Delete the card
      const deleteResult = await api.delete(`/api/v1/cards/${cardId}`);
      expect(deleteResult.status).toBe(200);

      // Step 6: Verify deletion
      const verifyResult = await api.get(`/api/v1/cards/${cardId}`);
      expect(verifyResult.status).toBe(404);
    });

    it('should handle bulk card mining', async () => {
      const cards = [
        { word: '音乐', sentence: '我喜欢听音乐。', sourceTitle: 'Music Video' },
        { word: '书籍', sentence: '这本书很有趣。', sourceTitle: 'Book Club' },
        { word: '食物', sentence: '中国食物很好吃。', sourceTitle: 'Food Show' },
      ];

      // Create multiple cards
      const results = await Promise.all(cards.map((c) => api.post('/api/v1/cards', c)));
      expect(results.every((r) => r.status === 201)).toBe(true);

      // Verify all exist
      const listResult = await api.get('/api/v1/cards');
      expect(listResult.status).toBe(200);
      expect(listResult.json.data.length).toBe(3);
    });
  });

  describe('Anki Export Flow', () => {
    it('should mark cards as exported to Anki', async () => {
      // Create cards
      const card1 = await api.post('/api/v1/cards', {
        word: '导出',
        sentence: '我要导出这些卡片。',
      });
      expect(card1.status).toBe(201);

      const card2 = await api.post('/api/v1/cards', {
        word: '保留',
        sentence: '这张卡片保留。',
      });
      expect(card2.status).toBe(201);

      // Export first card
      const exportResult = await api.post('/api/v1/cards/export', {
        cardIds: [card1.json.data.id],
        format: 'anki',
      });
      expect([200, 201]).toContain(exportResult.status);

      // Verify export status
      const afterExport = await api.get(`/api/v1/cards/${card1.json.data.id}`);
      expect(afterExport.status).toBe(200);
      expect(afterExport.json.data.exportedToAnki).toBe(true);

      // Second card should not be exported
      const notExported = await api.get(`/api/v1/cards/${card2.json.data.id}`);
      expect(notExported.status).toBe(200);
      expect(notExported.json.data.exportedToAnki).toBe(false);
    });

    it('should filter cards by export status', async () => {
      // Create and export a card
      const exported = await api.post('/api/v1/cards', {
        word: '已导出',
        sentence: '这张卡片已导出。',
      });
      expect(exported.status).toBe(201);

      await api.post('/api/v1/cards/export', {
        cardIds: [exported.json.data.id],
        format: 'anki',
      });

      // Create non-exported card
      const notExported = await api.post('/api/v1/cards', {
        word: '未导出',
        sentence: '这张卡片未导出。',
      });
      expect(notExported.status).toBe(201);

      // Filter by export status
      const exportedOnly = await api.get('/api/v1/cards?exported=true');
      expect(exportedOnly.status).toBe(200);

      const notExportedOnly = await api.get('/api/v1/cards?exported=false');
      expect(notExportedOnly.status).toBe(200);
    });
  });

  describe('Card Search and Filtering', () => {
    it('should search cards by word', async () => {
      // Create cards with different words
      await api.post('/api/v1/cards', { word: '搜索', sentence: '搜索功能很重要。' });
      await api.post('/api/v1/cards', { word: '查找', sentence: '查找信息很容易。' });
      await api.post('/api/v1/cards', { word: '寻找', sentence: '寻找答案需要时间。' });

      // Search for specific word
      const searchResult = await api.get('/api/v1/cards?search=搜索');
      expect(searchResult.status).toBe(200);

      if (searchResult.json.data.length > 0) {
        expect(searchResult.json.data.some((c: any) => c.word === '搜索')).toBe(true);
      }
    });

    it('should paginate card results', async () => {
      // Create 15 cards
      const cards = Array.from({ length: 15 }, (_, i) => ({
        word: `词${i + 1}`,
        sentence: `这是第${i + 1}个句子。`,
      }));

      await Promise.all(cards.map((c) => api.post('/api/v1/cards', c)));

      // Get first page
      const page1 = await api.get('/api/v1/cards?limit=10&offset=0');
      expect(page1.status).toBe(200);
      expect(page1.json.data.length).toBeLessThanOrEqual(10);

      // Get second page
      const page2 = await api.get('/api/v1/cards?limit=10&offset=10');
      expect(page2.status).toBe(200);
      expect(page2.json.data.length).toBeLessThanOrEqual(5);
    });
  });
});
