import type { ErrorHandler } from 'hono';
import type { AppEnv } from '../types';
import type { ApiErrorCode } from '@kairos/types';
import { log } from '../lib/logger';
import { captureException } from '../lib/sentry';

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new AppError('VALIDATION_ERROR', message, 400, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError('AUTH_REQUIRED', message, 401);
  }

  static forbidden(message = 'Access denied') {
    return new AppError('FORBIDDEN', message, 403);
  }

  static notFound(message = 'Resource not found') {
    return new AppError('NOT_FOUND', message, 404);
  }

  static conflict(message: string) {
    return new AppError('CONFLICT', message, 409);
  }

  static quotaExceeded(message = 'Usage quota exceeded') {
    return new AppError('QUOTA_EXCEEDED', message, 429);
  }

  static internal(message = 'Internal server error') {
    return new AppError('INTERNAL_ERROR', message, 500);
  }
}

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown';
  const user = c.get('user');
  const method = c.req.method;
  const path = c.req.path;

  if (err instanceof AppError) {
    // Expected application errors - log at appropriate level
    if (err.statusCode >= 500) {
      log.error(`${method} ${path} - ${err.message}`, err, {
        requestId,
        userId: user?.id,
        code: err.code,
        statusCode: err.statusCode,
      });

      // Report 5xx errors to Sentry
      captureException(err, {
        user: user ? { id: user.id, email: user.email } : undefined,
        tags: {
          errorCode: err.code,
          path,
          method,
        },
        extra: {
          details: err.details,
        },
        requestId,
      });
    } else if (err.statusCode >= 400) {
      // Client errors - log as warning
      log.warn(`${method} ${path} - ${err.message}`, {
        requestId,
        userId: user?.id,
        code: err.code,
        statusCode: err.statusCode,
      });
    }

    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
        meta: {
          requestId,
        },
      },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500
    );
  }

  // Unexpected errors - always log and report
  log.error(`${method} ${path} - Unexpected error`, err, {
    requestId,
    userId: user?.id,
    stack: err.stack,
  });

  captureException(err, {
    user: user ? { id: user.id, email: user.email } : undefined,
    tags: {
      errorCode: 'INTERNAL_ERROR',
      path,
      method,
      unexpected: 'true',
    },
    extra: {
      stack: err.stack,
    },
    requestId,
  });

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR' as const,
        message: 'An unexpected error occurred',
      },
      meta: {
        requestId,
      },
    },
    500
  );
};
