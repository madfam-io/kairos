import type { MiddlewareHandler } from 'hono';
import type { AppEnv, AuthenticatedEnv } from '../types';
import { AppError } from './error-handler';
import { getJanuaClient, AuthError, type JanuaUser } from '../services/janua';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Map Janua user to Kairos user format
 */
function mapJanuaUser(januaUser: JanuaUser, subscriptionData?: SubscriptionData) {
  // Determine subscription tier from Janua roles or metadata
  let subscriptionTier: 'free' | 'learner' | 'immersion' = 'free';
  let subscriptionExpiresAt: Date | null = null;

  if (januaUser.roles.includes('immersion') || januaUser.roles.includes('subscriber:immersion')) {
    subscriptionTier = 'immersion';
  } else if (januaUser.roles.includes('learner') || januaUser.roles.includes('subscriber:learner')) {
    subscriptionTier = 'learner';
  }

  // Check metadata for subscription expiry
  if (januaUser.metadata?.subscriptionExpiresAt) {
    subscriptionExpiresAt = new Date(januaUser.metadata.subscriptionExpiresAt as string);
  }

  // Override with provided subscription data if available
  if (subscriptionData) {
    subscriptionTier = subscriptionData.tier;
    subscriptionExpiresAt = subscriptionData.expiresAt;
  }

  return {
    id: januaUser.id,
    email: januaUser.email,
    name: januaUser.name,
    avatarUrl: januaUser.avatarUrl,
    createdAt: new Date(januaUser.createdAt),
    subscriptionTier,
    subscriptionExpiresAt,
    settings: (januaUser.metadata?.settings as Record<string, unknown>) ?? {},
  };
}

interface SubscriptionData {
  tier: 'free' | 'learner' | 'immersion';
  expiresAt: Date | null;
}

/**
 * Fetch subscription data from local database for better performance
 * Falls back gracefully if user doesn't exist yet (first login)
 */
async function fetchSubscriptionFromDB(userId: string): Promise<SubscriptionData | null> {
  try {
    const result = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        subscriptionTier: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!result) {
      return null;
    }

    return {
      tier: (result.subscriptionTier as 'free' | 'learner' | 'immersion') || 'free',
      expiresAt: result.subscriptionExpiresAt,
    };
  } catch {
    // Database errors should not break authentication
    // Fall back to Janua metadata
    return null;
  }
}

/**
 * Authentication middleware - validates Janua JWT and loads user
 */
export function requireAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const janua = getJanuaClient();

      // Verify the JWT token
      const payload = await janua.verifyToken(token);

      // Convert token payload to user object
      const januaUser = janua.tokenToUser(payload);

      // Fetch subscription data from local database for better performance
      // This avoids relying solely on Janua metadata and provides faster lookups
      const subscriptionData = await fetchSubscriptionFromDB(januaUser.id);

      c.set('user', mapJanuaUser(januaUser, subscriptionData ?? undefined));

      await next();
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.code === 'TOKEN_EXPIRED') {
          throw AppError.unauthorized('Token has expired');
        }
        throw AppError.unauthorized(err.message);
      }
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
      const janua = getJanuaClient();
      const payload = await janua.verifyToken(token);
      const januaUser = janua.tokenToUser(payload);

      // Fetch subscription from local DB for consistency
      const subscriptionData = await fetchSubscriptionFromDB(januaUser.id);
      c.set('user', mapJanuaUser(januaUser, subscriptionData ?? undefined));
    } catch {
      // Ignore auth errors for optional auth
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

/**
 * Role-based access control middleware
 */
export function requireRole(role: string): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const janua = getJanuaClient();
      const payload = await janua.verifyToken(token);

      if (!payload.roles?.includes(role)) {
        throw new AppError('FORBIDDEN', `Role '${role}' required`, 403);
      }

      await next();
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.unauthorized('Authentication failed');
    }
  };
}

/**
 * Admin-only middleware
 */
export function requireAdmin(): MiddlewareHandler<AppEnv> {
  return requireRole('admin');
}
