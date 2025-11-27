import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, asc } from 'drizzle-orm';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import {
  userOnboarding,
  hskAssessment,
  learningPreferences,
  recommendedContent,
  onboardingEvents,
  users,
  ONBOARDING_STEPS,
} from '../db/schema';
import { log } from '../lib/logger';
import { AppError } from '../middleware/error-handler';
import { getHskAssessmentQuestions, evaluateAssessment, type AssessmentQuestion } from '../services/hsk-assessment';
import { generateRecommendations } from '../services/recommendations';

export const onboardingRoutes = new Hono<AuthenticatedEnv>();

// All onboarding routes require authentication
onboardingRoutes.use('*', requireAuth());

/**
 * GET /api/v1/onboarding/status
 * Get current onboarding status for the user
 */
onboardingRoutes.get('/status', async (c) => {
  const user = c.get('user');

  let onboarding = await db.query.userOnboarding.findFirst({
    where: eq(userOnboarding.userId, user.id),
  });

  // Create onboarding record if doesn't exist
  if (!onboarding) {
    [onboarding] = await db
      .insert(userOnboarding)
      .values({
        userId: user.id,
        currentStep: 'welcome',
        completedSteps: [],
      })
      .returning();

    // Log onboarding started
    await db.insert(onboardingEvents).values({
      userId: user.id,
      eventType: 'onboarding_started',
      step: 'welcome',
    });
  }

  // Get preferences if they exist
  const preferences = await db.query.learningPreferences.findFirst({
    where: eq(learningPreferences.userId, user.id),
  });

  // Get latest assessment if exists
  const assessment = await db.query.hskAssessment.findFirst({
    where: eq(hskAssessment.userId, user.id),
    orderBy: [desc(hskAssessment.createdAt)],
  });

  return c.json({
    success: true,
    data: {
      currentStep: onboarding.currentStep,
      completedSteps: onboarding.completedSteps,
      isCompleted: onboarding.isCompleted,
      isSkipped: onboarding.isSkipped,
      startedAt: onboarding.startedAt,
      completedAt: onboarding.completedAt,
      preferences: preferences ?? null,
      assessment: assessment
        ? {
            assessedLevel: assessment.assessedLevel,
            confidenceScore: assessment.confidenceScore,
            createdAt: assessment.createdAt,
          }
        : null,
    },
  });
});

const updateStepSchema = z.object({
  step: z.enum(ONBOARDING_STEPS),
  data: z.record(z.unknown()).optional(),
});

/**
 * POST /api/v1/onboarding/step
 * Update onboarding step progress
 */
onboardingRoutes.post('/step', zValidator('json', updateStepSchema), async (c) => {
  const user = c.get('user');
  const { step, data } = c.req.valid('json');

  // Get current onboarding state
  let onboarding = await db.query.userOnboarding.findFirst({
    where: eq(userOnboarding.userId, user.id),
  });

  if (!onboarding) {
    [onboarding] = await db
      .insert(userOnboarding)
      .values({
        userId: user.id,
        currentStep: step,
        completedSteps: [],
      })
      .returning();
  }

  const completedSteps = (onboarding.completedSteps as string[]) || [];
  const previousStep = onboarding.currentStep;

  // Add previous step to completed if not already there
  if (previousStep && !completedSteps.includes(previousStep) && previousStep !== step) {
    completedSteps.push(previousStep);
  }

  const isCompleted = step === 'completed';

  // Update onboarding state
  [onboarding] = await db
    .update(userOnboarding)
    .set({
      currentStep: step,
      completedSteps,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
      lastStepAt: new Date(),
    })
    .where(eq(userOnboarding.userId, user.id))
    .returning();

  // Log step transition
  await db.insert(onboardingEvents).values({
    userId: user.id,
    eventType: 'step_completed',
    step: previousStep,
    data: { nextStep: step, stepData: data },
  });

  if (isCompleted) {
    log.info('User completed onboarding', { userId: user.id });

    // Generate initial recommendations when onboarding completes
    try {
      await generateRecommendations(user.id);
    } catch (error) {
      log.error('Failed to generate recommendations', error as Error, { userId: user.id });
    }
  }

  return c.json({
    success: true,
    data: {
      currentStep: onboarding.currentStep,
      completedSteps: onboarding.completedSteps,
      isCompleted: onboarding.isCompleted,
    },
  });
});

/**
 * POST /api/v1/onboarding/skip
 * Skip the onboarding flow
 */
onboardingRoutes.post('/skip', async (c) => {
  const user = c.get('user');

  await db
    .insert(userOnboarding)
    .values({
      userId: user.id,
      currentStep: 'completed',
      isCompleted: true,
      isSkipped: true,
      completedSteps: [],
      completedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userOnboarding.userId,
      set: {
        isCompleted: true,
        isSkipped: true,
        completedAt: new Date(),
      },
    });

  // Log skip event
  await db.insert(onboardingEvents).values({
    userId: user.id,
    eventType: 'onboarding_skipped',
  });

  log.info('User skipped onboarding', { userId: user.id });

  return c.json({
    success: true,
    data: { message: 'Onboarding skipped' },
  });
});

const languageBackgroundSchema = z.object({
  nativeLanguage: z.string().min(2).max(10),
  hasStudiedChinese: z.boolean(),
  yearsStudied: z.number().int().min(0).max(50).optional(),
  previousMethods: z.array(z.string()).default([]),
});

/**
 * POST /api/v1/onboarding/language-background
 * Save language background information
 */
onboardingRoutes.post(
  '/language-background',
  zValidator('json', languageBackgroundSchema),
  async (c) => {
    const user = c.get('user');
    const data = c.req.valid('json');

    await db
      .insert(learningPreferences)
      .values({
        userId: user.id,
        nativeLanguage: data.nativeLanguage,
        hasStudiedChinese: data.hasStudiedChinese,
        yearsStudied: data.yearsStudied,
        previousMethods: data.previousMethods,
        primaryGoal: 'general', // Will be updated in next step
      })
      .onConflictDoUpdate({
        target: learningPreferences.userId,
        set: {
          nativeLanguage: data.nativeLanguage,
          hasStudiedChinese: data.hasStudiedChinese,
          yearsStudied: data.yearsStudied,
          previousMethods: data.previousMethods,
          updatedAt: new Date(),
        },
      });

    return c.json({
      success: true,
      data: { message: 'Language background saved' },
    });
  }
);

const learningGoalsSchema = z.object({
  primaryGoal: z.enum(['travel', 'work', 'academic', 'heritage', 'media', 'general']),
  weeklyHoursTarget: z.number().int().min(1).max(40).default(5),
  targetHskLevel: z.number().int().min(1).max(6).optional(),
});

/**
 * POST /api/v1/onboarding/learning-goals
 * Save learning goals
 */
onboardingRoutes.post('/learning-goals', zValidator('json', learningGoalsSchema), async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  await db
    .insert(learningPreferences)
    .values({
      userId: user.id,
      primaryGoal: data.primaryGoal,
      weeklyHoursTarget: data.weeklyHoursTarget,
      targetHskLevel: data.targetHskLevel,
    })
    .onConflictDoUpdate({
      target: learningPreferences.userId,
      set: {
        primaryGoal: data.primaryGoal,
        weeklyHoursTarget: data.weeklyHoursTarget,
        targetHskLevel: data.targetHskLevel,
        updatedAt: new Date(),
      },
    });

  return c.json({
    success: true,
    data: { message: 'Learning goals saved' },
  });
});

/**
 * GET /api/v1/onboarding/assessment/questions
 * Get HSK assessment questions based on starting level guess
 */
onboardingRoutes.get('/assessment/questions', async (c) => {
  const user = c.get('user');
  const startLevel = parseInt(c.req.query('startLevel') || '1', 10);

  // Get preferences to check if they have studied before
  const preferences = await db.query.learningPreferences.findFirst({
    where: eq(learningPreferences.userId, user.id),
  });

  // Estimate starting level based on background
  let estimatedLevel = startLevel;
  if (preferences?.hasStudiedChinese && preferences?.yearsStudied) {
    // Rough estimate: 1 year = 1 HSK level
    estimatedLevel = Math.min(6, Math.max(1, Math.floor(preferences.yearsStudied)));
  }

  // Get questions for the assessment
  const questions = getHskAssessmentQuestions(estimatedLevel);

  // Log assessment start
  await db.insert(onboardingEvents).values({
    userId: user.id,
    eventType: 'assessment_started',
    step: 'hsk_assessment',
    data: { startLevel: estimatedLevel, questionCount: questions.length },
  });

  return c.json({
    success: true,
    data: {
      startLevel: estimatedLevel,
      questions: questions.map((q, i) => ({
        id: i,
        type: q.type,
        question: q.question,
        options: q.options,
        hskLevel: q.hskLevel,
        // Don't send the correct answer to client
      })),
      totalQuestions: questions.length,
    },
  });
});

const submitAssessmentSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.number(),
      answer: z.string(),
      timeSpentMs: z.number().optional(),
    })
  ),
  totalTimeSeconds: z.number().int().min(0),
});

/**
 * POST /api/v1/onboarding/assessment/submit
 * Submit HSK assessment answers and get results
 */
onboardingRoutes.post(
  '/assessment/submit',
  zValidator('json', submitAssessmentSchema),
  async (c) => {
    const user = c.get('user');
    const { answers, totalTimeSeconds } = c.req.valid('json');

    // Get preferences to determine start level
    const preferences = await db.query.learningPreferences.findFirst({
      where: eq(learningPreferences.userId, user.id),
    });

    let estimatedLevel = 1;
    if (preferences?.hasStudiedChinese && preferences?.yearsStudied) {
      estimatedLevel = Math.min(6, Math.max(1, Math.floor(preferences.yearsStudied)));
    }

    // Get the questions that were asked
    const questions = getHskAssessmentQuestions(estimatedLevel);

    // Evaluate the assessment
    const evaluation = evaluateAssessment(questions, answers);

    // Save assessment results
    const [assessment] = await db
      .insert(hskAssessment)
      .values({
        userId: user.id,
        assessedLevel: evaluation.assessedLevel,
        confidenceScore: evaluation.confidenceScore,
        questionsAnswered: answers.length,
        correctAnswers: evaluation.correctAnswers,
        timeSpentSeconds: totalTimeSeconds,
        levelBreakdown: evaluation.levelBreakdown,
        questionResults: evaluation.questionResults,
      })
      .returning();

    // Update user settings with assessed HSK level
    await db
      .update(users)
      .set({
        settings: {
          ...((await db.query.users.findFirst({ where: eq(users.id, user.id) }))?.settings || {}),
          hskLevel: evaluation.assessedLevel,
        },
      })
      .where(eq(users.id, user.id));

    // Log assessment completion
    await db.insert(onboardingEvents).values({
      userId: user.id,
      eventType: 'assessment_completed',
      step: 'hsk_assessment',
      data: {
        assessedLevel: evaluation.assessedLevel,
        confidenceScore: evaluation.confidenceScore,
        correctAnswers: evaluation.correctAnswers,
        totalQuestions: questions.length,
      },
    });

    log.info('HSK assessment completed', {
      userId: user.id,
      assessedLevel: evaluation.assessedLevel,
      confidence: evaluation.confidenceScore,
    });

    return c.json({
      success: true,
      data: {
        assessedLevel: evaluation.assessedLevel,
        confidenceScore: evaluation.confidenceScore,
        correctAnswers: evaluation.correctAnswers,
        totalQuestions: questions.length,
        levelBreakdown: evaluation.levelBreakdown,
        recommendation: getAssessmentRecommendation(evaluation.assessedLevel, evaluation.confidenceScore),
      },
    });
  }
);

const preferencesSchema = z.object({
  preferredContentTypes: z.array(z.string()).default([]),
  preferredGenres: z.array(z.string()).default([]),
  interestTopics: z.array(z.string()).default([]),
  preferredSessionLength: z.number().int().min(5).max(120).default(15),
  preferVoiceInput: z.boolean().default(false),
  preferWritingPractice: z.boolean().default(false),
  preferredStudyTimes: z.array(z.string()).default([]),
  reminderEnabled: z.boolean().default(true),
  reminderTime: z.string().optional(),
  timezone: z.string().optional(),
});

/**
 * POST /api/v1/onboarding/preferences
 * Save content and learning style preferences
 */
onboardingRoutes.post('/preferences', zValidator('json', preferencesSchema), async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  await db
    .insert(learningPreferences)
    .values({
      userId: user.id,
      primaryGoal: 'general', // Will be set already
      ...data,
    })
    .onConflictDoUpdate({
      target: learningPreferences.userId,
      set: {
        ...data,
        updatedAt: new Date(),
      },
    });

  return c.json({
    success: true,
    data: { message: 'Preferences saved' },
  });
});

/**
 * GET /api/v1/onboarding/recommendations
 * Get personalized content recommendations
 */
onboardingRoutes.get('/recommendations', async (c) => {
  const user = c.get('user');
  const category = c.req.query('category') || 'for_you';
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 50);

  const recommendations = await db.query.recommendedContent.findMany({
    where: and(
      eq(recommendedContent.userId, user.id),
      eq(recommendedContent.category, category),
      eq(recommendedContent.isDismissed, false)
    ),
    orderBy: [desc(recommendedContent.matchScore), asc(recommendedContent.position)],
    limit,
  });

  return c.json({
    success: true,
    data: {
      recommendations,
    },
  });
});

const dismissRecommendationSchema = z.object({
  contentId: z.string().uuid(),
  reason: z.string().optional(),
});

/**
 * POST /api/v1/onboarding/recommendations/dismiss
 * Dismiss a recommendation
 */
onboardingRoutes.post(
  '/recommendations/dismiss',
  zValidator('json', dismissRecommendationSchema),
  async (c) => {
    const user = c.get('user');
    const { contentId, reason } = c.req.valid('json');

    await db
      .update(recommendedContent)
      .set({ isDismissed: true })
      .where(
        and(eq(recommendedContent.id, contentId), eq(recommendedContent.userId, user.id))
      );

    // Log dismissal for improving recommendations
    await db.insert(onboardingEvents).values({
      userId: user.id,
      eventType: 'recommendation_dismissed',
      data: { contentId, reason },
    });

    return c.json({
      success: true,
      data: { message: 'Recommendation dismissed' },
    });
  }
);

/**
 * POST /api/v1/onboarding/recommendations/start
 * Mark a recommendation as started
 */
onboardingRoutes.post(
  '/recommendations/start',
  zValidator('json', z.object({ contentId: z.string().uuid() })),
  async (c) => {
    const user = c.get('user');
    const { contentId } = c.req.valid('json');

    await db
      .update(recommendedContent)
      .set({ isStarted: true, isViewed: true })
      .where(
        and(eq(recommendedContent.id, contentId), eq(recommendedContent.userId, user.id))
      );

    return c.json({
      success: true,
      data: { message: 'Recommendation started' },
    });
  }
);

/**
 * POST /api/v1/onboarding/refresh-recommendations
 * Refresh recommendations based on updated preferences
 */
onboardingRoutes.post('/refresh-recommendations', async (c) => {
  const user = c.get('user');

  try {
    const count = await generateRecommendations(user.id);
    log.info('Recommendations refreshed', { userId: user.id, count });

    return c.json({
      success: true,
      data: { message: 'Recommendations refreshed', count },
    });
  } catch (error) {
    log.error('Failed to refresh recommendations', error as Error, { userId: user.id });
    throw AppError.internal('Failed to refresh recommendations');
  }
});

/**
 * Helper function to generate recommendation text based on assessment
 */
function getAssessmentRecommendation(level: number, confidence: number): string {
  const levelNames = ['', 'Beginner', 'Elementary', 'Intermediate', 'Upper-Intermediate', 'Advanced', 'Proficient'];
  const levelName = levelNames[level] || 'Beginner';

  if (confidence >= 80) {
    return `Your Chinese level is assessed as HSK ${level} (${levelName}). We're confident in this assessment and will tailor content to challenge you appropriately.`;
  } else if (confidence >= 60) {
    return `Your Chinese level appears to be around HSK ${level} (${levelName}). We'll start you at this level and adjust as you progress.`;
  } else {
    return `Based on your answers, we estimate you're at HSK ${level} (${levelName}). Don't worry if this doesn't feel exact - we'll quickly adapt to your actual level as you learn.`;
  }
}
