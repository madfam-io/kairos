/**
 * Referral Program Routes
 * Affiliate/referral system for user acquisition
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, sql, sum } from 'drizzle-orm';
import type { AppEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import { db, referralCodes, referralUsages, users } from '../db';
import { nanoid } from 'nanoid';

export const referralsRoutes = new Hono<AppEnv>();

// Helper to generate a unique referral code
function generateReferralCode(): string {
  return nanoid(8).toUpperCase();
}

/**
 * GET /api/v1/referrals
 * Get user's referral info
 */
referralsRoutes.get('/', requireAuth(), async (c) => {
  const user = c.get('user');

  // Get user's referral code
  const [code] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.userId, user.id))
    .limit(1);

  if (!code) {
    return c.json({
      success: true,
      data: {
        hasCode: false,
        code: null,
        stats: null,
      },
    });
  }

  // Get referral stats
  const usages = await db
    .select({
      total: sql<number>`count(*)::int`,
      totalCommission: sql<number>`coalesce(sum(${referralUsages.commission}), 0)`,
      pendingCommission: sql<number>`coalesce(sum(case when ${referralUsages.status} = 'pending' then ${referralUsages.commission} else 0 end), 0)`,
      paidCommission: sql<number>`coalesce(sum(case when ${referralUsages.status} = 'paid' then ${referralUsages.commission} else 0 end), 0)`,
    })
    .from(referralUsages)
    .where(eq(referralUsages.referralCodeId, code.id));

  return c.json({
    success: true,
    data: {
      hasCode: true,
      code: code.code,
      discountPercent: code.discountPercent,
      commissionPercent: code.commissionPercent,
      isActive: code.isActive,
      createdAt: code.createdAt,
      stats: {
        usageCount: code.usageCount,
        totalEarnings: code.totalEarnings,
        ...usages[0],
      },
    },
  });
});

/**
 * POST /api/v1/referrals/create
 * Create a referral code for the user
 */
referralsRoutes.post('/create', requireAuth(), async (c) => {
  const user = c.get('user');

  // Check if user already has a code
  const [existing] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.userId, user.id))
    .limit(1);

  if (existing) {
    return c.json({
      success: true,
      data: {
        code: existing.code,
        discountPercent: existing.discountPercent,
        commissionPercent: existing.commissionPercent,
        message: 'You already have a referral code',
      },
    });
  }

  // Check eligibility (must be a paid subscriber)
  const [userRecord] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

  if (!userRecord || userRecord.subscriptionTier === 'free') {
    throw new AppError('Referral codes are available for paid subscribers only', 403);
  }

  // Generate unique code
  let code: string;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    code = generateReferralCode();
    const [existing] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.code, code!))
      .limit(1);
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new AppError('Failed to generate unique code, please try again', 500);
  }

  // Create referral code
  const [created] = await db
    .insert(referralCodes)
    .values({
      userId: user.id,
      code: code!,
      discountPercent: 20,
      commissionPercent: 20,
    })
    .returning();

  return c.json({
    success: true,
    data: {
      code: created.code,
      discountPercent: created.discountPercent,
      commissionPercent: created.commissionPercent,
      shareUrl: `https://kairos.dev/signup?ref=${created.code}`,
    },
  });
});

/**
 * GET /api/v1/referrals/history
 * Get referral usage history
 */
referralsRoutes.get('/history', requireAuth(), async (c) => {
  const user = c.get('user');

  // Get user's referral code
  const [code] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.userId, user.id))
    .limit(1);

  if (!code) {
    return c.json({
      success: true,
      data: [],
    });
  }

  // Get usage history
  const history = await db
    .select({
      id: referralUsages.id,
      referredUserId: referralUsages.referredUserId,
      amount: referralUsages.amount,
      commission: referralUsages.commission,
      status: referralUsages.status,
      createdAt: referralUsages.createdAt,
    })
    .from(referralUsages)
    .where(eq(referralUsages.referralCodeId, code.id))
    .orderBy(desc(referralUsages.createdAt))
    .limit(100);

  return c.json({
    success: true,
    data: history,
  });
});

/**
 * POST /api/v1/referrals/validate
 * Validate a referral code (public endpoint for signup flow)
 */
referralsRoutes.post(
  '/validate',
  zValidator('json', z.object({ code: z.string().min(1).max(20) })),
  async (c) => {
    const { code } = c.req.valid('json');

    const [referralCode] = await db
      .select({
        code: referralCodes.code,
        discountPercent: referralCodes.discountPercent,
        isActive: referralCodes.isActive,
      })
      .from(referralCodes)
      .where(and(eq(referralCodes.code, code.toUpperCase()), eq(referralCodes.isActive, true)))
      .limit(1);

    if (!referralCode) {
      return c.json({
        success: true,
        data: {
          valid: false,
          message: 'Invalid or inactive referral code',
        },
      });
    }

    return c.json({
      success: true,
      data: {
        valid: true,
        discountPercent: referralCode.discountPercent,
        message: `You'll get ${referralCode.discountPercent}% off your first subscription!`,
      },
    });
  }
);

/**
 * POST /api/v1/referrals/apply
 * Apply a referral code to a new user (called during signup/checkout)
 */
referralsRoutes.post(
  '/apply',
  requireAuth(),
  zValidator(
    'json',
    z.object({
      code: z.string().min(1).max(20),
      subscriptionId: z.string().optional(),
      amount: z.number().positive().optional(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { code, subscriptionId, amount } = c.req.valid('json');

    // Get referral code
    const [referralCode] = await db
      .select()
      .from(referralCodes)
      .where(and(eq(referralCodes.code, code.toUpperCase()), eq(referralCodes.isActive, true)))
      .limit(1);

    if (!referralCode) {
      throw new AppError('Invalid or inactive referral code', 400);
    }

    // Check user hasn't already used a referral code
    const [existingUsage] = await db
      .select()
      .from(referralUsages)
      .where(eq(referralUsages.referredUserId, user.id))
      .limit(1);

    if (existingUsage) {
      throw new AppError('You have already used a referral code', 400);
    }

    // Can't use own referral code
    if (referralCode.userId === user.id) {
      throw new AppError('You cannot use your own referral code', 400);
    }

    // Calculate commission
    const commission = amount ? (amount * referralCode.commissionPercent) / 100 : 0;

    // Record usage
    const [usage] = await db
      .insert(referralUsages)
      .values({
        referralCodeId: referralCode.id,
        referredUserId: user.id,
        subscriptionId,
        amount,
        commission,
        status: 'pending',
      })
      .returning();

    // Update referral code stats
    await db
      .update(referralCodes)
      .set({
        usageCount: sql`${referralCodes.usageCount} + 1`,
        totalEarnings: sql`${referralCodes.totalEarnings} + ${commission}`,
      })
      .where(eq(referralCodes.id, referralCode.id));

    return c.json({
      success: true,
      data: {
        applied: true,
        discountPercent: referralCode.discountPercent,
        discountAmount: amount ? (amount * referralCode.discountPercent) / 100 : 0,
      },
    });
  }
);

/**
 * PATCH /api/v1/referrals/settings
 * Update referral code settings (admin or code owner)
 */
referralsRoutes.patch(
  '/settings',
  requireAuth(),
  zValidator(
    'json',
    z.object({
      isActive: z.boolean().optional(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const { isActive } = c.req.valid('json');

    // Get user's referral code
    const [code] = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.userId, user.id))
      .limit(1);

    if (!code) {
      throw new AppError('No referral code found', 404);
    }

    // Update
    const [updated] = await db
      .update(referralCodes)
      .set({
        isActive: isActive ?? code.isActive,
      })
      .where(eq(referralCodes.id, code.id))
      .returning();

    return c.json({
      success: true,
      data: {
        code: updated.code,
        isActive: updated.isActive,
      },
    });
  }
);

/**
 * GET /api/v1/referrals/leaderboard
 * Get top referrers (public leaderboard)
 */
referralsRoutes.get('/leaderboard', async (c) => {
  const topReferrers = await db
    .select({
      code: referralCodes.code,
      usageCount: referralCodes.usageCount,
    })
    .from(referralCodes)
    .where(eq(referralCodes.isActive, true))
    .orderBy(desc(referralCodes.usageCount))
    .limit(10);

  return c.json({
    success: true,
    data: topReferrers.map((r, index) => ({
      rank: index + 1,
      code: `${r.code.slice(0, 2)}***${r.code.slice(-2)}`,
      referrals: r.usageCount,
    })),
  });
});
