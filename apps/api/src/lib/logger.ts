import { pino } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Structured logger using Pino
 * - JSON format in production for log aggregation
 * - Pretty print in development
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Base context included in every log
  base: {
    service: 'kairos-api',
    version: process.env.npm_package_version || '0.1.0',
    env: process.env.NODE_ENV || 'development',
  },

  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,

  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'apiKey',
      'secret',
      'accessToken',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },

  // Pretty print in development
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service,version,env',
        },
      },

  // Serializers for common objects
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      path: req.path,
      query: req.query,
      headers: {
        'user-agent': req.headers?.['user-agent'],
        'content-type': req.headers?.['content-type'],
        'x-request-id': req.headers?.['x-request-id'],
      },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

/**
 * Create a child logger with request context
 */
export function createRequestLogger(requestId: string, userId?: string) {
  return logger.child({
    requestId,
    userId,
  });
}

/**
 * Log levels for different scenarios
 */
export const log = {
  // Application lifecycle
  startup: (message: string, data?: Record<string, unknown>) =>
    logger.info({ event: 'startup', ...data }, message),

  shutdown: (message: string, data?: Record<string, unknown>) =>
    logger.info({ event: 'shutdown', ...data }, message),

  // HTTP requests
  request: (
    requestId: string,
    method: string,
    path: string,
    userId?: string
  ) =>
    logger.info(
      { event: 'request', requestId, method, path, userId },
      `${method} ${path}`
    ),

  response: (
    requestId: string,
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
  ) =>
    logger.info(
      { event: 'response', requestId, method, path, statusCode, durationMs },
      `${method} ${path} ${statusCode} ${durationMs}ms`
    ),

  // Errors
  error: (
    message: string,
    error: Error,
    context?: Record<string, unknown>
  ) =>
    logger.error(
      { event: 'error', err: error, ...context },
      message
    ),

  // Security events
  authFailure: (reason: string, context?: Record<string, unknown>) =>
    logger.warn(
      { event: 'auth_failure', reason, ...context },
      `Authentication failed: ${reason}`
    ),

  rateLimited: (ip: string, endpoint: string) =>
    logger.warn(
      { event: 'rate_limited', ip, endpoint },
      `Rate limit exceeded for ${ip} on ${endpoint}`
    ),

  security: (message: string, context?: Record<string, unknown>) =>
    logger.warn(
      { event: 'security', ...context },
      `[SECURITY] ${message}`
    ),

  // Business events
  userAction: (
    userId: string,
    action: string,
    data?: Record<string, unknown>
  ) =>
    logger.info(
      { event: 'user_action', userId, action, ...data },
      `User ${userId}: ${action}`
    ),

  // Database
  dbQuery: (query: string, durationMs: number) =>
    logger.debug(
      { event: 'db_query', query, durationMs },
      `DB query: ${durationMs}ms`
    ),

  // External services
  externalCall: (
    service: string,
    method: string,
    url: string,
    statusCode: number,
    durationMs: number
  ) =>
    logger.info(
      { event: 'external_call', service, method, url, statusCode, durationMs },
      `${service}: ${method} ${url} ${statusCode} ${durationMs}ms`
    ),

  // Webhooks
  webhookSent: (
    endpoint: string,
    event: string,
    success: boolean,
    durationMs: number
  ) =>
    logger.info(
      { event: 'webhook_sent', endpoint, webhookEvent: event, success, durationMs },
      `Webhook ${event} to ${endpoint}: ${success ? 'success' : 'failed'}`
    ),

  // Generic
  debug: (message: string, data?: Record<string, unknown>) =>
    logger.debug(data || {}, message),

  info: (message: string, data?: Record<string, unknown>) =>
    logger.info(data || {}, message),

  warn: (message: string, data?: Record<string, unknown>) =>
    logger.warn(data || {}, message),
};

export type Logger = typeof logger;
export type RequestLogger = ReturnType<typeof createRequestLogger>;
