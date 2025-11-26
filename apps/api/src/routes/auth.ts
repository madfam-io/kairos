import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { AppEnv } from '../types';
import { AppError } from '../middleware/error-handler';

export const authRoutes = new Hono<AppEnv>();

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
 */
authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, displayName } = c.req.valid('json');

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

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
 */
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

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

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

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
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
    await supabase.auth.signOut();
  }

  return c.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

/**
 * POST /api/v1/auth/forgot-password
 */
authRoutes.post(
  '/forgot-password',
  zValidator('json', z.object({ email: z.string().email() })),
  async (c) => {
    const { email } = c.req.valid('json');

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://app.kairos.dev/reset-password',
    });

    // Always return success to prevent email enumeration
    return c.json({
      success: true,
      data: { message: 'If an account exists, a reset link has been sent' },
    });
  }
);
