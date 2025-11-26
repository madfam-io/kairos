import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv, AuthenticatedEnv } from '../types';
import { requireAuth, requireSubscription, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { getNLPClient } from '../services/nlp-client';

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
  language: z.enum(['zh-Hans', 'zh-Hant']).default('zh-Hans'),
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

    // TODO: Check monthly quota
    // TODO: Check cache first
    // TODO: Call Qwen2.5-7B on Modal

    // Placeholder response
    return c.json({
      success: true,
      data: {
        originalText: text,
        simplifiedText: text, // TODO: Actual simplification
        targetLevel,
        confidence: 0.95,
        cached: false,
        processingTimeMs: Date.now() - startTime,
      },
    });
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

    // TODO: Batch processing with caching
    const results = sentences.map((s) => ({
      index: s.index,
      originalText: s.text,
      simplifiedText: s.text, // TODO: Actual simplification
    }));

    return c.json({
      success: true,
      data: {
        results,
        totalProcessingTimeMs: Date.now() - startTime,
      },
    });
  }
);

/**
 * POST /api/v1/nlp/grammar
 * Get grammar explanation for a pattern
 */
nlpRoutes.post(
  '/grammar',
  requireAuth(),
  requireSubscription('learner'),
  zValidator('json', grammarSchema),
  async (c) => {
    const { text, targetWord } = c.req.valid('json');

    // TODO: Lookup in grammar database or call LLM
    return c.json({
      success: true,
      data: {
        pattern: targetWord ?? text,
        name: 'Grammar Pattern',
        nameZh: '语法结构',
        explanation: 'Explanation pending implementation',
        structure: 'Structure pending',
        examples: [],
        hskLevel: null,
      },
    });
  }
);

/**
 * POST /api/v1/nlp/ocr
 * Extract text from image using PaddleOCR
 */
nlpRoutes.post('/ocr', requireAuth(), zValidator('json', ocrSchema), async (c) => {
  const { language, region } = c.req.valid('json');
  const startTime = Date.now();

  // TODO: Get image from request body or URL
  // TODO: Call PaddleOCR service

  return c.json({
    success: true,
    data: {
      text: '',
      confidence: 0,
      boundingBox: region ?? { x: 0, y: 0, width: 0, height: 0 },
      processingTimeMs: Date.now() - startTime,
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
