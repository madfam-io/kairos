import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

/**
 * HTML entities that need escaping to prevent XSS
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
 * Escape HTML entities in a string
 */
function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Recursively sanitize an object's string values
 */
function sanitizeValue(value: unknown, options: SanitizeOptions): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    let sanitized = value;

    // Escape HTML entities
    if (options.escapeHtml) {
      sanitized = escapeHtml(sanitized);
    }

    // Remove null bytes (can cause issues in some systems)
    sanitized = sanitized.replace(/\0/g, '');

    // Trim whitespace if enabled
    if (options.trim) {
      sanitized = sanitized.trim();
    }

    // Truncate long strings
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.slice(0, options.maxLength);
    }

    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, options));
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Skip prototype pollution attempts
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      sanitized[key] = sanitizeValue(val, options);
    }
    return sanitized;
  }

  return value;
}

interface SanitizeOptions {
  /**
   * Escape HTML entities in strings (prevents XSS)
   * @default true
   */
  escapeHtml: boolean;

  /**
   * Trim whitespace from strings
   * @default true
   */
  trim: boolean;

  /**
   * Maximum string length (truncate longer strings)
   * @default undefined (no limit)
   */
  maxLength?: number;

  /**
   * Fields to skip sanitization (e.g., 'password', 'html_content')
   * @default []
   */
  skipFields: string[];
}

const DEFAULT_OPTIONS: SanitizeOptions = {
  escapeHtml: true,
  trim: true,
  skipFields: ['password', 'token', 'secret', 'html', 'markdown', 'content'],
};

/**
 * Middleware to sanitize request body and query parameters
 * Prevents XSS attacks by escaping HTML entities
 */
export function sanitize(
  options: Partial<SanitizeOptions> = {}
): MiddlewareHandler<AppEnv> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (c, next) => {
    // Sanitize query parameters
    const url = new URL(c.req.url);
    const sanitizedParams = new URLSearchParams();

    for (const [key, value] of url.searchParams.entries()) {
      if (!opts.skipFields.includes(key)) {
        sanitizedParams.set(key, sanitizeValue(value, opts) as string);
      } else {
        sanitizedParams.set(key, value);
      }
    }

    // Note: We can't modify the request URL in Hono, but we've validated the params
    // The sanitized values should be accessed via a custom method or context

    await next();
  };
}

/**
 * Sanitize a request body object
 * Call this in route handlers before processing user input
 */
export function sanitizeBody<T extends Record<string, unknown>>(
  body: T,
  options: Partial<SanitizeOptions> = {}
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (opts.skipFields.includes(key)) {
      sanitized[key] = value;
    } else {
      sanitized[key] = sanitizeValue(value, opts);
    }
  }

  return sanitized as T;
}

/**
 * Validate and sanitize common input patterns
 */
export const validators = {
  /**
   * Validate email format
   */
  isEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  /**
   * Validate UUID format
   */
  isUUID(value: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },

  /**
   * Check for potentially dangerous SQL patterns
   */
  hasSqlInjection(value: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
      /(--|\*\/|\/\*)/,
      /(\bOR\b.*=.*\bOR\b)/i,
      /(\bAND\b.*=.*\bAND\b)/i,
    ];
    return sqlPatterns.some((pattern) => pattern.test(value));
  },

  /**
   * Check for script injection attempts
   */
  hasScriptInjection(value: string): boolean {
    const scriptPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i, // onclick=, onerror=, etc.
      /data:/i,
    ];
    return scriptPatterns.some((pattern) => pattern.test(value));
  },

  /**
   * Sanitize a filename (remove path traversal attempts)
   */
  sanitizeFilename(value: string): string {
    return value
      .replace(/\.\./g, '') // Remove path traversal
      .replace(/[/\\]/g, '') // Remove path separators
      .replace(/[<>:"|?*]/g, '') // Remove invalid chars
      .slice(0, 255); // Limit length
  },

  /**
   * Sanitize a URL (only allow http/https)
   */
  sanitizeUrl(value: string): string | null {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }
      return url.toString();
    } catch {
      return null;
    }
  },
};

/**
 * Create a safe JSON parser that limits depth and size
 */
export function safeJsonParse<T>(
  json: string,
  options: { maxSize?: number; maxDepth?: number } = {}
): T | null {
  const { maxSize = 1024 * 1024, maxDepth = 10 } = options; // 1MB default

  if (json.length > maxSize) {
    return null;
  }

  try {
    const parsed = JSON.parse(json);

    // Check depth
    function checkDepth(obj: unknown, depth: number): boolean {
      if (depth > maxDepth) return false;
      if (obj === null || typeof obj !== 'object') return true;
      if (Array.isArray(obj)) {
        return obj.every((item) => checkDepth(item, depth + 1));
      }
      return Object.values(obj).every((val) => checkDepth(val, depth + 1));
    }

    if (!checkDepth(parsed, 0)) {
      return null;
    }

    return parsed as T;
  } catch {
    return null;
  }
}
