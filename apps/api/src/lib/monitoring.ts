/**
 * Monitoring and Health Check Utilities
 *
 * Provides comprehensive health checks, performance monitoring,
 * and alerting thresholds for the API.
 */

import { log } from './logger';
import { getCache } from './cache';

// =============================================================================
// Types
// =============================================================================

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthCheckResult[];
  metrics: SystemMetrics;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu?: {
    usage: number;
  };
  requests: {
    total: number;
    perSecond: number;
    averageLatencyMs: number;
  };
  errors: {
    total: number;
    rate: number; // errors per minute
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
}

export interface AlertThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Alert thresholds for various metrics
 */
export const alertThresholds: AlertThreshold[] = [
  { metric: 'memory.percentage', warning: 70, critical: 90, unit: '%' },
  { metric: 'requests.averageLatencyMs', warning: 500, critical: 2000, unit: 'ms' },
  { metric: 'errors.rate', warning: 10, critical: 50, unit: '/min' },
  { metric: 'database.latencyMs', warning: 100, critical: 500, unit: 'ms' },
  { metric: 'cache.hitRate', warning: 50, critical: 20, unit: '%' }, // Lower is worse
];

// =============================================================================
// Request Tracking
// =============================================================================

interface RequestStats {
  count: number;
  totalLatencyMs: number;
  errors: number;
  startTime: number;
}

const requestStats: RequestStats = {
  count: 0,
  totalLatencyMs: 0,
  errors: 0,
  startTime: Date.now(),
};

const recentErrors: number[] = []; // Timestamps of recent errors

/**
 * Record a completed request
 */
export function recordRequest(latencyMs: number, isError: boolean): void {
  requestStats.count++;
  requestStats.totalLatencyMs += latencyMs;

  if (isError) {
    requestStats.errors++;
    recentErrors.push(Date.now());

    // Keep only last minute of errors
    const oneMinuteAgo = Date.now() - 60 * 1000;
    while (recentErrors.length > 0 && recentErrors[0] < oneMinuteAgo) {
      recentErrors.shift();
    }
  }
}

/**
 * Get request statistics
 */
function getRequestStats() {
  const uptimeSeconds = (Date.now() - requestStats.startTime) / 1000;
  const oneMinuteAgo = Date.now() - 60 * 1000;

  // Count errors in last minute
  const recentErrorCount = recentErrors.filter((t) => t >= oneMinuteAgo).length;

  return {
    total: requestStats.count,
    perSecond: uptimeSeconds > 0 ? requestStats.count / uptimeSeconds : 0,
    averageLatencyMs:
      requestStats.count > 0
        ? Math.round(requestStats.totalLatencyMs / requestStats.count)
        : 0,
    errors: {
      total: requestStats.errors,
      rate: recentErrorCount, // errors per minute
    },
  };
}

// =============================================================================
// Health Checks
// =============================================================================

/**
 * Check database connectivity
 */
export async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    // Dynamic import to avoid circular dependency
    const { db } = await import('../db');
    await db.execute('SELECT 1');

    const latencyMs = Date.now() - start;

    let status: HealthCheckResult['status'] = 'healthy';
    if (latencyMs > 500) {
      status = 'degraded';
    } else if (latencyMs > 2000) {
      status = 'unhealthy';
    }

    return {
      name: 'database',
      status,
      latencyMs,
      message: status === 'healthy' ? 'Connected' : `High latency: ${latencyMs}ms`,
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: `Connection failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Check Redis connectivity (if configured)
 */
export async function checkRedis(): Promise<HealthCheckResult | null> {
  const { features, getEnv } = await import('./env');

  if (!features.hasRedis()) {
    return null;
  }

  const start = Date.now();
  const env = getEnv();

  try {
    const response = await fetch(env.UPSTASH_REDIS_REST_URL!, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['PING']),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      name: 'redis',
      status: latencyMs > 200 ? 'degraded' : 'healthy',
      latencyMs,
      message: 'Connected',
    };
  } catch (error) {
    return {
      name: 'redis',
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: `Connection failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Check external service connectivity
 */
export async function checkExternalService(
  name: string,
  url: string,
  timeout: number = 5000
): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    return {
      name,
      status: response.ok ? 'healthy' : 'degraded',
      latencyMs,
      message: response.ok ? 'Reachable' : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      message: `Unreachable: ${(error as Error).message}`,
    };
  }
}

/**
 * Check memory usage
 */
export function checkMemory(): HealthCheckResult {
  const used = process.memoryUsage();
  const heapUsed = used.heapUsed;
  const heapTotal = used.heapTotal;
  const percentage = (heapUsed / heapTotal) * 100;

  let status: HealthCheckResult['status'] = 'healthy';
  if (percentage > 90) {
    status = 'unhealthy';
  } else if (percentage > 70) {
    status = 'degraded';
  }

  return {
    name: 'memory',
    status,
    message: `${Math.round(percentage)}% heap used`,
    details: {
      heapUsed: Math.round(heapUsed / 1024 / 1024),
      heapTotal: Math.round(heapTotal / 1024 / 1024),
      rss: Math.round(used.rss / 1024 / 1024),
      external: Math.round(used.external / 1024 / 1024),
    },
  };
}

/**
 * Check cache health
 */
export function checkCache(): HealthCheckResult {
  const cache = getCache();
  const stats = cache.getStats();

  let status: HealthCheckResult['status'] = 'healthy';
  if (stats.hitRate < 20 && stats.hits + stats.misses > 100) {
    status = 'degraded';
  }

  return {
    name: 'cache',
    status,
    message: `${Math.round(stats.hitRate)}% hit rate`,
    details: stats,
  };
}

// =============================================================================
// System Health
// =============================================================================

/**
 * Get comprehensive system health
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const startTime = Date.now();

  // Run health checks in parallel
  const [dbCheck, redisCheck, memoryCheck, cacheCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    Promise.resolve(checkMemory()),
    Promise.resolve(checkCache()),
  ]);

  const checks: HealthCheckResult[] = [dbCheck, memoryCheck, cacheCheck];
  if (redisCheck) {
    checks.push(redisCheck);
  }

  // Determine overall status
  let overallStatus: SystemHealth['status'] = 'healthy';
  for (const check of checks) {
    if (check.status === 'unhealthy') {
      overallStatus = 'unhealthy';
      break;
    } else if (check.status === 'degraded' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }
  }

  // Get metrics
  const memUsage = process.memoryUsage();
  const reqStats = getRequestStats();
  const cacheStats = getCache().getStats();

  const metrics: SystemMetrics = {
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
    requests: {
      total: reqStats.total,
      perSecond: Math.round(reqStats.perSecond * 100) / 100,
      averageLatencyMs: reqStats.averageLatencyMs,
    },
    errors: reqStats.errors,
    cache: cacheStats,
  };

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    uptime: Math.round(process.uptime()),
    checks,
    metrics,
  };
}

// =============================================================================
// Alerting
// =============================================================================

type AlertLevel = 'warning' | 'critical';
type AlertCallback = (level: AlertLevel, metric: string, value: number, threshold: number) => void;

let alertCallback: AlertCallback | null = null;

/**
 * Set the alert callback
 */
export function setAlertCallback(callback: AlertCallback): void {
  alertCallback = callback;
}

/**
 * Check metrics against thresholds and trigger alerts
 */
export function checkThresholds(metrics: SystemMetrics): void {
  if (!alertCallback) return;

  for (const threshold of alertThresholds) {
    const value = getMetricValue(metrics, threshold.metric);
    if (value === undefined) continue;

    // For metrics where lower is worse (like cache hit rate)
    const isLowerWorse = threshold.metric === 'cache.hitRate';

    if (isLowerWorse) {
      if (value < threshold.critical) {
        alertCallback('critical', threshold.metric, value, threshold.critical);
      } else if (value < threshold.warning) {
        alertCallback('warning', threshold.metric, value, threshold.warning);
      }
    } else {
      if (value > threshold.critical) {
        alertCallback('critical', threshold.metric, value, threshold.critical);
      } else if (value > threshold.warning) {
        alertCallback('warning', threshold.metric, value, threshold.warning);
      }
    }
  }
}

/**
 * Get a metric value by path
 */
function getMetricValue(metrics: SystemMetrics, path: string): number | undefined {
  const parts = path.split('.');
  let current: unknown = metrics;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return typeof current === 'number' ? current : undefined;
}

// =============================================================================
// Performance Monitoring Middleware
// =============================================================================

import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

/**
 * Performance monitoring middleware
 * Tracks request latency and error rates
 */
export function performanceMonitoring(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = Date.now();
    let isError = false;

    try {
      await next();
      isError = c.res.status >= 400;
    } catch (error) {
      isError = true;
      throw error;
    } finally {
      const latencyMs = Date.now() - start;
      recordRequest(latencyMs, isError);

      // Log slow requests
      if (latencyMs > 1000) {
        log.warn(`Slow request: ${c.req.method} ${c.req.path}`, {
          latencyMs,
          status: c.res.status,
          requestId: c.get('requestId'),
        });
      }
    }
  };
}

// =============================================================================
// Scheduled Health Checks
// =============================================================================

let healthCheckInterval: Timer | null = null;

/**
 * Start periodic health checks
 */
export function startHealthChecks(intervalMs: number = 60000): void {
  if (healthCheckInterval) return;

  healthCheckInterval = setInterval(async () => {
    try {
      const health = await getSystemHealth();

      // Log if not healthy
      if (health.status !== 'healthy') {
        log.warn(`System health: ${health.status}`, {
          checks: health.checks.filter((c) => c.status !== 'healthy'),
        });
      }

      // Check thresholds
      checkThresholds(health.metrics);
    } catch (error) {
      log.error('Health check failed', error as Error);
    }
  }, intervalMs);

  log.info(`Health checks started (interval: ${intervalMs}ms)`);
}

/**
 * Stop periodic health checks
 */
export function stopHealthChecks(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    log.info('Health checks stopped');
  }
}

export default {
  // Health checks
  checkDatabase,
  checkRedis,
  checkExternalService,
  checkMemory,
  checkCache,
  getSystemHealth,

  // Request tracking
  recordRequest,

  // Alerting
  setAlertCallback,
  checkThresholds,
  alertThresholds,

  // Middleware
  performanceMonitoring,

  // Scheduled checks
  startHealthChecks,
  stopHealthChecks,
};
