import type { ErrorHandler } from 'hono';
import type { AppEnv } from '../types';
import type { ApiErrorCode } from '@kairos/types';

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
  console.error('Error:', err);

  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
        meta: {
          requestId: c.get('requestId'),
        },
      },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500
    );
  }

  // Unknown error
  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR' as const,
        message: 'An unexpected error occurred',
      },
      meta: {
        requestId: c.get('requestId'),
      },
    },
    500
  );
};
