/**
 * API response and error type definitions
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ApiErrorCode =
  // Auth errors
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_EXPIRED_TOKEN'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_EMAIL_EXISTS'
  | 'AUTH_USER_NOT_FOUND'
  // Authorization errors
  | 'FORBIDDEN'
  | 'SUBSCRIPTION_REQUIRED'
  | 'QUOTA_EXCEEDED'
  // Validation errors
  | 'VALIDATION_ERROR'
  | 'INVALID_INPUT'
  // Resource errors
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'ALREADY_EXISTS'
  // Server errors
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'RATE_LIMITED'
  // NLP errors
  | 'SEGMENTATION_FAILED'
  | 'SIMPLIFICATION_FAILED'
  | 'OCR_FAILED'
  | 'INFERENCE_TIMEOUT';

export interface ApiMeta {
  requestId?: string;
  processingTimeMs?: number;
  pagination?: PaginationMeta;
  rateLimit?: RateLimitMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface RateLimitMeta {
  limit: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Paginated request parameters
 */
export interface PaginatedRequest {
  page?: number;
  limit?: number;
}

/**
 * Auth types
 */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Analytics event types
 */
export interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  eventData?: Record<string, unknown>;
  timestamp?: Date;
}

export type AnalyticsEventType =
  | 'session_start'
  | 'session_end'
  | 'video_play'
  | 'video_pause'
  | 'word_lookup'
  | 'card_mined'
  | 'card_exported'
  | 'simplification_used'
  | 'pitch_practice'
  | 'settings_changed'
  | 'error_occurred';
