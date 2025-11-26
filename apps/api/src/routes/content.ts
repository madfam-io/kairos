import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requireAuth, optionalAuth } from '../middleware/auth';
import {
  analyzeContent,
  getRecommendations,
  calculateOptimalLevel,
  type UserProfile,
} from '../services/comprehensible-input';

const contentRoutes = new Hono<AppEnv>();

const analyzeSchema = z.object({
  text: z.string().min(1).max(50000),
  knownWords: z.array(z.string()).optional().default([]),
});

const recommendationsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
  type: z.enum(['article', 'video', 'story', 'dialogue']).optional(),
  minComprehensibility: z.number().min(0).max(100).optional().default(70),
  maxComprehensibility: z.number().min(0).max(100).optional().default(95),
});

/**
 * POST /api/v1/content/analyze
 * Analyze content difficulty and comprehensibility
 */
contentRoutes.post('/analyze', optionalAuth(), zValidator('json', analyzeSchema), async (c) => {
  const { text, knownWords } = c.req.valid('json');
  const startTime = Date.now();

  try {
    const analysis = await analyzeContent(text, knownWords);

    return c.json({
      success: true,
      data: {
        ...analysis,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    console.error('Content analysis error:', error);
    return c.json({
      success: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: 'Failed to analyze content',
      },
    }, 500);
  }
});

/**
 * POST /api/v1/content/recommendations
 * Get personalized content recommendations
 */
contentRoutes.post(
  '/recommendations',
  requireAuth(),
  zValidator('json', recommendationsSchema),
  async (c) => {
    const options = c.req.valid('json');
    const user = c.get('user');

    try {
      // Build user profile from request context
      // In production, this would come from a user service
      const userProfile: UserProfile = {
        vocabularySize: user?.vocabularySize ?? 500,
        averageHSKLevel: user?.averageHSKLevel ?? 2.5,
        knownWords: [], // Would be fetched from vocabulary service
        preferredTopics: user?.preferredTopics ?? [],
        recentlyViewed: [],
      };

      const recommendations = await getRecommendations(userProfile, options);

      return c.json({
        success: true,
        data: {
          recommendations,
          userLevel: {
            current: userProfile.averageHSKLevel,
            vocabularySize: userProfile.vocabularySize,
          },
        },
      });
    } catch (error) {
      console.error('Recommendations error:', error);
      return c.json({
        success: false,
        error: {
          code: 'RECOMMENDATIONS_FAILED',
          message: 'Failed to get recommendations',
        },
      }, 500);
    }
  }
);

/**
 * GET /api/v1/content/level
 * Get user's current level and learning progress
 */
contentRoutes.get('/level', requireAuth(), async (c) => {
  const user = c.get('user');

  try {
    // Build user profile
    const userProfile: UserProfile = {
      vocabularySize: user?.vocabularySize ?? 500,
      averageHSKLevel: user?.averageHSKLevel ?? 2.5,
      knownWords: [],
      preferredTopics: [],
      recentlyViewed: [],
    };

    const levelInfo = calculateOptimalLevel(userProfile);

    return c.json({
      success: true,
      data: levelInfo,
    });
  } catch (error) {
    console.error('Level calculation error:', error);
    return c.json({
      success: false,
      error: {
        code: 'LEVEL_CALCULATION_FAILED',
        message: 'Failed to calculate level',
      },
    }, 500);
  }
});

/**
 * POST /api/v1/content/preview
 * Preview content with comprehensibility estimate before reading
 */
contentRoutes.post(
  '/preview',
  optionalAuth(),
  zValidator('json', z.object({
    contentId: z.string().optional(),
    url: z.string().url().optional(),
    text: z.string().max(1000).optional(),
    knownWords: z.array(z.string()).optional().default([]),
  })),
  async (c) => {
    const { contentId, url, text, knownWords } = c.req.valid('json');

    if (!contentId && !url && !text) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Must provide contentId, url, or text',
        },
      }, 400);
    }

    try {
      // Get sample text for analysis
      let sampleText = text || '';

      // In production, would fetch content by ID or URL
      if (contentId) {
        // Fetch from content database
        sampleText = '这是示例内容';
      } else if (url) {
        // Fetch and extract text from URL
        sampleText = '这是从网页提取的内容';
      }

      // Analyze a sample (first 500 chars) for quick preview
      const preview = await analyzeContent(sampleText.slice(0, 500), knownWords);

      return c.json({
        success: true,
        data: {
          difficulty: preview.difficulty,
          estimatedHSKLevel: preview.estimatedHSKLevel,
          comprehensibility: preview.comprehensibility,
          estimatedReadingTime: preview.estimatedReadingTime,
          keyUnknownWords: preview.keyUnknownWords.slice(0, 5),
          recommendation: getReadingRecommendation(preview.comprehensibility),
        },
      });
    } catch (error) {
      console.error('Content preview error:', error);
      return c.json({
        success: false,
        error: {
          code: 'PREVIEW_FAILED',
          message: 'Failed to preview content',
        },
      }, 500);
    }
  }
);

/**
 * Get a reading recommendation based on comprehensibility
 */
function getReadingRecommendation(comprehensibility: number): string {
  if (comprehensibility >= 95) {
    return 'Perfect for extensive reading - enjoy the flow!';
  } else if (comprehensibility >= 85) {
    return 'Great for learning - challenging but manageable';
  } else if (comprehensibility >= 70) {
    return 'Good for intensive study - expect to look up words';
  } else if (comprehensibility >= 50) {
    return 'Challenging - consider simpler content first';
  } else {
    return 'Too difficult - try finding easier content';
  }
}

export { contentRoutes };
