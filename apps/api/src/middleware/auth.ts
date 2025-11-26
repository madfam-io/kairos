import type { MiddlewareHandler } from 'hono';
import { createClient } from '@supabase/supabase-js';
import type { AppEnv, AuthenticatedEnv } from '../types';
import { AppError } from './error-handler';

/**
 * Authentication middleware - validates JWT and loads user
 */
export function requireAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const supabase = createClient(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_ANON_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        throw AppError.unauthorized('Invalid or expired token');
      }

      // Load full user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        throw AppError.unauthorized('User profile not found');
      }

      c.set('user', {
        id: profile.id,
        email: profile.email,
        createdAt: new Date(profile.created_at),
        subscriptionTier: profile.subscription_tier,
        subscriptionExpiresAt: profile.subscription_expires_at
          ? new Date(profile.subscription_expires_at)
          : null,
        settings: profile.settings,
      });

      await next();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.unauthorized('Authentication failed');
    }
  };
}

/**
 * Optional auth - loads user if token present, but doesn't require it
 */
export function optionalAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      c.set('user', null);
      await next();
      return;
    }

    const token = authHeader.slice(7);

    try {
      const supabase = createClient(
        c.env.SUPABASE_URL,
        c.env.SUPABASE_ANON_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { data, error } = await supabase.auth.getUser(token);

      if (!error && data.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profile) {
          c.set('user', {
            id: profile.id,
            email: profile.email,
            createdAt: new Date(profile.created_at),
            subscriptionTier: profile.subscription_tier,
            subscriptionExpiresAt: profile.subscription_expires_at
              ? new Date(profile.subscription_expires_at)
              : null,
            settings: profile.settings,
          });
        }
      }
    } catch {
      // Ignore auth errors for optional auth
    }

    if (!c.get('user')) {
      c.set('user', null);
    }

    await next();
  };
}

/**
 * Subscription tier check middleware
 */
export function requireSubscription(
  minTier: 'learner' | 'immersion'
): MiddlewareHandler<AuthenticatedEnv> {
  const tierLevels = { free: 0, learner: 1, immersion: 2 };

  return async (c, next) => {
    const user = c.get('user');

    if (!user) {
      throw AppError.unauthorized();
    }

    const userLevel = tierLevels[user.subscriptionTier];
    const requiredLevel = tierLevels[minTier];

    if (userLevel < requiredLevel) {
      throw new AppError(
        'SUBSCRIPTION_REQUIRED',
        `This feature requires a ${minTier} subscription or higher`,
        403
      );
    }

    // Check if subscription is expired
    if (
      user.subscriptionTier !== 'free' &&
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt < new Date()
    ) {
      throw new AppError(
        'SUBSCRIPTION_REQUIRED',
        'Your subscription has expired',
        403
      );
    }

    await next();
  };
}
