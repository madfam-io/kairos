/**
 * Shared Utilities
 *
 * Common utility functions used across the API.
 */

import { createHash, randomBytes, createHmac } from 'crypto';
import type { Context } from 'hono';

// =============================================================================
// Pagination Utilities
// =============================================================================

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
  defaultOffset?: number;
}

/**
 * Parse pagination parameters from query string
 */
export function parsePagination(
  c: Context,
  options: PaginationOptions = {}
): PaginationParams {
  const { defaultLimit = 20, maxLimit = 100, defaultOffset = 0 } = options;

  const limitStr = c.req.query('limit');
  const offsetStr = c.req.query('offset');

  const limit = limitStr ? Math.min(Math.max(1, parseInt(limitStr, 10) || defaultLimit), maxLimit) : defaultLimit;
  const offset = offsetStr ? Math.max(0, parseInt(offsetStr, 10) || defaultOffset) : defaultOffset;

  return { limit, offset };
}

/**
 * Parse page-based pagination (converts to limit/offset)
 */
export function parsePagePagination(
  c: Context,
  options: PaginationOptions = {}
): PaginationParams {
  const { defaultLimit = 20, maxLimit = 100 } = options;

  const pageStr = c.req.query('page');
  const limitStr = c.req.query('limit');

  const limit = limitStr ? Math.min(Math.max(1, parseInt(limitStr, 10) || defaultLimit), maxLimit) : defaultLimit;
  const page = pageStr ? Math.max(1, parseInt(pageStr, 10) || 1) : 1;
  const offset = (page - 1) * limit;

  return { limit, offset };
}

/**
 * Create pagination metadata for response
 */
export function createPaginationMeta(
  total: number,
  limit: number,
  offset: number
): {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  page: number;
  totalPages: number;
} {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
    page,
    totalPages,
  };
}

// =============================================================================
// Token Generation
// =============================================================================

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(prefix?: string, bytes: number = 32): string {
  const token = randomBytes(bytes).toString('hex');
  return prefix ? `${prefix}_${token}` : token;
}

/**
 * Generate a short alphanumeric code (for invite codes, etc.)
 */
export function generateCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
  let code = '';
  const randomValues = randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += chars[randomValues[i] % chars.length];
  }
  return code;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

// =============================================================================
// Hashing
// =============================================================================

/**
 * Hash a string using SHA-256
 */
export function hashSHA256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Create an HMAC signature
 */
export function createHMACSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify an HMAC signature
 */
export function verifyHMACSignature(
  payload: string,
  signature: string,
  secret: string,
  prefix: string = 'sha256='
): boolean {
  const expected = createHMACSignature(payload, secret);
  return signature === `${prefix}${expected}`;
}

// =============================================================================
// String Utilities
// =============================================================================

/**
 * Generate a URL-safe slug from a string
 */
export function slugify(input: string, maxLength: number = 50): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
}

/**
 * Truncate string with ellipsis
 */
export function truncate(input: string, maxLength: number, suffix: string = '...'): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Sanitize string for safe output (basic XSS prevention)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Strip HTML tags from string
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

// =============================================================================
// Date Utilities
// =============================================================================

/**
 * Get start of day in UTC
 */
export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day in UTC
 */
export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Get date N days ago
 */
export function daysAgo(days: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if a date is within the last N days
 */
export function isWithinDays(date: Date, days: number): boolean {
  const threshold = daysAgo(days);
  return date >= threshold;
}

// =============================================================================
// Array Utilities
// =============================================================================

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove duplicates from array
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Group array by key
 */
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

// =============================================================================
// Object Utilities
// =============================================================================

/**
 * Pick specific keys from object
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific keys from object
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * Remove undefined/null values from object
 */
export function compact<T extends object>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Create a standardized success response
 */
export function successResponse<T>(data: T, meta?: Record<string, unknown>) {
  return {
    success: true as const,
    data,
    ...(meta && { meta }),
  };
}

/**
 * Create a standardized error response
 */
export function errorResponse(code: string, message: string, details?: Record<string, unknown>) {
  return {
    success: false as const,
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };
}

// =============================================================================
// Exports
// =============================================================================

export default {
  // Pagination
  parsePagination,
  parsePagePagination,
  createPaginationMeta,

  // Tokens
  generateToken,
  generateCode,
  generateUUID,

  // Hashing
  hashSHA256,
  createHMACSignature,
  verifyHMACSignature,

  // Strings
  slugify,
  truncate,
  sanitizeString,
  stripHtml,

  // Dates
  startOfDay,
  endOfDay,
  daysAgo,
  formatDateISO,
  isWithinDays,

  // Arrays
  chunk,
  unique,
  groupBy,

  // Objects
  pick,
  omit,
  compact,

  // Responses
  successResponse,
  errorResponse,
};
