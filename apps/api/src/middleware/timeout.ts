import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { log } from '../lib/logger';

interface TimeoutConfig {
  /**
   * Timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout: number;

  /**
   * Custom error message
   */
  message?: string;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Request timeout middleware
 * Aborts requests that take too long to complete
 */
export function timeout(
  config: Partial<TimeoutConfig> = {}
): MiddlewareHandler<AppEnv> {
  const { timeout: timeoutMs = DEFAULT_TIMEOUT, message } = config;

  return async (c, next) => {
    const requestId = c.get('requestId') || 'unknown';
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        log.warn('Request timeout', {
          requestId,
          method: c.req.method,
          path: c.req.path,
          timeoutMs,
        });
        reject(new RequestTimeoutError(message));
      }, timeoutMs);
    });

    try {
      // Race between the actual request and timeout
      await Promise.race([next(), timeoutPromise]);
    } catch (error) {
      if (error instanceof RequestTimeoutError) {
        return c.json(
          {
            success: false,
            error: {
              code: 'REQUEST_TIMEOUT',
              message: error.message,
            },
            meta: {
              requestId,
              timeout: timeoutMs,
            },
          },
          408 // Request Timeout
        );
      }
      throw error;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };
}

/**
 * Custom error for request timeouts
 */
class RequestTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

/**
 * Longer timeout for file uploads and heavy processing
 */
export function uploadTimeout(): MiddlewareHandler<AppEnv> {
  return timeout({
    timeout: 120000, // 2 minutes
    message: 'Upload timed out. Please try with a smaller file.',
  });
}

/**
 * Shorter timeout for quick API calls
 */
export function quickTimeout(): MiddlewareHandler<AppEnv> {
  return timeout({
    timeout: 10000, // 10 seconds
    message: 'Request timed out. Please try again.',
  });
}

/**
 * Timeout for AI/ML processing requests
 */
export function aiTimeout(): MiddlewareHandler<AppEnv> {
  return timeout({
    timeout: 60000, // 60 seconds
    message: 'AI processing timed out. Please try again with simpler input.',
  });
}
