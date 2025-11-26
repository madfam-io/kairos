import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { DEFAULT_USER_SETTINGS } from '@kairos/types';

export const userRoutes = new Hono<AuthenticatedEnv>();

// All user routes require authentication
userRoutes.use('*', requireAuth());

const updateSettingsSchema = z.object({
  hskLevel: z.number().int().min(1).max(6).optional(),
  showPinyin: z.boolean().optional(),
  autoPlayAudio: z.boolean().optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
  simplificationEnabled: z.boolean().optional(),
  knownWordsHidden: z.boolean().optional(),
  keyboardShortcutsEnabled: z.boolean().optional(),
  locale: z.enum(['en', 'zh-Hans', 'zh-Hant']).optional(),
});

/**
 * GET /api/v1/user/profile
 */
userRoutes.get('/profile', async (c) => {
  const user = c.get('user');

  // TODO: Fetch full stats from database
  const stats = {
    totalWordsLearned: 0,
    totalCardsMined: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalStudyTimeMinutes: 0,
    lastActiveAt: null,
  };

  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      subscriptionTier: user.subscriptionTier,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      settings: { ...DEFAULT_USER_SETTINGS, ...user.settings },
      stats,
    },
  });
});

/**
 * PATCH /api/v1/user/profile
 */
userRoutes.patch('/profile', zValidator('json', updateSettingsSchema), async (c) => {
  const user = c.get('user');
  const updates = c.req.valid('json');

  // TODO: Update settings in database
  const updatedSettings = {
    ...DEFAULT_USER_SETTINGS,
    ...user.settings,
    ...updates,
  };

  return c.json({
    success: true,
    data: {
      settings: updatedSettings,
    },
  });
});

/**
 * GET /api/v1/user/subscription
 */
userRoutes.get('/subscription', async (c) => {
  const user = c.get('user');

  // TODO: Fetch from Stripe
  return c.json({
    success: true,
    data: {
      tier: user.subscriptionTier,
      status: 'active',
      currentPeriodEnd: user.subscriptionExpiresAt,
      cancelAtPeriodEnd: false,
    },
  });
});

/**
 * GET /api/v1/user/usage
 */
userRoutes.get('/usage', async (c) => {
  // TODO: Fetch usage stats from database
  return c.json({
    success: true,
    data: {
      cardsMinedToday: 0,
      aiSentencesThisMonth: 0,
      periodStart: new Date(),
      periodEnd: new Date(),
    },
  });
});

/**
 * DELETE /api/v1/user/account
 */
userRoutes.delete('/account', async (c) => {
  const user = c.get('user');

  // TODO: Implement account deletion
  // - Cancel Stripe subscription
  // - Delete all user data
  // - Delete auth account

  return c.json({
    success: true,
    data: { message: 'Account deletion initiated' },
  });
});

/**
 * GET /api/v1/user/export
 */
userRoutes.get('/export', async (c) => {
  const user = c.get('user');

  // TODO: Generate data export
  return c.json({
    success: true,
    data: {
      exportUrl: null,
      status: 'pending',
      message: 'Export will be ready shortly',
    },
  });
});
