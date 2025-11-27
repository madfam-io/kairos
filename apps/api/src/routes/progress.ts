import { Hono } from 'hono';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import {
  getHskProgress,
  getVocabularyTree,
  getLearningVelocity,
  getMilestones,
  getProgressSummary,
  getRetentionCurve,
  getStudyTimeDistribution,
} from '../services/progress';

export const progressRoutes = new Hono<AuthenticatedEnv>();

// All progress routes require authentication
progressRoutes.use('*', requireAuth());

/**
 * GET /api/v1/progress/summary
 * Get overall progress summary
 */
progressRoutes.get('/summary', async (c) => {
  const user = c.get('user');

  const summary = await getProgressSummary(user.id);

  return c.json({
    success: true,
    data: summary,
  });
});

/**
 * GET /api/v1/progress/hsk
 * Get HSK level progress breakdown
 */
progressRoutes.get('/hsk', async (c) => {
  const user = c.get('user');

  const progress = await getHskProgress(user.id);

  return c.json({
    success: true,
    data: progress,
  });
});

/**
 * GET /api/v1/progress/vocabulary-tree
 * Get vocabulary tree for visualization
 */
progressRoutes.get('/vocabulary-tree', async (c) => {
  const user = c.get('user');

  const tree = await getVocabularyTree(user.id);

  return c.json({
    success: true,
    data: tree,
  });
});

/**
 * GET /api/v1/progress/velocity
 * Get learning velocity over time
 */
progressRoutes.get('/velocity', async (c) => {
  const user = c.get('user');
  const days = Math.min(parseInt(c.req.query('days') || '30', 10), 365);

  const velocity = await getLearningVelocity(user.id, days);

  return c.json({
    success: true,
    data: velocity,
  });
});

/**
 * GET /api/v1/progress/milestones
 * Get milestone progress
 */
progressRoutes.get('/milestones', async (c) => {
  const user = c.get('user');

  const milestones = await getMilestones(user.id);

  // Separate achieved and pending
  const achieved = milestones.filter(m => m.isAchieved);
  const pending = milestones.filter(m => !m.isAchieved);

  // Sort pending by progress (closest to completion first)
  pending.sort((a, b) => (b.progress / b.target) - (a.progress / a.target));

  return c.json({
    success: true,
    data: {
      achieved,
      pending,
      total: milestones.length,
      completedCount: achieved.length,
    },
  });
});

/**
 * GET /api/v1/progress/retention
 * Get retention curve data
 */
progressRoutes.get('/retention', async (c) => {
  const user = c.get('user');

  const retention = await getRetentionCurve(user.id);

  return c.json({
    success: true,
    data: retention,
  });
});

/**
 * GET /api/v1/progress/study-time
 * Get study time distribution by hour
 */
progressRoutes.get('/study-time', async (c) => {
  const user = c.get('user');

  const distribution = await getStudyTimeDistribution(user.id);

  // Find peak study hour
  const peakHour = distribution.reduce((max, curr) =>
    curr.minutes > max.minutes ? curr : max
  , distribution[0]);

  return c.json({
    success: true,
    data: {
      distribution,
      peakHour: peakHour?.hour,
      totalMinutes: distribution.reduce((sum, d) => sum + d.minutes, 0),
    },
  });
});

/**
 * GET /api/v1/progress/charts
 * Get all chart data in one request (for dashboard)
 */
progressRoutes.get('/charts', async (c) => {
  const user = c.get('user');
  const days = Math.min(parseInt(c.req.query('days') || '30', 10), 365);

  const [velocity, hskProgress, retention, studyTime] = await Promise.all([
    getLearningVelocity(user.id, days),
    getHskProgress(user.id),
    getRetentionCurve(user.id),
    getStudyTimeDistribution(user.id),
  ]);

  return c.json({
    success: true,
    data: {
      velocity,
      hskProgress,
      retention,
      studyTimeDistribution: studyTime,
    },
  });
});
