/**
 * Push Notification Service
 *
 * Handles sending push notifications to mobile devices via Expo Push Notifications.
 */

import { log } from '../lib/logger';
import { getEnv } from '../lib/env';
import { db } from '../db';
import { eq, and, inArray } from 'drizzle-orm';

// =============================================================================
// Types
// =============================================================================

export interface PushToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface PushNotification {
  to: string | string[]; // Expo push token(s)
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  categoryId?: string;
  ttl?: number; // seconds
}

export interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded' | 'InvalidCredentials';
  };
}

export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: {
    error?: string;
  };
}

// Notification types for the app
export type NotificationType =
  | 'streak_reminder'
  | 'review_due'
  | 'achievement_earned'
  | 'goal_completed'
  | 'level_up'
  | 'new_content'
  | 'study_group_activity'
  | 'friend_activity'
  | 'weekly_summary';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

// =============================================================================
// Constants
// =============================================================================

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';
const MAX_BATCH_SIZE = 100; // Expo's limit

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Send a push notification to a single token
 */
export async function sendPushNotification(
  token: string,
  notification: NotificationPayload
): Promise<ExpoPushTicket> {
  return sendPushNotifications([token], notification).then((tickets) => tickets[0]);
}

/**
 * Send push notifications to multiple tokens
 */
export async function sendPushNotifications(
  tokens: string[],
  notification: NotificationPayload
): Promise<ExpoPushTicket[]> {
  if (tokens.length === 0) {
    return [];
  }

  // Filter valid Expo push tokens
  const validTokens = tokens.filter((token) => isExpoPushToken(token));

  if (validTokens.length === 0) {
    log.warn('No valid Expo push tokens found');
    return tokens.map(() => ({ status: 'error', message: 'Invalid token format' }));
  }

  // Build notification messages
  const messages: PushNotification[] = validTokens.map((token) => ({
    to: token,
    title: notification.title,
    body: notification.body,
    data: {
      type: notification.type,
      ...notification.data,
    },
    sound: 'default',
    badge: notification.badge,
    priority: 'high',
    channelId: getChannelForType(notification.type),
  }));

  // Send in batches
  const allTickets: ExpoPushTicket[] = [];

  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const batch = messages.slice(i, i + MAX_BATCH_SIZE);
    const tickets = await sendBatch(batch);
    allTickets.push(...tickets);
  }

  // Handle failed tokens
  const failedTokens: string[] = [];
  allTickets.forEach((ticket, index) => {
    if (
      ticket.status === 'error' &&
      ticket.details?.error === 'DeviceNotRegistered'
    ) {
      failedTokens.push(validTokens[index]);
    }
  });

  // Remove invalid tokens from database
  if (failedTokens.length > 0) {
    await removeInvalidTokens(failedTokens);
  }

  return allTickets;
}

/**
 * Send a batch of notifications to Expo
 */
async function sendBatch(messages: PushNotification[]): Promise<ExpoPushTicket[]> {
  try {
    const response = await fetch(EXPO_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      throw new Error(`Expo API error: ${response.status}`);
    }

    const result = await response.json();
    return result.data as ExpoPushTicket[];
  } catch (error) {
    log.error('Failed to send push notifications', error as Error);
    return messages.map(() => ({
      status: 'error' as const,
      message: (error as Error).message,
    }));
  }
}

/**
 * Check if a string is a valid Expo push token
 */
function isExpoPushToken(token: string): boolean {
  return (
    typeof token === 'string' &&
    (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))
  );
}

/**
 * Get the notification channel for a notification type
 */
function getChannelForType(type: NotificationType): string {
  switch (type) {
    case 'streak_reminder':
    case 'review_due':
      return 'reminders';
    case 'achievement_earned':
    case 'goal_completed':
    case 'level_up':
      return 'achievements';
    case 'study_group_activity':
    case 'friend_activity':
      return 'social';
    case 'new_content':
    case 'weekly_summary':
      return 'updates';
    default:
      return 'default';
  }
}

/**
 * Remove invalid tokens from the database
 */
async function removeInvalidTokens(tokens: string[]): Promise<void> {
  try {
    // This would delete from a push_tokens table
    // await db.delete(pushTokens).where(inArray(pushTokens.token, tokens));
    log.info(`Removed ${tokens.length} invalid push tokens`);
  } catch (error) {
    log.error('Failed to remove invalid tokens', error as Error);
  }
}

// =============================================================================
// High-Level Notification Functions
// =============================================================================

/**
 * Send a streak reminder notification
 */
export async function sendStreakReminder(
  userId: string,
  currentStreak: number
): Promise<void> {
  const tokens = await getUserPushTokens(userId);
  if (tokens.length === 0) return;

  await sendPushNotifications(tokens, {
    type: 'streak_reminder',
    title: 'Keep Your Streak Going!',
    body: `You have a ${currentStreak}-day streak. Don't break it now!`,
    data: { streakDays: currentStreak },
  });

  log.info(`Streak reminder sent to user ${userId}`);
}

/**
 * Send a review due notification
 */
export async function sendReviewDueNotification(
  userId: string,
  dueCount: number
): Promise<void> {
  const tokens = await getUserPushTokens(userId);
  if (tokens.length === 0) return;

  await sendPushNotifications(tokens, {
    type: 'review_due',
    title: 'Cards Ready for Review',
    body: `You have ${dueCount} cards due for review. Keep your memory fresh!`,
    badge: dueCount,
    data: { dueCount },
  });

  log.info(`Review due notification sent to user ${userId}`, { dueCount });
}

/**
 * Send an achievement earned notification
 */
export async function sendAchievementNotification(
  userId: string,
  achievementName: string,
  achievementIcon: string,
  xpAwarded: number
): Promise<void> {
  const tokens = await getUserPushTokens(userId);
  if (tokens.length === 0) return;

  await sendPushNotifications(tokens, {
    type: 'achievement_earned',
    title: 'Achievement Unlocked!',
    body: `${achievementIcon} ${achievementName} - You earned ${xpAwarded} XP!`,
    data: { achievementName, xpAwarded },
  });

  log.info(`Achievement notification sent to user ${userId}`, { achievementName });
}

/**
 * Send a level up notification
 */
export async function sendLevelUpNotification(
  userId: string,
  newLevel: number
): Promise<void> {
  const tokens = await getUserPushTokens(userId);
  if (tokens.length === 0) return;

  await sendPushNotifications(tokens, {
    type: 'level_up',
    title: 'Level Up!',
    body: `Congratulations! You've reached Level ${newLevel}!`,
    data: { level: newLevel },
  });

  log.info(`Level up notification sent to user ${userId}`, { newLevel });
}

/**
 * Send a daily goal completed notification
 */
export async function sendGoalCompletedNotification(
  userId: string,
  goalType: 'daily' | 'weekly'
): Promise<void> {
  const tokens = await getUserPushTokens(userId);
  if (tokens.length === 0) return;

  await sendPushNotifications(tokens, {
    type: 'goal_completed',
    title: `${goalType === 'daily' ? 'Daily' : 'Weekly'} Goal Complete!`,
    body:
      goalType === 'daily'
        ? "Great job! You've completed your daily learning goal."
        : "Amazing! You've crushed your weekly learning target!",
    data: { goalType },
  });

  log.info(`Goal completed notification sent to user ${userId}`, { goalType });
}

/**
 * Send a weekly summary notification
 */
export async function sendWeeklySummaryNotification(
  userId: string,
  stats: {
    wordsLearned: number;
    minutesStudied: number;
    streak: number;
  }
): Promise<void> {
  const tokens = await getUserPushTokens(userId);
  if (tokens.length === 0) return;

  await sendPushNotifications(tokens, {
    type: 'weekly_summary',
    title: 'Your Weekly Progress',
    body: `You learned ${stats.wordsLearned} words and studied for ${stats.minutesStudied} minutes this week!`,
    data: stats,
  });

  log.info(`Weekly summary sent to user ${userId}`, stats);
}

// =============================================================================
// Token Management
// =============================================================================

/**
 * Get all push tokens for a user
 */
async function getUserPushTokens(userId: string): Promise<string[]> {
  try {
    // This would query from a push_tokens table
    // const tokens = await db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
    // return tokens.map(t => t.token);

    // Placeholder - return empty for now
    return [];
  } catch (error) {
    log.error('Failed to get user push tokens', error as Error, { userId });
    return [];
  }
}

/**
 * Register a push token for a user
 */
export async function registerPushToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web',
  deviceId?: string
): Promise<void> {
  if (!isExpoPushToken(token)) {
    throw new Error('Invalid Expo push token format');
  }

  try {
    // This would upsert into a push_tokens table
    // await db.insert(pushTokens).values({
    //   userId,
    //   token,
    //   platform,
    //   deviceId,
    //   createdAt: new Date(),
    //   lastUsedAt: new Date(),
    // }).onConflictDoUpdate({
    //   target: pushTokens.token,
    //   set: { lastUsedAt: new Date() },
    // });

    log.info(`Push token registered for user ${userId}`, { platform });
  } catch (error) {
    log.error('Failed to register push token', error as Error, { userId });
    throw error;
  }
}

/**
 * Unregister a push token
 */
export async function unregisterPushToken(token: string): Promise<void> {
  try {
    // await db.delete(pushTokens).where(eq(pushTokens.token, token));
    log.info('Push token unregistered');
  } catch (error) {
    log.error('Failed to unregister push token', error as Error);
  }
}

export default {
  sendPushNotification,
  sendPushNotifications,
  sendStreakReminder,
  sendReviewDueNotification,
  sendAchievementNotification,
  sendLevelUpNotification,
  sendGoalCompletedNotification,
  sendWeeklySummaryNotification,
  registerPushToken,
  unregisterPushToken,
};
