import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { AppEnv } from '../types';
import { AppError } from '../middleware/error-handler';
import { strictRateLimiter } from '../middleware/rate-limiter';
import { getEnv } from '../lib/env';

export const authRoutes = new Hono<AppEnv>();

// Helper to get Supabase client with validated env vars
function getSupabaseClient() {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    throw new AppError('CONFIG_ERROR', 'Supabase credentials not configured', 500);
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

/**
 * POST /api/v1/auth/register
 * Rate limited to prevent abuse
 */
authRoutes.post('/register', strictRateLimiter(), zValidator('json', registerSchema), async (c) => {
  const { email, password, displayName } = c.req.valid('json');

  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      throw new AppError('AUTH_EMAIL_EXISTS', 'Email already registered', 409);
    }
    throw new AppError('AUTH_INVALID_CREDENTIALS', error.message, 400);
  }

  if (!data.session) {
    return c.json({
      success: true,
      data: {
        message: 'Please check your email to confirm your account',
        userId: data.user?.id,
      },
    });
  }

  return c.json({
    success: true,
    data: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: new Date(Date.now() + data.session.expires_in * 1000),
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    },
  });
});

/**
 * POST /api/v1/auth/login
 * Strict rate limiting to prevent brute force attacks
 */
authRoutes.post('/login', strictRateLimiter(), zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  return c.json({
    success: true,
    data: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: new Date(Date.now() + data.session.expires_in * 1000),
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    },
  });
});

/**
 * POST /api/v1/auth/refresh
 */
authRoutes.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    throw new AppError('AUTH_EXPIRED_TOKEN', 'Invalid or expired refresh token', 401);
  }

  return c.json({
    success: true,
    data: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: new Date(Date.now() + data.session.expires_in * 1000),
    },
  });
});

/**
 * POST /api/v1/auth/logout
 */
authRoutes.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  }

  return c.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

/**
 * POST /api/v1/auth/forgot-password
 * Rate limited to prevent email enumeration attacks
 */
authRoutes.post(
  '/forgot-password',
  strictRateLimiter(),
  zValidator('json', z.object({ email: z.string().email() })),
  async (c) => {
    const { email } = c.req.valid('json');
    const env = getEnv();

    const supabase = getSupabaseClient();
    const appUrl = env.APP_URL || 'https://app.kairos.dev';

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });

    // Always return success to prevent email enumeration
    return c.json({
      success: true,
      data: { message: 'If an account exists, a reset link has been sent' },
    });
  }
);
