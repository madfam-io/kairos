/**
 * Enterprise/Institutional Routes
 * Admin portal APIs for organization management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/error-handler';
import {
  createOrganization,
  getOrganization,
  getOrganizationBySlug,
  updateOrganization,
  getUserOrganizations,
  getOrgMembers,
  addOrgMember,
  removeOrgMember,
  updateMemberRole,
  createDepartment,
  getOrgDepartments,
  updateDepartment,
  deleteDepartment,
  createInvite,
  getOrgInvites,
  acceptInvite,
  cancelInvite,
  bulkProvisionUsers,
  addOrgDeck,
  getOrgDecks,
  removeOrgDeck,
  updateLicense,
  getAuditLogs,
  getOrgAnalytics,
  getUserOrgRole,
  canManageMembers,
  canManageDepartments,
  canManageSettings,
  canViewAnalytics,
  canManageDecks,
  type OrgRole,
  type OrgType,
  type LicenseTier,
} from '../services/organization';

export const enterpriseRoutes = new Hono<AppEnv>();

// Require auth for all routes
enterpriseRoutes.use('*', requireAuth());

// Middleware to check org access and role
async function requireOrgAccess(
  userId: string,
  orgId: string,
  requiredPermission?: 'members' | 'departments' | 'settings' | 'analytics' | 'decks'
): Promise<OrgRole> {
  const role = await getUserOrgRole(userId, orgId);

  if (!role) {
    throw new AppError('Not a member of this organization', 403);
  }

  if (requiredPermission) {
    let hasPermission = false;
    switch (requiredPermission) {
      case 'members':
        hasPermission = canManageMembers(role);
        break;
      case 'departments':
        hasPermission = canManageDepartments(role);
        break;
      case 'settings':
        hasPermission = canManageSettings(role);
        break;
      case 'analytics':
        hasPermission = canViewAnalytics(role);
        break;
      case 'decks':
        hasPermission = canManageDecks(role);
        break;
    }

    if (!hasPermission) {
      throw new AppError('Insufficient permissions', 403);
    }
  }

  return role;
}

// Schemas
const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['university', 'school', 'company', 'language_school']),
  domain: z.string().optional(),
  billingEmail: z.string().email().optional(),
  maxSeats: z.number().min(5).max(10000).optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional(),
  domain: z.string().optional(),
  billingEmail: z.string().email().optional(),
  settings: z.record(z.unknown()).optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'instructor', 'member']).optional(),
  departmentId: z.string().uuid().optional(),
});

const bulkInviteSchema = z.object({
  users: z
    .array(
      z.object({
        email: z.string().email(),
        displayName: z.string().optional(),
        studentId: z.string().optional(),
        departmentId: z.string().uuid().optional(),
        role: z.enum(['admin', 'instructor', 'member']).optional(),
      })
    )
    .min(1)
    .max(500),
});

const departmentSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  parentId: z.string().uuid().optional(),
});

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'instructor', 'member']),
});

const addDeckSchema = z.object({
  deckId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  isRequired: z.boolean().optional(),
});

// ============================================================================
// Organization CRUD
// ============================================================================

/**
 * GET /api/v1/enterprise/organizations
 * Get user's organizations
 */
enterpriseRoutes.get('/organizations', async (c) => {
  const user = c.get('user');
  const orgs = await getUserOrganizations(user.id);

  return c.json({
    success: true,
    data: orgs,
  });
});

/**
 * POST /api/v1/enterprise/organizations
 * Create a new organization
 */
enterpriseRoutes.post('/organizations', zValidator('json', createOrgSchema), async (c) => {
  const user = c.get('user');
  const input = c.req.valid('json');

  const org = await createOrganization(user.id, input as Parameters<typeof createOrganization>[1]);

  return c.json({
    success: true,
    data: org,
  });
});

/**
 * GET /api/v1/enterprise/organizations/:orgId
 * Get organization details
 */
enterpriseRoutes.get('/organizations/:orgId', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  const role = await requireOrgAccess(user.id, orgId);
  const org = await getOrganization(orgId);

  if (!org) {
    throw new AppError('Organization not found', 404);
  }

  return c.json({
    success: true,
    data: {
      ...org,
      userRole: role,
    },
  });
});

/**
 * PATCH /api/v1/enterprise/organizations/:orgId
 * Update organization settings
 */
enterpriseRoutes.patch(
  '/organizations/:orgId',
  zValidator('json', updateOrgSchema),
  async (c) => {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const updates = c.req.valid('json');

    await requireOrgAccess(user.id, orgId, 'settings');

    const org = await updateOrganization(orgId, user.id, updates);

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    return c.json({
      success: true,
      data: org,
    });
  }
);

/**
 * GET /api/v1/enterprise/organizations/by-slug/:slug
 * Get organization by slug (for public join pages)
 */
enterpriseRoutes.get('/organizations/by-slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  const org = await getOrganizationBySlug(slug);

  if (!org || !org.isActive) {
    throw new AppError('Organization not found', 404);
  }

  // Return limited public info
  return c.json({
    success: true,
    data: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type,
      logoUrl: org.logoUrl,
    },
  });
});

// ============================================================================
// Member Management
// ============================================================================

/**
 * GET /api/v1/enterprise/organizations/:orgId/members
 * Get organization members
 */
enterpriseRoutes.get('/organizations/:orgId/members', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  await requireOrgAccess(user.id, orgId);

  const departmentId = c.req.query('departmentId');
  const role = c.req.query('role') as OrgRole | undefined;
  const isActive = c.req.query('isActive');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const members = await getOrgMembers(orgId, {
    departmentId: departmentId || undefined,
    role,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    limit: Math.min(limit, 100),
    offset,
  });

  return c.json({
    success: true,
    data: members,
  });
});

/**
 * POST /api/v1/enterprise/organizations/:orgId/members/:userId
 * Add a member to organization (by user ID)
 */
enterpriseRoutes.post('/organizations/:orgId/members/:userId', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const targetUserId = c.req.param('userId');

  await requireOrgAccess(user.id, orgId, 'members');

  const result = await addOrgMember(orgId, targetUserId, user.id);

  if (!result.success) {
    throw new AppError(result.error!, 400);
  }

  return c.json({
    success: true,
    data: { added: true },
  });
});

/**
 * PATCH /api/v1/enterprise/organizations/:orgId/members/:userId
 * Update member role
 */
enterpriseRoutes.patch(
  '/organizations/:orgId/members/:userId',
  zValidator('json', updateMemberSchema),
  async (c) => {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const targetUserId = c.req.param('userId');
    const { role: newRole } = c.req.valid('json');

    await requireOrgAccess(user.id, orgId, 'members');

    const result = await updateMemberRole(orgId, targetUserId, user.id, newRole);

    if (!result.success) {
      throw new AppError(result.error!, 400);
    }

    return c.json({
      success: true,
      data: { updated: true },
    });
  }
);

/**
 * DELETE /api/v1/enterprise/organizations/:orgId/members/:userId
 * Remove member from organization
 */
enterpriseRoutes.delete('/organizations/:orgId/members/:userId', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const targetUserId = c.req.param('userId');

  await requireOrgAccess(user.id, orgId, 'members');

  const result = await removeOrgMember(orgId, targetUserId, user.id);

  if (!result.success) {
    throw new AppError(result.error!, 400);
  }

  return c.json({
    success: true,
    data: { removed: true },
  });
});

// ============================================================================
// Invitations
// ============================================================================

/**
 * GET /api/v1/enterprise/organizations/:orgId/invites
 * Get pending invitations
 */
enterpriseRoutes.get('/organizations/:orgId/invites', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  await requireOrgAccess(user.id, orgId, 'members');

  const invites = await getOrgInvites(orgId);

  return c.json({
    success: true,
    data: invites,
  });
});

/**
 * POST /api/v1/enterprise/organizations/:orgId/invites
 * Create invitation
 */
enterpriseRoutes.post(
  '/organizations/:orgId/invites',
  zValidator('json', inviteSchema),
  async (c) => {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const { email, role, departmentId } = c.req.valid('json');

    await requireOrgAccess(user.id, orgId, 'members');

    const invite = await createInvite(orgId, user.id, email, { role: role as OrgRole, departmentId });

    return c.json({
      success: true,
      data: {
        token: invite.token,
        expiresAt: invite.expiresAt,
        inviteUrl: `${process.env.APP_URL || ''}/join/${invite.token}`,
      },
    });
  }
);

/**
 * POST /api/v1/enterprise/organizations/:orgId/invites/bulk
 * Bulk invite/provision users
 */
enterpriseRoutes.post(
  '/organizations/:orgId/invites/bulk',
  zValidator('json', bulkInviteSchema),
  async (c) => {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const { users: usersToProvision } = c.req.valid('json');

    await requireOrgAccess(user.id, orgId, 'members');

    const result = await bulkProvisionUsers(
      orgId,
      user.id,
      usersToProvision.map((u) => ({
        ...u,
        role: u.role as OrgRole | undefined,
      }))
    );

    return c.json({
      success: true,
      data: result,
    });
  }
);

/**
 * POST /api/v1/enterprise/invites/:token/accept
 * Accept invitation (for invited user)
 */
enterpriseRoutes.post('/invites/:token/accept', async (c) => {
  const user = c.get('user');
  const token = c.req.param('token');

  const result = await acceptInvite(token, user.id);

  if (!result.success) {
    throw new AppError(result.error!, 400);
  }

  return c.json({
    success: true,
    data: {
      organizationId: result.organizationId,
    },
  });
});

/**
 * DELETE /api/v1/enterprise/organizations/:orgId/invites/:inviteId
 * Cancel invitation
 */
enterpriseRoutes.delete('/organizations/:orgId/invites/:inviteId', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const inviteId = c.req.param('inviteId');

  await requireOrgAccess(user.id, orgId, 'members');

  await cancelInvite(orgId, inviteId, user.id);

  return c.json({
    success: true,
    data: { cancelled: true },
  });
});

// ============================================================================
// Departments
// ============================================================================

/**
 * GET /api/v1/enterprise/organizations/:orgId/departments
 * Get organization departments
 */
enterpriseRoutes.get('/organizations/:orgId/departments', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  await requireOrgAccess(user.id, orgId);

  const departments = await getOrgDepartments(orgId);

  return c.json({
    success: true,
    data: departments,
  });
});

/**
 * POST /api/v1/enterprise/organizations/:orgId/departments
 * Create department
 */
enterpriseRoutes.post(
  '/organizations/:orgId/departments',
  zValidator('json', departmentSchema),
  async (c) => {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const input = c.req.valid('json');

    await requireOrgAccess(user.id, orgId, 'departments');

    const dept = await createDepartment(orgId, user.id, input);

    return c.json({
      success: true,
      data: dept,
    });
  }
);

/**
 * PATCH /api/v1/enterprise/organizations/:orgId/departments/:deptId
 * Update department
 */
enterpriseRoutes.patch(
  '/organizations/:orgId/departments/:deptId',
  zValidator('json', departmentSchema.partial()),
  async (c) => {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const deptId = c.req.param('deptId');
    const updates = c.req.valid('json');

    await requireOrgAccess(user.id, orgId, 'departments');

    const dept = await updateDepartment(orgId, deptId, user.id, updates);

    if (!dept) {
      throw new AppError('Department not found', 404);
    }

    return c.json({
      success: true,
      data: dept,
    });
  }
);

/**
 * DELETE /api/v1/enterprise/organizations/:orgId/departments/:deptId
 * Delete department
 */
enterpriseRoutes.delete('/organizations/:orgId/departments/:deptId', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const deptId = c.req.param('deptId');

  await requireOrgAccess(user.id, orgId, 'departments');

  await deleteDepartment(orgId, deptId, user.id);

  return c.json({
    success: true,
    data: { deleted: true },
  });
});

// ============================================================================
// Organization Decks (Private Content Library)
// ============================================================================

/**
 * GET /api/v1/enterprise/organizations/:orgId/decks
 * Get organization's private deck library
 */
enterpriseRoutes.get('/organizations/:orgId/decks', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  await requireOrgAccess(user.id, orgId);

  const departmentId = c.req.query('departmentId');
  const decks = await getOrgDecks(orgId, departmentId || undefined);

  return c.json({
    success: true,
    data: decks,
  });
});

/**
 * POST /api/v1/enterprise/organizations/:orgId/decks
 * Add deck to organization library
 */
enterpriseRoutes.post(
  '/organizations/:orgId/decks',
  zValidator('json', addDeckSchema),
  async (c) => {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const { deckId, departmentId, isRequired } = c.req.valid('json');

    await requireOrgAccess(user.id, orgId, 'decks');

    const result = await addOrgDeck(orgId, deckId, user.id, { departmentId, isRequired });

    if (!result.success) {
      throw new AppError(result.error!, 400);
    }

    return c.json({
      success: true,
      data: { added: true },
    });
  }
);

/**
 * DELETE /api/v1/enterprise/organizations/:orgId/decks/:deckId
 * Remove deck from organization library
 */
enterpriseRoutes.delete('/organizations/:orgId/decks/:deckId', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');
  const deckId = c.req.param('deckId');

  await requireOrgAccess(user.id, orgId, 'decks');

  await removeOrgDeck(orgId, deckId, user.id);

  return c.json({
    success: true,
    data: { removed: true },
  });
});

// ============================================================================
// Analytics
// ============================================================================

/**
 * GET /api/v1/enterprise/organizations/:orgId/analytics
 * Get organization analytics
 */
enterpriseRoutes.get('/organizations/:orgId/analytics', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  await requireOrgAccess(user.id, orgId, 'analytics');

  const days = parseInt(c.req.query('days') || '30', 10);
  const analytics = await getOrgAnalytics(orgId, Math.min(365, Math.max(7, days)));

  return c.json({
    success: true,
    data: analytics,
  });
});

// ============================================================================
// Audit Logs
// ============================================================================

/**
 * GET /api/v1/enterprise/organizations/:orgId/audit-logs
 * Get audit logs
 */
enterpriseRoutes.get('/organizations/:orgId/audit-logs', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  await requireOrgAccess(user.id, orgId, 'settings');

  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const actorId = c.req.query('actorId');
  const action = c.req.query('action');

  const logs = await getAuditLogs(orgId, {
    limit: Math.min(limit, 100),
    offset,
    actorId: actorId || undefined,
    action: action || undefined,
  });

  return c.json({
    success: true,
    data: logs,
  });
});

// ============================================================================
// License Management (Admin only)
// ============================================================================

/**
 * GET /api/v1/enterprise/organizations/:orgId/license
 * Get license information
 */
enterpriseRoutes.get('/organizations/:orgId/license', async (c) => {
  const user = c.get('user');
  const orgId = c.req.param('orgId');

  await requireOrgAccess(user.id, orgId, 'settings');

  const org = await getOrganization(orgId);

  if (!org) {
    throw new AppError('Organization not found', 404);
  }

  return c.json({
    success: true,
    data: {
      licenseTier: org.licenseTier,
      maxSeats: org.maxSeats,
      usedSeats: org.usedSeats,
      availableSeats: org.maxSeats - org.usedSeats,
      licenseExpiresAt: org.licenseExpiresAt,
      isExpired: org.licenseExpiresAt ? new Date() > org.licenseExpiresAt : false,
    },
  });
});

/**
 * PATCH /api/v1/enterprise/organizations/:orgId/license
 * Update license (internal/admin use)
 */
enterpriseRoutes.patch(
  '/organizations/:orgId/license',
  zValidator(
    'json',
    z.object({
      licenseTier: z.enum(['standard', 'premium', 'unlimited']).optional(),
      maxSeats: z.number().min(5).max(10000).optional(),
      licenseExpiresAt: z.string().datetime().optional(),
    })
  ),
  async (c) => {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const updates = c.req.valid('json');

    await requireOrgAccess(user.id, orgId, 'settings');

    const result = await updateLicense(orgId, user.id, {
      licenseTier: updates.licenseTier as LicenseTier | undefined,
      maxSeats: updates.maxSeats,
      licenseExpiresAt: updates.licenseExpiresAt ? new Date(updates.licenseExpiresAt) : undefined,
    });

    if (!result.success) {
      throw new AppError(result.error!, 400);
    }

    return c.json({
      success: true,
      data: { updated: true },
    });
  }
);
