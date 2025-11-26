import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { prettyJSON } from 'hono/pretty-json';

import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/user';
import { vocabularyRoutes } from './routes/vocabulary';
import { cardsRoutes } from './routes/cards';
import { nlpRoutes } from './routes/nlp';
import { syncRoutes } from './routes/sync';
import { analyticsRoutes } from './routes/analytics';
import billingRoutes from './routes/billing';
import { errorHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limiter';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

// Global middleware
app.use('*', logger());
app.use('*', timing());
app.use('*', secureHeaders());
app.use('*', prettyJSON());
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'chrome-extension://*',
      'https://app.kairos.dev',
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposeHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 86400,
  })
);

// Rate limiting
app.use('/api/*', rateLimiter());

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
  });
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

// Error handling
app.onError(errorHandler);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

const port = parseInt(process.env.PORT ?? '3000', 10);

console.log(`🚀 Kairos API starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
