import { z } from 'zod';

/**
 * Environment variable schema
 * Validates all required env vars on startup to fail fast
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_BASE_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis (Upstash)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Authentication (Janua)
  JANUA_PROJECT_ID: z.string().optional(),
  JANUA_SECRET_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(32).optional(),

  // Supabase (optional, for storage)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Payment providers
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CONEKTA_API_KEY: z.string().optional(),
  CONEKTA_WEBHOOK_SECRET: z.string().optional(),
  POLAR_ACCESS_TOKEN: z.string().optional(),
  POLAR_WEBHOOK_SECRET: z.string().optional(),

  // AI Services
  MODAL_TOKEN_ID: z.string().optional(),
  MODAL_TOKEN_SECRET: z.string().optional(),
  HUGGINGFACE_TOKEN: z.string().optional(),
  NLP_SERVICE_URL: z.string().url().optional(),
  SPEECH_SERVICE_URL: z.string().url().optional(),
  OCR_SERVICE_URL: z.string().url().optional(),

  // Observability
  SENTRY_DSN: z.string().url().optional(),
  POSTHOG_KEY: z.string().optional(),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),

  // Security
  API_SECRET: z.string().min(16).optional(),
  CORS_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validate environment variables on startup
 * Throws detailed error if validation fails
 */
export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error('\n❌ Environment validation failed:\n');
    console.error(errors);
    console.error('\nPlease check your .env file and ensure all required variables are set.\n');

    // In production, exit immediately
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }

    // In development, throw error but don't exit
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  validatedEnv = result.data;
  return validatedEnv;
}

/**
 * Get validated environment (must call validateEnv first)
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

/**
 * Check if a feature is enabled based on env vars
 */
export const features = {
  hasRedis: () => {
    const env = getEnv();
    return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
  },

  hasSentry: () => {
    const env = getEnv();
    return !!env.SENTRY_DSN;
  },

  hasStripe: () => {
    const env = getEnv();
    return !!env.STRIPE_SECRET_KEY;
  },

  hasAIServices: () => {
    const env = getEnv();
    return !!(env.NLP_SERVICE_URL || env.MODAL_TOKEN_ID);
  },

  isProduction: () => {
    const env = getEnv();
    return env.NODE_ENV === 'production';
  },
};
