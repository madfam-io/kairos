import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

/**
 * Simple Prometheus-compatible metrics collector
 * For production, consider using prom-client or similar
 */

interface MetricsBucket {
  count: number;
  sum: number;
  buckets: Record<string, number>;
}

interface Metrics {
  // Request metrics
  httpRequestsTotal: Record<string, number>;
  httpRequestDuration: Record<string, MetricsBucket>;
  httpRequestsInFlight: number;

  // Error metrics
  httpErrorsTotal: Record<string, number>;

  // Business metrics
  activeUsers: number;
  apiCallsTotal: Record<string, number>;

  // System metrics
  startTime: number;
}

const metrics: Metrics = {
  httpRequestsTotal: {},
  httpRequestDuration: {},
  httpRequestsInFlight: 0,
  httpErrorsTotal: {},
  activeUsers: 0,
  apiCallsTotal: {},
  startTime: Date.now(),
};

// Histogram bucket boundaries in milliseconds
const DURATION_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Get bucket label for a duration
 */
function getDurationBucket(ms: number): string {
  for (const bucket of DURATION_BUCKETS) {
    if (ms <= bucket) {
      return String(bucket);
    }
  }
  return '+Inf';
}

/**
 * Increment a counter
 */
export function incrementCounter(
  name: keyof Pick<Metrics, 'httpRequestsTotal' | 'httpErrorsTotal' | 'apiCallsTotal'>,
  labels: string
) {
  if (!metrics[name][labels]) {
    metrics[name][labels] = 0;
  }
  metrics[name][labels]++;
}

/**
 * Observe a histogram value
 */
export function observeHistogram(
  name: keyof Pick<Metrics, 'httpRequestDuration'>,
  labels: string,
  value: number
) {
  if (!metrics[name][labels]) {
    metrics[name][labels] = {
      count: 0,
      sum: 0,
      buckets: {},
    };
    for (const bucket of DURATION_BUCKETS) {
      metrics[name][labels].buckets[String(bucket)] = 0;
    }
    metrics[name][labels].buckets['+Inf'] = 0;
  }

  metrics[name][labels].count++;
  metrics[name][labels].sum += value;

  const bucket = getDurationBucket(value);
  // Increment this bucket and all higher buckets
  let found = false;
  for (const b of [...DURATION_BUCKETS.map(String), '+Inf']) {
    if (b === bucket) found = true;
    if (found) {
      metrics[name][labels].buckets[b]++;
    }
  }
}

/**
 * Set a gauge value
 */
export function setGauge(name: 'activeUsers' | 'httpRequestsInFlight', value: number) {
  metrics[name] = value;
}

/**
 * Middleware to collect request metrics
 */
export function metricsMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = normalizePath(c.req.path);

    metrics.httpRequestsInFlight++;

    try {
      await next();

      const duration = Date.now() - start;
      const status = c.res.status;
      const labels = `method="${method}",path="${path}",status="${status}"`;

      incrementCounter('httpRequestsTotal', labels);
      observeHistogram('httpRequestDuration', labels, duration);

      if (status >= 400) {
        incrementCounter('httpErrorsTotal', `method="${method}",path="${path}",status="${status}"`);
      }
    } finally {
      metrics.httpRequestsInFlight--;
    }
  };
}

/**
 * Normalize path for metrics (remove IDs)
 */
function normalizePath(path: string): string {
  return path
    // Remove UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Remove numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Collapse multiple slashes
    .replace(/\/+/g, '/');
}

/**
 * Format metrics in Prometheus exposition format
 */
export function formatPrometheusMetrics(): string {
  const lines: string[] = [];
  const now = Date.now();
  const uptime = (now - metrics.startTime) / 1000;

  // Process info
  lines.push('# HELP process_uptime_seconds Time since process started');
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${uptime}`);
  lines.push('');

  // HTTP requests total
  lines.push('# HELP http_requests_total Total number of HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for (const [labels, count] of Object.entries(metrics.httpRequestsTotal)) {
    lines.push(`http_requests_total{${labels}} ${count}`);
  }
  lines.push('');

  // HTTP request duration
  lines.push('# HELP http_request_duration_ms HTTP request duration in milliseconds');
  lines.push('# TYPE http_request_duration_ms histogram');
  for (const [labels, bucket] of Object.entries(metrics.httpRequestDuration)) {
    for (const [le, count] of Object.entries(bucket.buckets)) {
      lines.push(`http_request_duration_ms_bucket{${labels},le="${le}"} ${count}`);
    }
    lines.push(`http_request_duration_ms_sum{${labels}} ${bucket.sum}`);
    lines.push(`http_request_duration_ms_count{${labels}} ${bucket.count}`);
  }
  lines.push('');

  // HTTP requests in flight
  lines.push('# HELP http_requests_in_flight Current number of HTTP requests being processed');
  lines.push('# TYPE http_requests_in_flight gauge');
  lines.push(`http_requests_in_flight ${metrics.httpRequestsInFlight}`);
  lines.push('');

  // HTTP errors total
  lines.push('# HELP http_errors_total Total number of HTTP errors');
  lines.push('# TYPE http_errors_total counter');
  for (const [labels, count] of Object.entries(metrics.httpErrorsTotal)) {
    lines.push(`http_errors_total{${labels}} ${count}`);
  }
  lines.push('');

  // API calls by endpoint
  lines.push('# HELP api_calls_total Total API calls by endpoint');
  lines.push('# TYPE api_calls_total counter');
  for (const [labels, count] of Object.entries(metrics.apiCallsTotal)) {
    lines.push(`api_calls_total{${labels}} ${count}`);
  }
  lines.push('');

  // Memory usage (Bun specific)
  if (typeof Bun !== 'undefined') {
    const memUsage = process.memoryUsage();
    lines.push('# HELP process_resident_memory_bytes Resident memory size in bytes');
    lines.push('# TYPE process_resident_memory_bytes gauge');
    lines.push(`process_resident_memory_bytes ${memUsage.rss}`);
    lines.push('');

    lines.push('# HELP process_heap_bytes Heap memory size in bytes');
    lines.push('# TYPE process_heap_bytes gauge');
    lines.push(`process_heap_bytes ${memUsage.heapUsed}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get metrics as JSON (for internal dashboards)
 */
export function getMetricsJson() {
  const now = Date.now();
  return {
    uptime: (now - metrics.startTime) / 1000,
    requests: metrics.httpRequestsTotal,
    errors: metrics.httpErrorsTotal,
    inFlight: metrics.httpRequestsInFlight,
    apiCalls: metrics.apiCallsTotal,
    memory: process.memoryUsage(),
  };
}
