/**
 * E2E Tests: Shared Decks Flow
 *
 * Tests the complete shared deck lifecycle:
 * 1. Create a deck
 * 2. Add words to deck
 * 3. Publish deck
 * 4. Browse/search public decks
 * 5. Import deck to vocabulary
 * 6. Like/unlike decks
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

describeE2E('E2E: Shared Decks Flow', () => {
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

  describe('Complete Deck Lifecycle', () => {
    it('should create, populate, publish, and manage a deck', async () => {
      // Step 1: Create a new deck
      const deckData = {
        name: 'HSK 1 Vocabulary',
        description: 'Essential words for HSK Level 1',
        category: 'hsk',
        tags: ['hsk1', 'beginner', 'essential'],
      };

      const createResult = await api.post('/api/v1/shared-decks', deckData);
      expect(createResult.status).toBe(201);
      expect(createResult.json.data.name).toBe(deckData.name);
      expect(createResult.json.data.isPublic).toBe(false);

      const deckId = createResult.json.data.id;

      // Step 2: Add words to the deck
      const words = [
        { word: '你好', pinyin: 'nǐhǎo', definition: 'hello', hskLevel: 1 },
        { word: '谢谢', pinyin: 'xièxiè', definition: 'thank you', hskLevel: 1 },
        { word: '再见', pinyin: 'zàijiàn', definition: 'goodbye', hskLevel: 1 },
      ];

      const addWordsResult = await api.post(`/api/v1/shared-decks/${deckId}/words`, { words });
      expect([200, 201]).toContain(addWordsResult.status);

      // Step 3: Get deck details with words
      const deckDetails = await api.get(`/api/v1/shared-decks/${deckId}`);
      expect(deckDetails.status).toBe(200);
      expect(deckDetails.json.data.wordCount).toBe(3);

      // Step 4: Publish the deck
      const publishResult = await api.patch(`/api/v1/shared-decks/${deckId}`, {
        isPublic: true,
      });
      expect(publishResult.status).toBe(200);
      expect(publishResult.json.data.isPublic).toBe(true);

      // Step 5: Verify deck appears in public listing
      const publicDecks = await api.get('/api/v1/shared-decks?public=true');
      expect(publicDecks.status).toBe(200);
      const ourDeck = publicDecks.json.data.find((d: any) => d.id === deckId);
      expect(ourDeck).toBeDefined();

      // Step 6: Delete the deck
      const deleteResult = await api.delete(`/api/v1/shared-decks/${deckId}`);
      expect(deleteResult.status).toBe(200);

      // Verify deletion
      const verifyResult = await api.get(`/api/v1/shared-decks/${deckId}`);
      expect(verifyResult.status).toBe(404);
    });
  });

  describe('Deck Import Flow', () => {
    it('should import a deck into user vocabulary', async () => {
      // Create a public deck with words
      const deckResult = await api.post('/api/v1/shared-decks', {
        name: 'Import Test Deck',
        description: 'Test deck for import',
        isPublic: true,
      });
      expect(deckResult.status).toBe(201);
      const deckId = deckResult.json.data.id;

      // Add words
      await api.post(`/api/v1/shared-decks/${deckId}/words`, {
        words: [
          { word: '导入', pinyin: 'dǎorù', definition: 'to import', hskLevel: 3 },
          { word: '词汇', pinyin: 'cíhuì', definition: 'vocabulary', hskLevel: 3 },
        ],
      });

      // Import the deck
      const importResult = await api.post(`/api/v1/shared-decks/${deckId}/import`);
      expect([200, 201]).toContain(importResult.status);

      // Verify words were added to vocabulary
      const vocabResult = await api.get('/api/v1/vocabulary');
      expect(vocabResult.status).toBe(200);
      expect(vocabResult.json.data.length).toBeGreaterThanOrEqual(2);

      const importedWords = vocabResult.json.data.map((v: any) => v.word);
      expect(importedWords).toContain('导入');
      expect(importedWords).toContain('词汇');
    });

    it('should skip duplicate words during import', async () => {
      // First, add a word to vocabulary
      await api.post('/api/v1/vocabulary', {
        word: '重复',
        pinyin: 'chóngfù',
        definition: 'to repeat, duplicate',
      });

      // Create a deck with the same word
      const deckResult = await api.post('/api/v1/shared-decks', {
        name: 'Duplicate Test',
        isPublic: true,
      });
      const deckId = deckResult.json.data.id;

      await api.post(`/api/v1/shared-decks/${deckId}/words`, {
        words: [
          { word: '重复', pinyin: 'chóngfù', definition: 'duplicate' },
          { word: '新词', pinyin: 'xīncí', definition: 'new word' },
        ],
      });

      // Import should handle duplicates gracefully
      const importResult = await api.post(`/api/v1/shared-decks/${deckId}/import`);
      expect([200, 201]).toContain(importResult.status);

      // Verify vocabulary count
      const vocabResult = await api.get('/api/v1/vocabulary');
      expect(vocabResult.status).toBe(200);

      // Should have both words (duplicate either updated or skipped)
      const words = vocabResult.json.data.map((v: any) => v.word);
      expect(words).toContain('重复');
      expect(words).toContain('新词');
    });
  });

  describe('Deck Likes and Popularity', () => {
    it('should like and unlike decks', async () => {
      // Create a public deck
      const deckResult = await api.post('/api/v1/shared-decks', {
        name: 'Likeable Deck',
        isPublic: true,
      });
      const deckId = deckResult.json.data.id;
      expect(deckResult.json.data.likeCount).toBe(0);

      // Like the deck
      const likeResult = await api.post(`/api/v1/shared-decks/${deckId}/like`);
      expect([200, 201]).toContain(likeResult.status);

      // Verify like count increased
      const afterLike = await api.get(`/api/v1/shared-decks/${deckId}`);
      expect(afterLike.json.data.likeCount).toBe(1);

      // Unlike the deck
      const unlikeResult = await api.delete(`/api/v1/shared-decks/${deckId}/like`);
      expect(unlikeResult.status).toBe(200);

      // Verify like count decreased
      const afterUnlike = await api.get(`/api/v1/shared-decks/${deckId}`);
      expect(afterUnlike.json.data.likeCount).toBe(0);
    });

    it('should sort decks by popularity', async () => {
      // Create decks with different like counts
      const deck1 = await api.post('/api/v1/shared-decks', { name: 'Popular Deck', isPublic: true });
      const deck2 = await api.post('/api/v1/shared-decks', { name: 'Less Popular Deck', isPublic: true });

      // Like the first deck multiple times (need multiple users in real scenario)
      await api.post(`/api/v1/shared-decks/${deck1.json.data.id}/like`);

      // Get decks sorted by popularity
      const popularResult = await api.get('/api/v1/shared-decks?public=true&sort=popular');
      expect(popularResult.status).toBe(200);

      if (popularResult.json.data.length >= 2) {
        // First deck should have more likes
        expect(popularResult.json.data[0].likeCount).toBeGreaterThanOrEqual(
          popularResult.json.data[1].likeCount
        );
      }
    });
  });

  describe('Deck Search and Filtering', () => {
    it('should search decks by name', async () => {
      await api.post('/api/v1/shared-decks', { name: 'Travel Vocabulary', isPublic: true });
      await api.post('/api/v1/shared-decks', { name: 'Business Chinese', isPublic: true });
      await api.post('/api/v1/shared-decks', { name: 'Food and Cooking', isPublic: true });

      const searchResult = await api.get('/api/v1/shared-decks?public=true&search=Travel');
      expect(searchResult.status).toBe(200);

      if (searchResult.json.data.length > 0) {
        expect(searchResult.json.data.some((d: any) => d.name.includes('Travel'))).toBe(true);
      }
    });

    it('should filter decks by category', async () => {
      await api.post('/api/v1/shared-decks', { name: 'HSK 1', category: 'hsk', isPublic: true });
      await api.post('/api/v1/shared-decks', { name: 'HSK 2', category: 'hsk', isPublic: true });
      await api.post('/api/v1/shared-decks', { name: 'Media Terms', category: 'media', isPublic: true });

      const hskDecks = await api.get('/api/v1/shared-decks?public=true&category=hsk');
      expect(hskDecks.status).toBe(200);
      expect(hskDecks.json.data.every((d: any) => d.category === 'hsk')).toBe(true);
    });
  });
});
