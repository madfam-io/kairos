/**
 * Background Job Queue System
 *
 * Uses BullMQ for reliable job processing with Redis backend.
 * Provides async task processing for:
 * - XP and achievement calculations
 * - Email notifications
 * - Activity feed updates
 * - Analytics aggregation
 * - Content comprehensibility scoring
 */

import { log } from '../logger';
import { getEnv, features } from '../env';

// =============================================================================
// Types
// =============================================================================

export type JobName =
  | 'award-xp'
  | 'check-achievements'
  | 'update-leaderboard'
  | 'send-notification'
  | 'update-activity-feed'
  | 'calculate-comprehensibility'
  | 'aggregate-analytics'
  | 'send-email'
  | 'process-webhook'
  | 'cleanup-expired-sessions'
  | 'generate-recommendations'
  | 'sync-streak';

export interface JobData {
  'award-xp': {
    userId: string;
    amount: number;
    source: string;
    metadata?: Record<string, unknown>;
  };
  'check-achievements': {
    userId: string;
    trigger: string;
    metadata?: Record<string, unknown>;
  };
  'update-leaderboard': {
    userId: string;
    xpDelta: number;
    leaderboardTypes: ('daily' | 'weekly' | 'monthly' | 'allTime')[];
  };
  'send-notification': {
    userId: string;
    type: 'push' | 'email' | 'in-app';
    title: string;
    body: string;
    data?: Record<string, unknown>;
  };
  'update-activity-feed': {
    userId: string;
    activityType: string;
    content: Record<string, unknown>;
  };
  'calculate-comprehensibility': {
    userId: string;
    contentId: string;
  };
  'aggregate-analytics': {
    userId: string;
    period: 'daily' | 'weekly' | 'monthly';
    date: string;
  };
  'send-email': {
    to: string;
    template: string;
    variables: Record<string, unknown>;
  };
  'process-webhook': {
    webhookId: string;
    event: string;
    payload: Record<string, unknown>;
    attempt: number;
  };
  'cleanup-expired-sessions': {
    olderThanDays: number;
  };
  'generate-recommendations': {
    userId: string;
  };
  'sync-streak': {
    userId: string;
    date: string;
  };
}

export interface Job<T extends JobName = JobName> {
  id: string;
  name: T;
  data: JobData[T];
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processAfter?: Date;
  priority: number;
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

type JobHandler<T extends JobName> = (data: JobData[T]) => Promise<JobResult>;

// =============================================================================
// In-Memory Job Queue (Fallback)
// =============================================================================

interface QueuedJob {
  id: string;
  name: JobName;
  data: unknown;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processAfter: Date;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

class InMemoryJobQueue {
  private queue: QueuedJob[] = [];
  private handlers = new Map<JobName, JobHandler<JobName>>();
  private processing = false;
  private jobIdCounter = 0;

  async add<T extends JobName>(
    name: T,
    data: JobData[T],
    options: { delay?: number; priority?: number; attempts?: number } = {}
  ): Promise<string> {
    const id = `job_${++this.jobIdCounter}_${Date.now()}`;
    const job: QueuedJob = {
      id,
      name,
      data,
      attempts: 0,
      maxAttempts: options.attempts ?? 3,
      createdAt: new Date(),
      processAfter: new Date(Date.now() + (options.delay ?? 0)),
      priority: options.priority ?? 0,
      status: 'pending',
    };

    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);

    log.debug(`Job queued: ${name}`, { jobId: id });

    // Trigger processing
    this.processNext();

    return id;
  }

  registerHandler<T extends JobName>(name: T, handler: JobHandler<T>): void {
    this.handlers.set(name, handler as JobHandler<JobName>);
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;

    const now = new Date();
    const nextJob = this.queue.find(
      (j) => j.status === 'pending' && j.processAfter <= now
    );

    if (!nextJob) return;

    this.processing = true;
    nextJob.status = 'processing';
    nextJob.attempts++;

    const handler = this.handlers.get(nextJob.name);

    if (!handler) {
      log.warn(`No handler for job: ${nextJob.name}`);
      nextJob.status = 'failed';
      this.processing = false;
      this.processNext();
      return;
    }

    try {
      const result = await handler(nextJob.data as JobData[JobName]);

      if (result.success) {
        nextJob.status = 'completed';
        log.debug(`Job completed: ${nextJob.name}`, { jobId: nextJob.id });
      } else {
        throw new Error(result.error ?? 'Job failed');
      }
    } catch (error) {
      if (nextJob.attempts < nextJob.maxAttempts) {
        // Exponential backoff
        const backoffMs = Math.pow(2, nextJob.attempts) * 1000;
        nextJob.processAfter = new Date(Date.now() + backoffMs);
        nextJob.status = 'pending';
        log.warn(`Job failed, retrying in ${backoffMs}ms: ${nextJob.name}`, {
          jobId: nextJob.id,
          attempt: nextJob.attempts,
        });
      } else {
        nextJob.status = 'failed';
        log.error(`Job failed permanently: ${nextJob.name}`, error as Error, {
          jobId: nextJob.id,
        });
      }
    }

    this.processing = false;

    // Clean up old completed/failed jobs
    this.queue = this.queue.filter(
      (j) =>
        j.status === 'pending' ||
        j.status === 'processing' ||
        (j.status === 'completed' &&
          Date.now() - j.createdAt.getTime() < 5 * 60 * 1000)
    );

    // Process next job
    setTimeout(() => this.processNext(), 100);
  }

  getStats(): { pending: number; processing: number; completed: number; failed: number } {
    return {
      pending: this.queue.filter((j) => j.status === 'pending').length,
      processing: this.queue.filter((j) => j.status === 'processing').length,
      completed: this.queue.filter((j) => j.status === 'completed').length,
      failed: this.queue.filter((j) => j.status === 'failed').length,
    };
  }
}

// =============================================================================
// Redis Job Queue (Production)
// =============================================================================

class RedisJobQueue {
  private baseUrl: string;
  private token: string;
  private handlers = new Map<JobName, JobHandler<JobName>>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async execute<T>(command: string[]): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`Redis error: ${response.status}`);
    }

    const data = await response.json();
    return data.result as T;
  }

  async add<T extends JobName>(
    name: T,
    data: JobData[T],
    options: { delay?: number; priority?: number; attempts?: number } = {}
  ): Promise<string> {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const job = {
      id,
      name,
      data,
      attempts: 0,
      maxAttempts: options.attempts ?? 3,
      createdAt: new Date().toISOString(),
      processAfter: new Date(Date.now() + (options.delay ?? 0)).toISOString(),
      priority: options.priority ?? 0,
      status: 'pending',
    };

    // Use sorted set with score = processAfter timestamp for delayed jobs
    const score = Date.now() + (options.delay ?? 0);
    await this.execute([
      'ZADD',
      'kairos:jobs:pending',
      String(score),
      JSON.stringify(job),
    ]);

    log.debug(`Job queued (Redis): ${name}`, { jobId: id });
    return id;
  }

  registerHandler<T extends JobName>(name: T, handler: JobHandler<T>): void {
    this.handlers.set(name, handler as JobHandler<JobName>);
  }

  startWorker(): void {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      try {
        await this.processNext();
      } catch (error) {
        log.error('Job worker error', error as Error);
      }
    }, 1000);

    log.info('Job worker started (Redis)');
  }

  stopWorker(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      log.info('Job worker stopped');
    }
  }

  private async processNext(): Promise<void> {
    const now = Date.now();

    // Get jobs ready to process (score <= now)
    const results = await this.execute<string[]>([
      'ZRANGEBYSCORE',
      'kairos:jobs:pending',
      '0',
      String(now),
      'LIMIT',
      '0',
      '1',
    ]);

    if (!results || results.length === 0) return;

    const jobJson = results[0];
    const job = JSON.parse(jobJson) as QueuedJob;

    // Remove from pending queue
    await this.execute(['ZREM', 'kairos:jobs:pending', jobJson]);

    // Add to processing set
    await this.execute(['SADD', 'kairos:jobs:processing', job.id]);

    job.attempts++;

    const handler = this.handlers.get(job.name);
    if (!handler) {
      log.warn(`No handler for job: ${job.name}`);
      await this.execute(['SREM', 'kairos:jobs:processing', job.id]);
      return;
    }

    try {
      const result = await handler(job.data as JobData[JobName]);

      if (result.success) {
        // Move to completed
        await this.execute(['SREM', 'kairos:jobs:processing', job.id]);
        await this.execute([
          'LPUSH',
          'kairos:jobs:completed',
          JSON.stringify({ ...job, status: 'completed', completedAt: new Date().toISOString() }),
        ]);
        await this.execute(['LTRIM', 'kairos:jobs:completed', '0', '999']); // Keep last 1000
        log.debug(`Job completed (Redis): ${job.name}`, { jobId: job.id });
      } else {
        throw new Error(result.error ?? 'Job failed');
      }
    } catch (error) {
      await this.execute(['SREM', 'kairos:jobs:processing', job.id]);

      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        const backoffMs = Math.pow(2, job.attempts) * 1000;
        const retryAt = Date.now() + backoffMs;
        job.processAfter = new Date(retryAt).toISOString();
        job.status = 'pending';

        await this.execute([
          'ZADD',
          'kairos:jobs:pending',
          String(retryAt),
          JSON.stringify(job),
        ]);

        log.warn(`Job failed, retrying: ${job.name}`, { jobId: job.id, attempt: job.attempts });
      } else {
        // Move to failed
        await this.execute([
          'LPUSH',
          'kairos:jobs:failed',
          JSON.stringify({
            ...job,
            status: 'failed',
            error: (error as Error).message,
            failedAt: new Date().toISOString(),
          }),
        ]);
        await this.execute(['LTRIM', 'kairos:jobs:failed', '0', '999']);
        log.error(`Job failed permanently: ${job.name}`, error as Error, { jobId: job.id });
      }
    }
  }

  async getStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
    const [pending, processing, completed, failed] = await Promise.all([
      this.execute<number>(['ZCARD', 'kairos:jobs:pending']),
      this.execute<number>(['SCARD', 'kairos:jobs:processing']),
      this.execute<number>(['LLEN', 'kairos:jobs:completed']),
      this.execute<number>(['LLEN', 'kairos:jobs:failed']),
    ]);

    return { pending, processing, completed, failed };
  }
}

// =============================================================================
// Job Queue Factory
// =============================================================================

let jobQueue: InMemoryJobQueue | RedisJobQueue | null = null;

/**
 * Get or create the job queue instance
 */
export function getJobQueue(): InMemoryJobQueue | RedisJobQueue {
  if (jobQueue) return jobQueue;

  if (features.hasRedis()) {
    const env = getEnv();
    jobQueue = new RedisJobQueue(
      env.UPSTASH_REDIS_REST_URL!,
      env.UPSTASH_REDIS_REST_TOKEN!
    );
    log.info('Job queue initialized (Redis)');
  } else {
    jobQueue = new InMemoryJobQueue();
    log.info('Job queue initialized (in-memory)');
  }

  return jobQueue;
}

/**
 * Add a job to the queue
 */
export async function enqueue<T extends JobName>(
  name: T,
  data: JobData[T],
  options?: { delay?: number; priority?: number; attempts?: number }
): Promise<string> {
  const queue = getJobQueue();
  return queue.add(name, data, options);
}

/**
 * Register a job handler
 */
export function registerJobHandler<T extends JobName>(
  name: T,
  handler: JobHandler<T>
): void {
  const queue = getJobQueue();
  queue.registerHandler(name, handler);
}

/**
 * Start the job worker (for Redis queue)
 */
export function startJobWorker(): void {
  const queue = getJobQueue();
  if (queue instanceof RedisJobQueue) {
    queue.startWorker();
  }
}

/**
 * Stop the job worker
 */
export function stopJobWorker(): void {
  const queue = getJobQueue();
  if (queue instanceof RedisJobQueue) {
    queue.stopWorker();
  }
}

export default {
  getJobQueue,
  enqueue,
  registerJobHandler,
  startJobWorker,
  stopJobWorker,
};
