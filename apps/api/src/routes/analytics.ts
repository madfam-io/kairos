import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import {
  generateMockProgressData,
  generateMockSummary,
  generateMockHeatmap,
  calculateMilestones,
} from '../services/analytics';

export const analyticsRoutes = new Hono<AuthenticatedEnv>();

analyticsRoutes.use('*', requireAuth());

const eventSchema = z.object({
  eventType: z.enum([
    'session_start',
    'session_end',
    'video_play',
    'video_pause',
    'word_lookup',
    'card_mined',
    'card_exported',
    'simplification_used',
    'pitch_practice',
    'settings_changed',
    'error_occurred',
    'reader_opened',
    'shadowing_completed',
  ]),
  eventData: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

const batchEventSchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
});

const progressQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
});

/**
 * POST /api/v1/analytics/event
 * Track a single analytics event
 */
analyticsRoutes.post('/event', zValidator('json', eventSchema), async (c) => {
  const event = c.req.valid('json');
  const user = c.get('user');

  // TODO: Insert into analytics_events table
  // TODO: Update user stats if needed (e.g., streak, study time)

  return c.json({
    success: true,
    data: { recorded: true },
  });
});

/**
 * POST /api/v1/analytics/events
 * Track multiple analytics events in batch
 */
analyticsRoutes.post('/events', zValidator('json', batchEventSchema), async (c) => {
  const { events } = c.req.valid('json');
  const user = c.get('user');

  // TODO: Batch insert into analytics_events table
  return c.json({
    success: true,
    data: { recorded: events.length },
  });
});

/**
 * GET /api/v1/analytics/progress
 * Get learning progress over time
 */
analyticsRoutes.get('/progress', zValidator('query', progressQuerySchema), async (c) => {
  const { startDate, endDate, granularity } = c.req.valid('query');
  const user = c.get('user');

  // Calculate date range
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days

  const progressData = generateMockProgressData(start, end, granularity);

  return c.json({
    success: true,
    data: progressData,
  });
});

/**
 * GET /api/v1/analytics/summary
 * Get summary stats for dashboard
 */
analyticsRoutes.get('/summary', async (c) => {
  const user = c.get('user');

  const summary = generateMockSummary();

  return c.json({
    success: true,
    data: summary,
  });
});

/**
 * GET /api/v1/analytics/heatmap
 * Get activity heatmap data (GitHub-style)
 */
analyticsRoutes.get('/heatmap', async (c) => {
  const user = c.get('user');

  const heatmap = generateMockHeatmap(365);

  return c.json({
    success: true,
    data: heatmap,
  });
});

/**
 * GET /api/v1/analytics/milestones
 * Get achievement milestones
 */
analyticsRoutes.get('/milestones', async (c) => {
  const user = c.get('user');

  const summary = generateMockSummary();
  const milestones = calculateMilestones(summary);

  return c.json({
    success: true,
    data: {
      milestones,
      achievedCount: milestones.filter((m) => m.achieved).length,
      totalCount: milestones.length,
    },
  });
});
