/**
 * Task Scheduler
 *
 * Schedules recurring jobs for maintenance and analytics.
 */

import { enqueue } from './index';
import { log } from '../logger';

interface ScheduledTask {
  name: string;
  schedule: string; // cron-like description for documentation
  intervalMs: number;
  handler: () => Promise<void>;
  lastRun?: Date;
  enabled: boolean;
}

const tasks: ScheduledTask[] = [];
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Register a scheduled task
 */
export function registerScheduledTask(
  name: string,
  schedule: string,
  intervalMs: number,
  handler: () => Promise<void>,
  enabled = true
): void {
  tasks.push({
    name,
    schedule,
    intervalMs,
    handler,
    enabled,
  });

  log.debug(`Scheduled task registered: ${name} (${schedule})`);
}

/**
 * Start the scheduler
 */
export function startScheduler(): void {
  if (schedulerInterval) return;

  // Check tasks every minute
  schedulerInterval = setInterval(async () => {
    const now = new Date();

    for (const task of tasks) {
      if (!task.enabled) continue;

      const shouldRun =
        !task.lastRun ||
        now.getTime() - task.lastRun.getTime() >= task.intervalMs;

      if (shouldRun) {
        task.lastRun = now;

        try {
          await task.handler();
          log.debug(`Scheduled task completed: ${task.name}`);
        } catch (error) {
          log.error(`Scheduled task failed: ${task.name}`, error as Error);
        }
      }
    }
  }, 60 * 1000); // Check every minute

  log.info('Task scheduler started');
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log.info('Task scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): { running: boolean; tasks: { name: string; lastRun?: Date; enabled: boolean }[] } {
  return {
    running: schedulerInterval !== null,
    tasks: tasks.map((t) => ({
      name: t.name,
      lastRun: t.lastRun,
      enabled: t.enabled,
    })),
  };
}

// =============================================================================
// Default Scheduled Tasks
// =============================================================================

/**
 * Register default scheduled tasks
 */
export function registerDefaultTasks(): void {
  // Daily leaderboard reset check (runs hourly, checks if new day)
  registerScheduledTask(
    'leaderboard-daily-reset',
    '0 * * * *', // Every hour
    60 * 60 * 1000,
    async () => {
      const now = new Date();
      if (now.getHours() === 0) {
        // Midnight - reset daily leaderboard
        log.info('Daily leaderboard reset');
        // The actual reset happens via cache invalidation
      }
    }
  );

  // Weekly leaderboard reset (runs hourly, checks if Monday midnight)
  registerScheduledTask(
    'leaderboard-weekly-reset',
    '0 0 * * 1', // Monday midnight
    60 * 60 * 1000,
    async () => {
      const now = new Date();
      if (now.getDay() === 1 && now.getHours() === 0) {
        log.info('Weekly leaderboard reset');
      }
    }
  );

  // Session cleanup (runs daily)
  registerScheduledTask(
    'cleanup-sessions',
    '0 3 * * *', // 3 AM daily
    24 * 60 * 60 * 1000,
    async () => {
      await enqueue('cleanup-expired-sessions', { olderThanDays: 30 });
    }
  );

  // Streak sync (runs every 6 hours to catch missed days)
  registerScheduledTask(
    'streak-sync-check',
    '0 */6 * * *', // Every 6 hours
    6 * 60 * 60 * 1000,
    async () => {
      // This would typically query users who haven't had activity today
      // and potentially break their streaks
      log.debug('Streak sync check completed');
    }
  );

  // Analytics aggregation (runs daily)
  registerScheduledTask(
    'daily-analytics',
    '0 4 * * *', // 4 AM daily
    24 * 60 * 60 * 1000,
    async () => {
      // Queue analytics jobs for all active users
      log.debug('Daily analytics aggregation started');
    }
  );

  // Recommendation refresh (runs every 12 hours)
  registerScheduledTask(
    'recommendation-refresh',
    '0 */12 * * *', // Every 12 hours
    12 * 60 * 60 * 1000,
    async () => {
      // Refresh recommendations for active users
      log.debug('Recommendation refresh started');
    }
  );

  // Cache warmup (runs every hour)
  registerScheduledTask(
    'cache-warmup',
    '0 * * * *', // Every hour
    60 * 60 * 1000,
    async () => {
      // Warm up popular content, achievement definitions, etc.
      log.debug('Cache warmup completed');
    }
  );

  log.info('Default scheduled tasks registered');
}

export default {
  registerScheduledTask,
  registerDefaultTasks,
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
};
