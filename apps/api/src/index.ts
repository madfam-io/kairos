import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { prettyJSON } from 'hono/pretty-json';

// Initialize environment validation first
import { validateEnv, getEnv } from './lib/env';
validateEnv();

// Initialize observability
import { log } from './lib/logger';
import { initSentry, flushSentry } from './lib/sentry';
import { metricsMiddleware, formatPrometheusMetrics, getMetricsJson } from './lib/metrics';

initSentry();

import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/user';
import { vocabularyRoutes } from './routes/vocabulary';
import { cardsRoutes } from './routes/cards';
import { nlpRoutes } from './routes/nlp';
import { syncRoutes } from './routes/sync';
import { analyticsRoutes } from './routes/analytics';
import billingRoutes from './routes/billing';
import pitchRoutes from './routes/pitch';
import speechRoutes from './routes/speech';
import { contentRoutes } from './routes/content';
import { sharedDecksRoutes } from './routes/shared-decks';
import { referralsRoutes } from './routes/referrals';
import { simplificationPacksRoutes } from './routes/simplification-packs';
import { classroomRoutes } from './routes/classroom';
import { offlineRoutes } from './routes/offline';
import { enterpriseRoutes } from './routes/enterprise';
import { developerRoutes } from './routes/developer';
import { ltiRoutes } from './routes/lti';
import { errorHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limiter';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();
const env = getEnv();

// Request ID middleware (must be first)
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  await next();
});

// Metrics collection (early in middleware chain)
app.use('*', metricsMiddleware());

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.get('requestId');

  log.request(requestId, method, path);

  await next();

  const duration = Date.now() - start;
  log.response(requestId, method, path, c.res.status, duration);
});

// Global middleware
app.use('*', timing());
app.use('*', secureHeaders());
app.use('*', prettyJSON());

// CORS configuration
const corsOrigins = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'chrome-extension://*',
      'https://app.kairos.dev',
    ];

app.use(
  '*',
  cors({
    origin: corsOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-API-Key'],
    exposeHeaders: ['X-Request-Id', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400,
  })
);

// Rate limiting
app.use('/api/*', rateLimiter());

// Health check (no auth, no rate limit)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    environment: env.NODE_ENV,
  });
});

// Prometheus metrics endpoint (no auth for scraping)
app.get('/metrics', (c) => {
  c.header('Content-Type', 'text/plain; version=0.0.4');
  return c.text(formatPrometheusMetrics());
});

// JSON metrics (for internal dashboards)
app.get('/metrics/json', (c) => {
  return c.json(getMetricsJson());
});

// Readiness probe (checks database connectivity)
app.get('/ready', async (c) => {
  try {
    // Import db lazily to avoid circular deps
    const { db } = await import('./db');
    await db.execute('SELECT 1');

    return c.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
      },
    });
  } catch (error) {
    log.error('Readiness check failed', error as Error);
    return c.json(
      {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'failed',
        },
      },
      503
    );
  }
});

// API routes
const api = app.basePath('/api/v1');

api.route('/auth', authRoutes);
api.route('/user', userRoutes);
api.route('/vocabulary', vocabularyRoutes);
api.route('/cards', cardsRoutes);
api.route('/nlp', nlpRoutes);
api.route('/sync', syncRoutes);
api.route('/analytics', analyticsRoutes);
api.route('/billing', billingRoutes);
api.route('/pitch', pitchRoutes);
api.route('/speech', speechRoutes);
api.route('/content', contentRoutes);
api.route('/decks', sharedDecksRoutes);
api.route('/referrals', referralsRoutes);
api.route('/packs', simplificationPacksRoutes);
api.route('/classroom', classroomRoutes);
api.route('/offline', offlineRoutes);
api.route('/enterprise', enterpriseRoutes);
api.route('/developer', developerRoutes);
api.route('/lti', ltiRoutes);

// Error handling
app.onError(errorHandler);

// 404 handler
app.notFound((c) => {
  const requestId = c.get('requestId');
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
      meta: {
        requestId,
      },
    },
    404
  );
});

const port = env.PORT;

log.startup('Kairos API starting', {
  port,
  environment: env.NODE_ENV,
  version: process.env.npm_package_version ?? '0.1.0',
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.shutdown('Received SIGTERM, shutting down gracefully');
  await flushSentry();
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.shutdown('Received SIGINT, shutting down gracefully');
  await flushSentry();
  process.exit(0);
});

export default {
  port,
  fetch: app.fetch,
};
