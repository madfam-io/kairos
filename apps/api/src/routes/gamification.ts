import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import type { AuthenticatedEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import {
  studyGroups,
  studyGroupMembers,
  userFollows,
  activityFeed,
  activityLikes,
} from '../db/schema';
import {
  getUserXp,
  awardXp,
  checkAchievements,
  getUserAchievements,
  getAllAchievements,
  getDailyGoals,
  updateDailyGoals,
  getDailyProgress,
  getLeaderboard,
  getActivityFeed,
  createActivity,
} from '../services/gamification';
import { AppError } from '../middleware/error-handler';
import { log } from '../lib/logger';

export const gamificationRoutes = new Hono<AuthenticatedEnv>();

// All gamification routes require authentication
gamificationRoutes.use('*', requireAuth());

// ==================== XP & Leveling ====================

/**
 * GET /api/v1/gamification/xp
 * Get user's XP and level info
 */
gamificationRoutes.get('/xp', async (c) => {
  const user = c.get('user');

  const xp = await getUserXp(user.id);

  return c.json({
    success: true,
    data: xp,
  });
});

// ==================== Achievements ====================

/**
 * GET /api/v1/gamification/achievements
 * Get all achievements with earned status
 */
gamificationRoutes.get('/achievements', async (c) => {
  const user = c.get('user');

  const achievements = await getAllAchievements(user.id);

  return c.json({
    success: true,
    data: achievements,
  });
});

/**
 * GET /api/v1/gamification/achievements/earned
 * Get user's earned achievements
 */
gamificationRoutes.get('/achievements/earned', async (c) => {
  const user = c.get('user');

  const achievements = await getUserAchievements(user.id);

  return c.json({
    success: true,
    data: achievements,
  });
});

/**
 * POST /api/v1/gamification/achievements/check
 * Manually trigger achievement check (usually done automatically)
 */
gamificationRoutes.post('/achievements/check', async (c) => {
  const user = c.get('user');

  const earned = await checkAchievements(user.id, {
    action: 'manual_check',
  });

  return c.json({
    success: true,
    data: {
      earned,
      message: earned.length > 0
        ? `Earned ${earned.length} new achievement(s)!`
        : 'No new achievements earned',
    },
  });
});

// ==================== Daily Goals ====================

/**
 * GET /api/v1/gamification/goals
 * Get user's daily goals and progress
 */
gamificationRoutes.get('/goals', async (c) => {
  const user = c.get('user');

  const progress = await getDailyProgress(user.id);

  return c.json({
    success: true,
    data: progress,
  });
});

const updateGoalsSchema = z.object({
  wordsTarget: z.number().int().min(1).max(100).optional(),
  reviewTarget: z.number().int().min(1).max(200).optional(),
  studyMinutesTarget: z.number().int().min(5).max(180).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  autoAdjust: z.boolean().optional(),
});

/**
 * PATCH /api/v1/gamification/goals
 * Update daily goals
 */
gamificationRoutes.patch('/goals', zValidator('json', updateGoalsSchema), async (c) => {
  const user = c.get('user');
  const updates = c.req.valid('json');

  const goals = await updateDailyGoals(user.id, updates);

  return c.json({
    success: true,
    data: goals,
  });
});

// ==================== Leaderboards ====================

/**
 * GET /api/v1/gamification/leaderboard
 * Get leaderboard
 */
gamificationRoutes.get('/leaderboard', async (c) => {
  const user = c.get('user');
  const periodType = (c.req.query('period') || 'weekly') as 'daily' | 'weekly' | 'monthly' | 'all_time';
  const category = c.req.query('category') || 'global';
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

  const entries = await getLeaderboard(periodType, category, limit);

  // Find user's rank
  const userEntry = entries.find(e => e.userId === user.id);
  const userRank = userEntry ? entries.indexOf(userEntry) + 1 : null;

  return c.json({
    success: true,
    data: {
      periodType,
      category,
      entries,
      userRank,
      userEntry,
    },
  });
});

// ==================== Study Groups ====================

/**
 * GET /api/v1/gamification/groups
 * Get study groups (public or user's groups)
 */
gamificationRoutes.get('/groups', async (c) => {
  const user = c.get('user');
  const type = c.req.query('type') || 'public'; // 'public', 'mine', 'joined'
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);

  let groups;

  if (type === 'mine') {
    groups = await db.query.studyGroups.findMany({
      where: eq(studyGroups.ownerId, user.id),
      orderBy: [desc(studyGroups.createdAt)],
      limit,
    });
  } else if (type === 'joined') {
    const memberships = await db.query.studyGroupMembers.findMany({
      where: and(
        eq(studyGroupMembers.userId, user.id),
        eq(studyGroupMembers.status, 'active')
      ),
    });
    const groupIds = memberships.map(m => m.groupId);

    if (groupIds.length > 0) {
      groups = await db.query.studyGroups.findMany({
        where: sql`${studyGroups.id} = ANY(${groupIds})`,
        orderBy: [desc(studyGroups.createdAt)],
        limit,
      });
    } else {
      groups = [];
    }
  } else {
    groups = await db.query.studyGroups.findMany({
      where: eq(studyGroups.isPublic, true),
      orderBy: [desc(studyGroups.memberCount)],
      limit,
    });
  }

  return c.json({
    success: true,
    data: groups,
  });
});

const createGroupSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
  maxMembers: z.number().int().min(2).max(500).default(50),
  targetHskLevel: z.number().int().min(1).max(6).optional(),
  focusTopic: z.string().max(100).optional(),
  iconEmoji: z.string().max(10).optional(),
});

/**
 * POST /api/v1/gamification/groups
 * Create a new study group
 */
gamificationRoutes.post('/groups', zValidator('json', createGroupSchema), async (c) => {
  const user = c.get('user');
  const data = c.req.valid('json');

  // Generate slug from name
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36);

  // Create group
  const [group] = await db
    .insert(studyGroups)
    .values({
      ...data,
      slug,
      ownerId: user.id,
    })
    .returning();

  // Add owner as member
  await db.insert(studyGroupMembers).values({
    groupId: group.id,
    userId: user.id,
    role: 'owner',
    status: 'active',
  });

  // Create activity
  await createActivity(user.id, 'group_created', `Created study group "${group.name}"`, null, {
    groupId: group.id,
    groupName: group.name,
  });

  log.info('Study group created', { userId: user.id, groupId: group.id });

  return c.json({
    success: true,
    data: group,
  });
});

/**
 * GET /api/v1/gamification/groups/:id
 * Get a specific study group
 */
gamificationRoutes.get('/groups/:id', async (c) => {
  const user = c.get('user');
  const groupId = c.req.param('id');

  const group = await db.query.studyGroups.findFirst({
    where: eq(studyGroups.id, groupId),
  });

  if (!group) {
    throw new AppError('NOT_FOUND', 'Group not found', 404);
  }

  // Check membership
  const membership = await db.query.studyGroupMembers.findFirst({
    where: and(
      eq(studyGroupMembers.groupId, groupId),
      eq(studyGroupMembers.userId, user.id)
    ),
  });

  // Get members
  const members = await db.query.studyGroupMembers.findMany({
    where: and(
      eq(studyGroupMembers.groupId, groupId),
      eq(studyGroupMembers.status, 'active')
    ),
    orderBy: [desc(studyGroupMembers.wordsLearned)],
  });

  return c.json({
    success: true,
    data: {
      ...group,
      isMember: !!membership,
      membership,
      members,
    },
  });
});

/**
 * POST /api/v1/gamification/groups/:id/join
 * Join a study group
 */
gamificationRoutes.post('/groups/:id/join', async (c) => {
  const user = c.get('user');
  const groupId = c.req.param('id');

  const group = await db.query.studyGroups.findFirst({
    where: eq(studyGroups.id, groupId),
  });

  if (!group) {
    throw new AppError('NOT_FOUND', 'Group not found', 404);
  }

  if (group.memberCount >= group.maxMembers) {
    throw new AppError('GROUP_FULL', 'This group is full', 400);
  }

  // Check if already a member
  const existing = await db.query.studyGroupMembers.findFirst({
    where: and(
      eq(studyGroupMembers.groupId, groupId),
      eq(studyGroupMembers.userId, user.id)
    ),
  });

  if (existing) {
    throw new AppError('ALREADY_MEMBER', 'You are already a member of this group', 400);
  }

  // Add member
  const status = group.requiresApproval ? 'pending' : 'active';

  await db.insert(studyGroupMembers).values({
    groupId,
    userId: user.id,
    role: 'member',
    status,
  });

  if (status === 'active') {
    // Update member count
    await db
      .update(studyGroups)
      .set({
        memberCount: sql`${studyGroups.memberCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(studyGroups.id, groupId));
  }

  return c.json({
    success: true,
    data: {
      message: status === 'pending' ? 'Request sent, waiting for approval' : 'Joined group successfully',
      status,
    },
  });
});

/**
 * POST /api/v1/gamification/groups/:id/leave
 * Leave a study group
 */
gamificationRoutes.post('/groups/:id/leave', async (c) => {
  const user = c.get('user');
  const groupId = c.req.param('id');

  // Can't leave if you're the owner
  const group = await db.query.studyGroups.findFirst({
    where: eq(studyGroups.id, groupId),
  });

  if (!group) {
    throw new AppError('NOT_FOUND', 'Group not found', 404);
  }

  if (group.ownerId === user.id) {
    throw new AppError('OWNER_CANNOT_LEAVE', 'Owner cannot leave the group. Transfer ownership first.', 400);
  }

  const deleted = await db
    .delete(studyGroupMembers)
    .where(
      and(
        eq(studyGroupMembers.groupId, groupId),
        eq(studyGroupMembers.userId, user.id)
      )
    )
    .returning();

  if (deleted.length > 0 && deleted[0].status === 'active') {
    // Update member count
    await db
      .update(studyGroups)
      .set({
        memberCount: sql`${studyGroups.memberCount} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(studyGroups.id, groupId));
  }

  return c.json({
    success: true,
    data: { message: 'Left group successfully' },
  });
});

// ==================== Social / Following ====================

/**
 * GET /api/v1/gamification/following
 * Get users the current user is following
 */
gamificationRoutes.get('/following', async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

  const following = await db.query.userFollows.findMany({
    where: eq(userFollows.followerId, user.id),
    orderBy: [desc(userFollows.createdAt)],
    limit,
  });

  return c.json({
    success: true,
    data: following,
  });
});

/**
 * GET /api/v1/gamification/followers
 * Get users following the current user
 */
gamificationRoutes.get('/followers', async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

  const followers = await db.query.userFollows.findMany({
    where: eq(userFollows.followingId, user.id),
    orderBy: [desc(userFollows.createdAt)],
    limit,
  });

  return c.json({
    success: true,
    data: followers,
  });
});

/**
 * POST /api/v1/gamification/follow/:userId
 * Follow a user
 */
gamificationRoutes.post('/follow/:userId', async (c) => {
  const user = c.get('user');
  const targetUserId = c.req.param('userId');

  if (user.id === targetUserId) {
    throw new AppError('CANNOT_FOLLOW_SELF', 'You cannot follow yourself', 400);
  }

  await db
    .insert(userFollows)
    .values({
      followerId: user.id,
      followingId: targetUserId,
    })
    .onConflictDoNothing();

  return c.json({
    success: true,
    data: { message: 'Followed successfully' },
  });
});

/**
 * DELETE /api/v1/gamification/follow/:userId
 * Unfollow a user
 */
gamificationRoutes.delete('/follow/:userId', async (c) => {
  const user = c.get('user');
  const targetUserId = c.req.param('userId');

  await db
    .delete(userFollows)
    .where(
      and(
        eq(userFollows.followerId, user.id),
        eq(userFollows.followingId, targetUserId)
      )
    );

  return c.json({
    success: true,
    data: { message: 'Unfollowed successfully' },
  });
});

// ==================== Activity Feed ====================

/**
 * GET /api/v1/gamification/feed
 * Get activity feed
 */
gamificationRoutes.get('/feed', async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const activities = await getActivityFeed(user.id, { limit, offset });

  return c.json({
    success: true,
    data: activities,
  });
});

/**
 * POST /api/v1/gamification/feed/:id/like
 * Like an activity
 */
gamificationRoutes.post('/feed/:id/like', async (c) => {
  const user = c.get('user');
  const activityId = c.req.param('id');

  await db
    .insert(activityLikes)
    .values({
      activityId,
      userId: user.id,
    })
    .onConflictDoNothing();

  // Update like count
  await db
    .update(activityFeed)
    .set({
      likeCount: sql`${activityFeed.likeCount} + 1`,
    })
    .where(eq(activityFeed.id, activityId));

  return c.json({
    success: true,
    data: { message: 'Liked' },
  });
});

/**
 * DELETE /api/v1/gamification/feed/:id/like
 * Unlike an activity
 */
gamificationRoutes.delete('/feed/:id/like', async (c) => {
  const user = c.get('user');
  const activityId = c.req.param('id');

  const deleted = await db
    .delete(activityLikes)
    .where(
      and(
        eq(activityLikes.activityId, activityId),
        eq(activityLikes.userId, user.id)
      )
    )
    .returning();

  if (deleted.length > 0) {
    // Update like count
    await db
      .update(activityFeed)
      .set({
        likeCount: sql`${activityFeed.likeCount} - 1`,
      })
      .where(eq(activityFeed.id, activityId));
  }

  return c.json({
    success: true,
    data: { message: 'Unliked' },
  });
});

// ==================== Dashboard Summary ====================

/**
 * GET /api/v1/gamification/summary
 * Get gamification summary for dashboard
 */
gamificationRoutes.get('/summary', async (c) => {
  const user = c.get('user');

  const [xp, achievements, dailyProgress] = await Promise.all([
    getUserXp(user.id),
    getUserAchievements(user.id),
    getDailyProgress(user.id),
  ]);

  return c.json({
    success: true,
    data: {
      xp,
      achievementCount: achievements.length,
      recentAchievements: achievements.slice(0, 3),
      dailyProgress: dailyProgress.progress,
      streak: dailyProgress.streak,
    },
  });
});
