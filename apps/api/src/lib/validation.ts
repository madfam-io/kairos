/**
 * Validation Utilities
 *
 * Provides reusable Zod schemas and validation helpers
 * for consistent request validation across the API.
 */

import { z } from 'zod';

// =============================================================================
// Common Primitive Validators
// =============================================================================

/**
 * UUID v4 validator
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Non-empty string with max length
 */
export const stringSchema = (maxLength: number = 1000) =>
  z.string().min(1, 'Cannot be empty').max(maxLength, `Maximum ${maxLength} characters`);

/**
 * Email validator with normalization
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .trim()
  .max(255, 'Email too long');

/**
 * URL validator
 */
export const urlSchema = z.string().url('Invalid URL format').max(2048, 'URL too long');

/**
 * Date string in ISO 8601 format
 */
export const dateStringSchema = z.string().datetime({ message: 'Invalid date format' });

/**
 * Positive integer
 */
export const positiveIntSchema = z.coerce
  .number()
  .int('Must be a whole number')
  .positive('Must be positive');

/**
 * Non-negative integer
 */
export const nonNegativeIntSchema = z.coerce
  .number()
  .int('Must be a whole number')
  .min(0, 'Cannot be negative');

// =============================================================================
// Pagination Validators
// =============================================================================

/**
 * Standard pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Offset-based pagination
 */
export const offsetPaginationSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Cursor-based pagination
 */
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// =============================================================================
// Sorting Validators
// =============================================================================

/**
 * Create a sort schema for specific fields
 */
export function createSortSchema<T extends readonly string[]>(
  allowedFields: T,
  defaultField: T[number] = allowedFields[0]
) {
  return z.object({
    sortBy: z.enum(allowedFields as unknown as [string, ...string[]]).default(defaultField),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  });
}

// =============================================================================
// Search Validators
// =============================================================================

/**
 * Search query with sanitization
 */
export const searchQuerySchema = z
  .string()
  .max(200, 'Search query too long')
  .transform((val) => val.trim())
  .optional();

/**
 * Date range filter
 */
export const dateRangeSchema = z
  .object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.from) <= new Date(data.to);
      }
      return true;
    },
    { message: 'From date must be before to date' }
  );

// =============================================================================
// Chinese Language Validators
// =============================================================================

/**
 * Chinese word/phrase validator
 * Allows Chinese characters, some punctuation, and optional pinyin notation
 */
export const chineseWordSchema = z
  .string()
  .min(1, 'Word cannot be empty')
  .max(50, 'Word too long')
  .regex(
    /^[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u3000-\u303f\uff00-\uffef\s]+$/u,
    'Must contain Chinese characters'
  );

/**
 * Pinyin validator
 * Allows pinyin with tone marks or numbers
 */
export const pinyinSchema = z
  .string()
  .max(100, 'Pinyin too long')
  .regex(
    /^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s,0-9]+$/,
    'Invalid pinyin format'
  )
  .optional();

/**
 * HSK level validator (1-9, or 7-9 for new HSK)
 */
export const hskLevelSchema = z.coerce
  .number()
  .int()
  .min(1, 'HSK level must be at least 1')
  .max(9, 'HSK level must be at most 9');

/**
 * Vocabulary status validator
 */
export const vocabularyStatusSchema = z.enum(['new', 'learning', 'known']);

// =============================================================================
// SRS (Spaced Repetition) Validators
// =============================================================================

/**
 * SM-2 quality response (0-5)
 */
export const srsQualitySchema = z.coerce
  .number()
  .int()
  .min(0, 'Quality must be at least 0')
  .max(5, 'Quality must be at most 5');

/**
 * Ease factor validator (1.3 - 2.5)
 */
export const easeFactorSchema = z
  .number()
  .min(1.3, 'Ease factor must be at least 1.3')
  .max(2.5, 'Ease factor must be at most 2.5');

// =============================================================================
// Entity Schemas
// =============================================================================

/**
 * Create vocabulary word schema
 */
export const createVocabularySchema = z.object({
  word: chineseWordSchema,
  pinyin: pinyinSchema,
  definition: z.string().max(500, 'Definition too long').optional(),
  status: vocabularyStatusSchema.optional().default('new'),
  hskLevel: hskLevelSchema.optional(),
});

/**
 * Update vocabulary word schema
 */
export const updateVocabularySchema = z.object({
  pinyin: pinyinSchema,
  definition: z.string().max(500, 'Definition too long').optional(),
  status: vocabularyStatusSchema.optional(),
  hskLevel: hskLevelSchema.optional(),
  easeFactor: easeFactorSchema.optional(),
  nextReview: dateStringSchema.optional(),
});

/**
 * Batch create vocabulary schema
 */
export const batchCreateVocabularySchema = z.object({
  words: z.array(createVocabularySchema).min(1, 'At least one word required').max(100, 'Maximum 100 words per batch'),
});

/**
 * Create card schema
 */
export const createCardSchema = z.object({
  word: chineseWordSchema,
  sentence: z.string().max(1000, 'Sentence too long').optional(),
  simplifiedSentence: z.string().max(1000, 'Simplified sentence too long').optional(),
  audioUrl: urlSchema.optional(),
  screenshotUrl: urlSchema.optional(),
  sourceTitle: z.string().max(200, 'Source title too long').optional(),
  sourceTimestamp: z.string().max(50, 'Timestamp too long').optional(),
});

/**
 * Create shared deck schema
 */
export const createDeckSchema = z.object({
  name: stringSchema(100),
  description: z.string().max(2000, 'Description too long').optional(),
  isPublic: z.boolean().default(false),
  category: z.enum(['hsk', 'topic', 'media', 'custom']).optional(),
  tags: z.array(z.string().max(30)).max(10, 'Maximum 10 tags').optional(),
});

/**
 * Create classroom schema
 */
export const createClassroomSchema = z.object({
  name: stringSchema(100),
  description: z.string().max(2000, 'Description too long').optional(),
  maxStudents: z.coerce.number().int().min(1).max(500).default(30),
  settings: z.record(z.unknown()).optional(),
});

/**
 * Organization schema
 */
export const createOrganizationSchema = z.object({
  name: stringSchema(200),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  type: z.enum(['university', 'school', 'company', 'language_school']),
  domain: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Invalid domain format')
    .optional(),
});

// =============================================================================
// API Key / OAuth Validators
// =============================================================================

/**
 * API scopes validator
 */
export const apiScopesSchema = z.array(
  z.enum([
    'read:vocabulary',
    'write:vocabulary',
    'read:cards',
    'write:cards',
    'read:decks',
    'write:decks',
    'read:analytics',
    'read:profile',
    'write:profile',
  ])
);

/**
 * Create API application schema
 */
export const createApiApplicationSchema = z.object({
  name: stringSchema(100),
  description: z.string().max(1000).optional(),
  websiteUrl: urlSchema.optional(),
  redirectUris: z.array(urlSchema).min(1, 'At least one redirect URI required').max(10),
  scopes: apiScopesSchema,
});

// =============================================================================
// Query Parameter Helpers
// =============================================================================

/**
 * Parse and validate query parameters
 */
export function parseQueryParams<T extends z.ZodSchema>(
  schema: T,
  query: Record<string, string | undefined>
): z.infer<T> {
  return schema.parse(query);
}

/**
 * Create a query schema combining pagination and custom fields
 */
export function createQuerySchema<T extends z.ZodRawShape>(fields: T) {
  return offsetPaginationSchema.merge(z.object(fields));
}

// =============================================================================
// Error Helpers
// =============================================================================

/**
 * Format Zod validation errors for API response
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return errors;
}

/**
 * Validate and throw AppError on failure
 */
export function validateOrThrow<T extends z.ZodSchema>(
  schema: T,
  data: unknown,
  errorMessage: string = 'Validation failed'
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const { AppError } = require('../middleware/error-handler');
    throw AppError.badRequest(errorMessage, {
      errors: formatZodErrors(result.error),
    });
  }

  return result.data;
}

export default {
  // Primitives
  uuidSchema,
  stringSchema,
  emailSchema,
  urlSchema,
  dateStringSchema,
  positiveIntSchema,
  nonNegativeIntSchema,

  // Pagination
  paginationSchema,
  offsetPaginationSchema,
  cursorPaginationSchema,

  // Sorting
  createSortSchema,

  // Search
  searchQuerySchema,
  dateRangeSchema,

  // Chinese
  chineseWordSchema,
  pinyinSchema,
  hskLevelSchema,
  vocabularyStatusSchema,

  // SRS
  srsQualitySchema,
  easeFactorSchema,

  // Entities
  createVocabularySchema,
  updateVocabularySchema,
  batchCreateVocabularySchema,
  createCardSchema,
  createDeckSchema,
  createClassroomSchema,
  createOrganizationSchema,
  createApiApplicationSchema,

  // Helpers
  parseQueryParams,
  createQuerySchema,
  formatZodErrors,
  validateOrThrow,
};
