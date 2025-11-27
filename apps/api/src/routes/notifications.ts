/**
 * Notification Routes
 *
 * Endpoints for push token management and notification preferences.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import {
  registerPushToken,
  unregisterPushToken,
} from '../services/push-notifications';
import { log } from '../lib/logger';

const notifications = new Hono<AppEnv>();

// All routes require authentication
notifications.use('*', authMiddleware);

// =============================================================================
// Push Token Management
// =============================================================================

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  deviceId: z.string().optional(),
});

/**
 * Register a push token
 */
notifications.post(
  '/push-token',
  zValidator('json', registerTokenSchema),
  async (c) => {
    const userId = c.get('userId');
    const { token, platform, deviceId } = c.req.valid('json');

    try {
      await registerPushToken(userId, token, platform, deviceId);

      return c.json({
        success: true,
        data: {
          message: 'Push token registered successfully',
        },
      });
    } catch (error) {
      log.error('Failed to register push token', error as Error, { userId });
      return c.json(
        {
          success: false,
          error: {
            code: 'REGISTRATION_FAILED',
            message: (error as Error).message,
          },
        },
        400
      );
    }
  }
);

/**
 * Unregister a push token
 */
notifications.delete('/push-token', zValidator('json', z.object({ token: z.string() })), async (c) => {
  const { token } = c.req.valid('json');

  try {
    await unregisterPushToken(token);

    return c.json({
      success: true,
      data: {
        message: 'Push token unregistered successfully',
      },
    });
  } catch (error) {
    log.error('Failed to unregister push token', error as Error);
    return c.json(
      {
        success: false,
        error: {
          code: 'UNREGISTRATION_FAILED',
          message: (error as Error).message,
        },
      },
      400
    );
  }
});

// =============================================================================
// Notification Preferences
// =============================================================================

const preferencesSchema = z.object({
  streakReminders: z.boolean().optional(),
  reviewReminders: z.boolean().optional(),
  achievementAlerts: z.boolean().optional(),
  socialUpdates: z.boolean().optional(),
  weeklySummary: z.boolean().optional(),
  reminderTime: z
    .object({
      hour: z.number().min(0).max(23),
      minute: z.number().min(0).max(59),
    })
    .optional(),
  quietHours: z
    .object({
      enabled: z.boolean(),
      start: z.object({ hour: z.number(), minute: z.number() }),
      end: z.object({ hour: z.number(), minute: z.number() }),
    })
    .optional(),
});

/**
 * Get notification preferences
 */
notifications.get('/preferences', async (c) => {
  const userId = c.get('userId');

  // Default preferences - would come from database
  const preferences = {
    streakReminders: true,
    reviewReminders: true,
    achievementAlerts: true,
    socialUpdates: true,
    weeklySummary: true,
    reminderTime: { hour: 19, minute: 0 }, // 7 PM
    quietHours: {
      enabled: false,
      start: { hour: 22, minute: 0 },
      end: { hour: 8, minute: 0 },
    },
  };

  return c.json({
    success: true,
    data: preferences,
  });
});

/**
 * Update notification preferences
 */
notifications.patch(
  '/preferences',
  zValidator('json', preferencesSchema),
  async (c) => {
    const userId = c.get('userId');
    const updates = c.req.valid('json');

    // Would update in database
    log.info('Notification preferences updated', { userId, updates });

    return c.json({
      success: true,
      data: {
        message: 'Preferences updated successfully',
        preferences: updates,
      },
    });
  }
);

// =============================================================================
// Notification History
// =============================================================================

/**
 * Get notification history (in-app notifications)
 */
notifications.get('/history', async (c) => {
  const userId = c.get('userId');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  // Would fetch from database
  const notifications = [
    {
      id: '1',
      type: 'achievement_earned',
      title: 'Achievement Unlocked!',
      body: "You've earned the 'Week Warrior' achievement!",
      read: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      type: 'level_up',
      title: 'Level Up!',
      body: "Congratulations! You've reached Level 12!",
      read: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  return c.json({
    success: true,
    data: notifications,
    meta: {
      pagination: {
        limit,
        offset,
        total: notifications.length,
        hasMore: false,
      },
    },
  });
});

/**
 * Mark notification as read
 */
notifications.patch('/history/:id/read', async (c) => {
  const userId = c.get('userId');
  const notificationId = c.req.param('id');

  // Would update in database
  log.debug('Notification marked as read', { userId, notificationId });

  return c.json({
    success: true,
    data: {
      message: 'Notification marked as read',
    },
  });
});

/**
 * Mark all notifications as read
 */
notifications.post('/history/read-all', async (c) => {
  const userId = c.get('userId');

  // Would update in database
  log.debug('All notifications marked as read', { userId });

  return c.json({
    success: true,
    data: {
      message: 'All notifications marked as read',
    },
  });
});

/**
 * Get unread notification count
 */
notifications.get('/unread-count', async (c) => {
  const userId = c.get('userId');

  // Would count from database
  const count = 3;

  return c.json({
    success: true,
    data: {
      count,
    },
  });
});

export { notifications as notificationRoutes };
