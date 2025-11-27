import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv, AuthenticatedEnv } from '../types';
import { requireAuth, requireSubscription, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { getNLPClient } from '../services/nlp-client';
import { getSimplifyClient } from '../services/simplify-client';
import { log } from '../lib/logger';
import {
  findGrammarInText,
  getGrammarExplanation,
  getGrammarByLevel,
  searchGrammarPatterns,
  seedGrammarPatterns,
} from '../services/grammar';
import {
  seedJapaneseGrammarPatterns,
  getJapaneseGrammarByLevel,
  searchJapaneseGrammarPatterns,
} from '../services/japanese-grammar';

export const nlpRoutes = new Hono<AppEnv>();

const segmentSchema = z.object({
  text: z.string().min(1).max(5000),
  knownWords: z.array(z.string()).optional(),
  detectAmbiguity: z.boolean().default(false),
});

const simplifySchema = z.object({
  text: z.string().min(1).max(1000),
  targetLevel: z.number().int().min(1).max(6),
  preserveProperNouns: z.boolean().default(true),
  context: z.string().max(500).optional(),
});

const batchSimplifySchema = z.object({
  sentences: z
    .array(
      z.object({
        text: z.string().min(1).max(1000),
        index: z.number().int().min(0),
      })
    )
    .min(1)
    .max(50),
  targetLevel: z.number().int().min(1).max(6),
});

const grammarSchema = z.object({
  text: z.string().min(1).max(500),
  targetWord: z.string().optional(),
});

const ocrSchema = z.object({
  image: z.string().min(1), // base64 encoded image or URL
  language: z.enum(['zh', 'ja']).default('zh'),
  region: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

/**
 * POST /api/v1/nlp/segment
 * Segment Chinese text into words (available to all users)
 */
nlpRoutes.post('/segment', optionalAuth(), zValidator('json', segmentSchema), async (c) => {
  const { text, knownWords, detectAmbiguity } = c.req.valid('json');
  const startTime = Date.now();

  try {
    const nlpClient = getNLPClient();
    const result = await nlpClient.segment(text);

    // Transform response and add known word status
    const segments = result.segments.map((seg, index) => ({
      text: seg.text,
      pinyin: seg.pinyin,
      toneMarks: seg.tone_marks,
      definitions: seg.definitions,
      hskLevel: seg.hsk_level,
      pos: seg.pos,
      isPunctuation: seg.is_punctuation,
      isKnown: knownWords?.includes(seg.text) ?? false,
    }));

    return c.json({
      success: true,
      data: {
        segments,
        rawText: result.original_text,
        wordCount: result.word_count,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    // Fallback to character-by-character if NLP service unavailable
    console.error('NLP service error, using fallback:', error);
    const segments = text.split('').map((char, index) => ({
      text: char,
      pinyin: null,
      toneMarks: null,
      definitions: [],
      hskLevel: null,
      pos: null,
      isPunctuation: /[\s\u3000-\u303F\uFF00-\uFFEF.,!?;:]/.test(char),
      isKnown: knownWords?.includes(char) ?? false,
    }));

    return c.json({
      success: true,
      data: {
        segments,
        rawText: text,
        wordCount: segments.filter((s) => !s.isPunctuation).length,
        processingTimeMs: Date.now() - startTime,
        fallback: true,
      },
    });
  }
});

/**
 * POST /api/v1/nlp/simplify
 * Simplify text to target HSK level (requires Learner subscription)
 */
nlpRoutes.post(
  '/simplify',
  requireAuth(),
  requireSubscription('learner'),
  zValidator('json', simplifySchema),
  async (c) => {
    const { text, targetLevel, preserveProperNouns, context } = c.req.valid('json');
    const user = c.get('user');
    const startTime = Date.now();

    try {
      const simplifyClient = getSimplifyClient();
      const result = await simplifyClient.simplify(text, {
        targetLevel,
        preserveNames: preserveProperNouns,
        context,
      });

      log.info('Text simplified', {
        userId: user.id,
        targetLevel,
        cached: result.cached,
        tokensUsed: result.tokensUsed,
      });

      return c.json({
        success: true,
        data: {
          originalText: result.original,
          simplifiedText: result.simplified,
          targetLevel: result.targetLevel,
          confidence: result.confidence,
          cached: result.cached,
          processingTimeMs: Date.now() - startTime,
        },
      });
    } catch (error) {
      log.error('Simplification failed', error instanceof Error ? error : new Error(String(error)), {
        userId: user.id,
        textLength: text.length,
        targetLevel,
      });

      // Return original text if service is unavailable
      return c.json({
        success: true,
        data: {
          originalText: text,
          simplifiedText: text,
          targetLevel,
          confidence: 0,
          cached: false,
          processingTimeMs: Date.now() - startTime,
          fallback: true,
          error: 'Simplification service temporarily unavailable',
        },
      });
    }
  }
);

/**
 * POST /api/v1/nlp/simplify/batch
 * Batch simplify multiple sentences
 */
nlpRoutes.post(
  '/simplify/batch',
  requireAuth(),
  requireSubscription('learner'),
  zValidator('json', batchSimplifySchema),
  async (c) => {
    const { sentences, targetLevel } = c.req.valid('json');
    const user = c.get('user');
    const startTime = Date.now();

    try {
      const simplifyClient = getSimplifyClient();
      const texts = sentences.map((s) => s.text);

      const batchResult = await simplifyClient.simplifyBatch(texts, {
        targetLevel,
        preserveNames: true,
      });

      // Map results back with original indices
      const results = sentences.map((s, i) => ({
        index: s.index,
        originalText: batchResult.results[i].original,
        simplifiedText: batchResult.results[i].simplified,
        confidence: batchResult.results[i].confidence,
        cached: batchResult.results[i].cached,
      }));

      log.info('Batch simplification completed', {
        userId: user.id,
        sentenceCount: sentences.length,
        targetLevel,
        totalTokens: batchResult.totalTokens,
        cacheHits: batchResult.cacheHits,
      });

      return c.json({
        success: true,
        data: {
          results,
          totalProcessingTimeMs: Date.now() - startTime,
          totalTokens: batchResult.totalTokens,
          cacheHits: batchResult.cacheHits,
        },
      });
    } catch (error) {
      log.error('Batch simplification failed', error instanceof Error ? error : new Error(String(error)), {
        userId: user.id,
        sentenceCount: sentences.length,
        targetLevel,
      });

      // Fallback: return original texts
      const results = sentences.map((s) => ({
        index: s.index,
        originalText: s.text,
        simplifiedText: s.text,
        confidence: 0,
        cached: false,
      }));

      return c.json({
        success: true,
        data: {
          results,
          totalProcessingTimeMs: Date.now() - startTime,
          totalTokens: 0,
          cacheHits: 0,
          fallback: true,
          error: 'Simplification service temporarily unavailable',
        },
      });
    }
  }
);

const grammarSearchSchema = z.object({
  query: z.string().min(1).max(100),
});

const grammarLevelSchema = z.object({
  level: z.coerce.number().int().min(1).max(6),
});

/**
 * POST /api/v1/nlp/grammar
 * Find grammar patterns in text
 */
nlpRoutes.post(
  '/grammar',
  requireAuth(),
  requireSubscription('learner'),
  zValidator('json', grammarSchema),
  async (c) => {
    const { text, targetWord } = c.req.valid('json');

    // If targetWord is provided, look up that specific pattern
    if (targetWord) {
      const pattern = await getGrammarExplanation(targetWord);
      if (pattern) {
        return c.json({
          success: true,
          data: pattern,
        });
      }
      return c.json({
        success: true,
        data: null,
        message: 'Grammar pattern not found',
      });
    }

    // Otherwise, find all patterns in the text
    const patterns = await findGrammarInText(text);
    return c.json({
      success: true,
      data: {
        text,
        patterns,
        count: patterns.length,
      },
    });
  }
);

/**
 * GET /api/v1/nlp/grammar/search
 * Search grammar patterns by query
 */
nlpRoutes.get('/grammar/search', zValidator('query', grammarSearchSchema), async (c) => {
  const { query } = c.req.valid('query');
  const patterns = await searchGrammarPatterns(query);

  return c.json({
    success: true,
    data: {
      patterns,
      count: patterns.length,
    },
  });
});

/**
 * GET /api/v1/nlp/grammar/level/:level
 * Get all grammar patterns for a specific HSK level
 */
nlpRoutes.get('/grammar/level/:level', zValidator('param', grammarLevelSchema), async (c) => {
  const { level } = c.req.valid('param');
  const patterns = await getGrammarByLevel(level);

  return c.json({
    success: true,
    data: {
      level,
      patterns,
      count: patterns.length,
    },
  });
});

/**
 * GET /api/v1/nlp/grammar/:pattern
 * Get specific grammar pattern explanation
 */
nlpRoutes.get('/grammar/:pattern', async (c) => {
  const pattern = decodeURIComponent(c.req.param('pattern'));
  const result = await getGrammarExplanation(pattern);

  if (!result) {
    return c.json({
      success: true,
      data: null,
      message: 'Grammar pattern not found',
    });
  }

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/v1/nlp/grammar/seed
 * Seed grammar patterns into database (admin only)
 */
nlpRoutes.post('/grammar/seed', requireAuth(), async (c) => {
  const user = c.get('user');

  // Check if user is admin
  if (user.role !== 'admin') {
    throw new AppError('Forbidden', 403);
  }

  const inserted = await seedGrammarPatterns();
  return c.json({
    success: true,
    data: {
      inserted,
      message: `Seeded ${inserted} grammar patterns`,
    },
  });
});

/**
 * POST /api/v1/nlp/ocr
 * Extract text from image using PaddleOCR
 */
nlpRoutes.post('/ocr', requireAuth(), zValidator('json', ocrSchema), async (c) => {
  const { image, language, region } = c.req.valid('json');
  const startTime = Date.now();

  const nlpClient = getNLPClient();
  const result = await nlpClient.ocr(image, { language, region });

  // Check if OCR actually returned text (service might be unavailable)
  const serviceAvailable = result.text !== '' || result.confidence > 0;

  return c.json({
    success: true,
    data: {
      text: result.text,
      confidence: result.confidence,
      boundingBox: result.bounding_box ?? region ?? { x: 0, y: 0, width: 0, height: 0 },
      language: result.language,
      processingTimeMs: Date.now() - startTime,
      serviceAvailable,
    },
  });
});

/**
 * GET /api/v1/nlp/dictionary/:word
 * Lookup word in dictionary (CC-CEDICT)
 */
nlpRoutes.get('/dictionary/:word', async (c) => {
  const word = c.req.param('word');

  try {
    const nlpClient = getNLPClient();
    const result = await nlpClient.lookup(word);

    return c.json({
      success: true,
      data: {
        word: result.word,
        pinyin: result.pinyin,
        definitions: result.definitions,
        hskLevel: result.hsk_level,
        traditional: result.traditional,
        found: result.found,
        examples: [], // TODO: Add example sentences
      },
    });
  } catch (error) {
    console.error('Dictionary lookup error:', error);
    return c.json({
      success: true,
      data: {
        word,
        pinyin: null,
        definitions: [],
        hskLevel: null,
        traditional: null,
        found: false,
        examples: [],
      },
    });
  }
});

// ============================================
// Japanese Language Support
// ============================================

const japaneseSegmentSchema = z.object({
  text: z.string().min(1).max(5000),
  includeReading: z.boolean().default(true),
  includeDefinitions: z.boolean().default(true),
  includeJlpt: z.boolean().default(true),
});

const japaneseGrammarLevelSchema = z.object({
  level: z.coerce.number().int().min(1).max(5), // JLPT N5=1 to N1=5
});

/**
 * POST /api/v1/nlp/japanese/segment
 * Segment Japanese text into words
 */
nlpRoutes.post(
  '/japanese/segment',
  optionalAuth(),
  zValidator('json', japaneseSegmentSchema),
  async (c) => {
    const { text, includeReading, includeDefinitions, includeJlpt } = c.req.valid('json');
    const startTime = Date.now();

    const nlpClient = getNLPClient();
    const result = await nlpClient.segmentJapanese(text, {
      includeReading,
      includeDefinitions,
      includeJlpt,
    });

    // Map response to API format
    const segments = result.segments.map((seg) => ({
      text: seg.text,
      reading: seg.reading,
      readingKatakana: seg.reading_katakana,
      dictionaryForm: seg.dictionary_form,
      partOfSpeech: seg.part_of_speech,
      definitions: seg.definitions,
      jlptLevel: seg.jlpt_level,
      isPunctuation: seg.is_punctuation,
    }));

    return c.json({
      success: true,
      data: {
        segments,
        rawText: result.original_text,
        wordCount: result.word_count,
        processingTimeMs: Date.now() - startTime,
        language: 'ja',
      },
    });
  }
);

/**
 * GET /api/v1/nlp/japanese/dictionary/:word
 * Look up Japanese word in dictionary
 */
nlpRoutes.get('/japanese/dictionary/:word', async (c) => {
  const word = decodeURIComponent(c.req.param('word'));

  const nlpClient = getNLPClient();
  const result = await nlpClient.lookupJapanese(word);

  return c.json({
    success: true,
    data: {
      word: result.word,
      reading: result.reading,
      readingKatakana: result.reading_katakana,
      definitions: result.definitions,
      jlptLevel: result.jlpt_level,
      partsOfSpeech: result.parts_of_speech,
      found: result.found,
      language: 'ja',
    },
  });
});

/**
 * GET /api/v1/nlp/japanese/grammar/level/:level
 * Get Japanese grammar patterns by JLPT level
 */
nlpRoutes.get(
  '/japanese/grammar/level/:level',
  zValidator('param', japaneseGrammarLevelSchema),
  async (c) => {
    const { level } = c.req.valid('param');
    const patterns = await getJapaneseGrammarByLevel(level);

    return c.json({
      success: true,
      data: {
        level,
        jlptName: `N${6 - level}`, // level 1 = N5, level 5 = N1
        patterns,
        count: patterns.length,
      },
    });
  }
);

/**
 * GET /api/v1/nlp/japanese/grammar/search
 * Search Japanese grammar patterns
 */
nlpRoutes.get(
  '/japanese/grammar/search',
  zValidator('query', z.object({ query: z.string().min(1).max(100) })),
  async (c) => {
    const { query } = c.req.valid('query');
    const patterns = await searchJapaneseGrammarPatterns(query);

    return c.json({
      success: true,
      data: {
        patterns,
        count: patterns.length,
      },
    });
  }
);

/**
 * POST /api/v1/nlp/japanese/grammar/seed
 * Seed Japanese grammar patterns (admin only)
 */
nlpRoutes.post('/japanese/grammar/seed', requireAuth(), async (c) => {
  const user = c.get('user');

  if (user.role !== 'admin') {
    throw new AppError('Forbidden', 403);
  }

  const inserted = await seedJapaneseGrammarPatterns();
  return c.json({
    success: true,
    data: {
      inserted,
      message: `Seeded ${inserted} Japanese grammar patterns`,
    },
  });
});

/**
 * GET /api/v1/nlp/japanese/jlpt/:word
 * Get JLPT level for a word
 */
nlpRoutes.get('/japanese/jlpt/:word', async (c) => {
  const word = decodeURIComponent(c.req.param('word'));

  const nlpClient = getNLPClient();
  const result = await nlpClient.getJLPTLevel(word);

  return c.json({
    success: true,
    data: {
      word: result.word,
      jlptLevel: result.jlpt_level,
      jlptName: result.jlpt_name,
      found: result.found,
    },
  });
});
