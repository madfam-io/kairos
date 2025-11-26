import * as Sentry from '@sentry/bun';
import { logger } from './logger';

const SENTRY_DSN = process.env.SENTRY_DSN;
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Initialize Sentry error tracking
 * Only initializes in production or when SENTRY_DSN is explicitly set
 */
export function initSentry() {
  if (!SENTRY_DSN) {
    logger.info('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '0.1.0',

    // Performance monitoring
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Error sampling (capture all errors in prod)
    sampleRate: 1.0,

    // Integrations
    integrations: [
      // Capture unhandled promise rejections
      Sentry.onUnhandledRejectionIntegration(),
    ],

    // Before sending, filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }

      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data) {
            const { password, token, secret, apiKey, ...safeData } = breadcrumb.data as Record<string, unknown>;
            breadcrumb.data = safeData;
          }
          return breadcrumb;
        });
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Ignore expected errors
      'Rate limit exceeded',
      'Authentication required',
      'Invalid token',
      // Ignore network errors from client
      'NetworkError',
      'AbortError',
    ],
  });

  logger.info('Sentry initialized', { environment: process.env.NODE_ENV });
}

/**
 * Capture an exception with context
 */
export function captureException(
  error: Error,
  context?: {
    user?: { id: string; email?: string };
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    requestId?: string;
  }
) {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.user) {
      scope.setUser({
        id: context.user.id,
        email: context.user.email,
      });
    }

    if (context?.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, value);
      }
    }

    if (context?.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        scope.setExtra(key, value);
      }
    }

    if (context?.requestId) {
      scope.setTag('requestId', context.requestId);
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture a message with context
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>
) {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }

    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for all subsequent events
 */
export function setUser(user: { id: string; email?: string } | null) {
  if (!SENTRY_DSN) {
    return;
  }

  if (user) {
    Sentry.setUser({ id: user.id, email: user.email });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
) {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string) {
  if (!SENTRY_DSN) {
    return null;
  }

  return Sentry.startInactiveSpan({
    name,
    op,
  });
}

/**
 * Flush pending events (call before shutdown)
 */
export async function flushSentry(timeout = 2000) {
  if (!SENTRY_DSN) {
    return;
  }

  await Sentry.flush(timeout);
}

export { Sentry };
