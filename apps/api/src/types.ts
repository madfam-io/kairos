import type { Context } from 'hono';
import type { User } from '@kairos/types';

/**
 * Organization context for enterprise features
 */
export interface OrgContext {
  organizationId: string;
  role: 'owner' | 'admin' | 'instructor' | 'member';
  organizationName?: string;
}

/**
 * Environment bindings for Hono app
 */
export interface AppEnv {
  Variables: {
    user: User | null;
    requestId: string;
    orgContext?: OrgContext;
  };
  Bindings: {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    DATABASE_URL: string;
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
    MODAL_TOKEN_ID: string;
    MODAL_TOKEN_SECRET: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    API_SECRET: string;
  };
}

export type AppContext = Context<AppEnv>;

/**
 * Authenticated context (after auth middleware)
 */
export interface AuthenticatedEnv extends AppEnv {
  Variables: AppEnv['Variables'] & {
    user: User;
  };
}

export type AuthenticatedContext = Context<AuthenticatedEnv>;
