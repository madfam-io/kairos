/**
 * Security Middleware
 *
 * Provides security hardening for the API including:
 * - Input sanitization
 * - Request validation
 * - Security headers
 * - IP blocking
 * - Suspicious activity detection
 */

import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { log } from '../lib/logger';
import { AppError } from './error-handler';

// =============================================================================
// Input Sanitization
// =============================================================================

/**
 * Dangerous patterns that might indicate injection attacks
 */
const DANGEROUS_PATTERNS = [
  // SQL injection patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b.*\b(FROM|INTO|TABLE|WHERE)\b)/gi,
  // Script injection
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  // Event handlers
  /\bon\w+\s*=/gi,
  // JavaScript URLs
  /javascript:/gi,
  // Data URLs that could contain scripts
  /data:\s*text\/html/gi,
  // Template injection
  /\{\{.*\}\}/g,
  // Path traversal
  /\.\.\//g,
  // Null bytes
  /\x00/g,
];

/**
 * HTML entities that should be escaped
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Check if a string contains potentially dangerous patterns
 */
export function containsDangerousPattern(value: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Sanitize a string value
 */
export function sanitizeString(value: string): string {
  // Trim whitespace
  let sanitized = value.trim();

  // Normalize Unicode
  sanitized = sanitized.normalize('NFC');

  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, '');

  // Limit length to prevent DoS
  if (sanitized.length > 10000) {
    sanitized = sanitized.slice(0, 10000);
  }

  return sanitized;
}

/**
 * Recursively sanitize an object's string values
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys too
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}

// =============================================================================
// Input Validation Middleware
// =============================================================================

interface InputValidationConfig {
  /** Maximum allowed request body size in bytes */
  maxBodySize?: number;
  /** Whether to check for dangerous patterns */
  checkDangerousPatterns?: boolean;
  /** Whether to sanitize input */
  sanitizeInput?: boolean;
  /** Paths to exclude from validation */
  excludePaths?: string[];
}

const DEFAULT_VALIDATION_CONFIG: InputValidationConfig = {
  maxBodySize: 1024 * 1024, // 1MB
  checkDangerousPatterns: true,
  sanitizeInput: true,
  excludePaths: ['/health', '/ready', '/metrics'],
};

/**
 * Input validation and sanitization middleware
 */
export function inputValidation(
  config: InputValidationConfig = {}
): MiddlewareHandler<AppEnv> {
  const { maxBodySize, checkDangerousPatterns, sanitizeInput, excludePaths } = {
    ...DEFAULT_VALIDATION_CONFIG,
    ...config,
  };

  return async (c, next) => {
    const path = c.req.path;

    // Skip excluded paths
    if (excludePaths?.some((p) => path.startsWith(p))) {
      return next();
    }

    // Check content length
    const contentLength = c.req.header('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxBodySize!) {
      throw AppError.badRequest('Request body too large', {
        maxSize: maxBodySize,
        receivedSize: parseInt(contentLength, 10),
      });
    }

    // For JSON requests, validate and sanitize body
    const contentType = c.req.header('content-type');
    if (contentType?.includes('application/json')) {
      try {
        const body = await c.req.json();

        // Check for dangerous patterns
        if (checkDangerousPatterns) {
          const bodyStr = JSON.stringify(body);
          if (containsDangerousPattern(bodyStr)) {
            log.security('Dangerous pattern detected in request body', {
              path,
              ip: getClientIp(c),
              requestId: c.get('requestId'),
            });

            throw AppError.badRequest('Invalid input detected');
          }
        }

        // Sanitize input
        if (sanitizeInput) {
          const sanitizedBody = sanitizeObject(body);
          // Store sanitized body for route handlers
          c.set('sanitizedBody' as keyof AppEnv['Variables'], sanitizedBody);
        }
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        // JSON parse error
        throw AppError.badRequest('Invalid JSON body');
      }
    }

    // Validate query parameters
    const queryParams = c.req.query();
    for (const [key, value] of Object.entries(queryParams)) {
      if (typeof value === 'string') {
        if (checkDangerousPatterns && containsDangerousPattern(value)) {
          log.security('Dangerous pattern detected in query param', {
            path,
            param: key,
            ip: getClientIp(c),
            requestId: c.get('requestId'),
          });

          throw AppError.badRequest('Invalid query parameter');
        }
      }
    }

    await next();
  };
}

// =============================================================================
// IP Management
// =============================================================================

/**
 * Get the client's real IP address
 */
export function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    c.req.header('x-real-ip') ??
    'unknown'
  );
}

// Simple in-memory blocklist (use Redis in production)
const blockedIps = new Set<string>();
const suspiciousActivity = new Map<string, { count: number; lastSeen: number }>();

const SUSPICIOUS_THRESHOLD = 10; // Failed requests before blocking
const SUSPICIOUS_WINDOW = 60 * 1000; // 1 minute window
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minute block

/**
 * Record suspicious activity from an IP
 */
export function recordSuspiciousActivity(ip: string): void {
  const now = Date.now();
  const activity = suspiciousActivity.get(ip);

  if (activity && now - activity.lastSeen < SUSPICIOUS_WINDOW) {
    activity.count++;
    activity.lastSeen = now;

    if (activity.count >= SUSPICIOUS_THRESHOLD) {
      blockedIps.add(ip);
      log.security(`IP blocked due to suspicious activity: ${ip}`);

      // Auto-unblock after duration
      setTimeout(() => {
        blockedIps.delete(ip);
        suspiciousActivity.delete(ip);
        log.security(`IP unblocked: ${ip}`);
      }, BLOCK_DURATION);
    }
  } else {
    suspiciousActivity.set(ip, { count: 1, lastSeen: now });
  }
}

/**
 * Check if an IP is blocked
 */
export function isIpBlocked(ip: string): boolean {
  return blockedIps.has(ip);
}

/**
 * IP blocking middleware
 */
export function ipBlocker(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const ip = getClientIp(c);

    if (isIpBlocked(ip)) {
      log.security(`Blocked request from banned IP: ${ip}`, {
        path: c.req.path,
        requestId: c.get('requestId'),
      });

      return c.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied',
          },
        },
        403
      );
    }

    await next();
  };
}

// =============================================================================
// Request ID Validation
// =============================================================================

/**
 * Validate that request IDs are in valid UUID format
 */
export function validateRequestId(): MiddlewareHandler<AppEnv> {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return async (c, next) => {
    const requestId = c.req.header('x-request-id');

    if (requestId && !UUID_REGEX.test(requestId)) {
      // Invalid format - generate a new one instead of rejecting
      const newRequestId = crypto.randomUUID();
      c.set('requestId', newRequestId);
      c.header('X-Request-Id', newRequestId);
    }

    await next();
  };
}

// =============================================================================
// Content Security
// =============================================================================

/**
 * Additional security headers beyond what Hono provides
 */
export function additionalSecurityHeaders(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();

    // Prevent MIME type sniffing
    c.header('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    c.header('X-Frame-Options', 'DENY');

    // XSS protection (legacy but still useful)
    c.header('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy
    c.header(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );

    // Cache control for API responses
    if (!c.res.headers.get('Cache-Control')) {
      c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
    }
  };
}

// =============================================================================
// Cleanup
// =============================================================================

// Cleanup old suspicious activity records periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, activity] of suspiciousActivity.entries()) {
      if (now - activity.lastSeen > SUSPICIOUS_WINDOW * 2) {
        suspiciousActivity.delete(ip);
      }
    }
  }, SUSPICIOUS_WINDOW);
}
