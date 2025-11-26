/**
 * Organization-Aware Middleware
 * Adds organization context to requests when user is part of an org
 */

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types';
import { getUserOrgRole, getUserOrganizations, type OrgRole } from '../services/organization';

export interface OrgContext {
  organizationId: string;
  role: OrgRole;
  organizationName?: string;
}

/**
 * Middleware that adds organization context if user is a member
 * Sets c.var.orgContext if user belongs to exactly one org
 * or if X-Organization-Id header is provided
 */
export const withOrgContext = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user');

    if (!user) {
      await next();
      return;
    }

    // Check for explicit org header
    const orgIdHeader = c.req.header('X-Organization-Id');

    if (orgIdHeader) {
      const role = await getUserOrgRole(user.id, orgIdHeader);
      if (role) {
        c.set('orgContext', {
          organizationId: orgIdHeader,
          role,
        } as OrgContext);
      }
    } else {
      // Auto-select if user is in exactly one org
      const orgs = await getUserOrganizations(user.id);
      if (orgs.length === 1) {
        c.set('orgContext', {
          organizationId: orgs[0].id,
          role: orgs[0].role,
          organizationName: orgs[0].name,
        } as OrgContext);
      }
    }

    await next();
  });

/**
 * Middleware that requires user to be part of an organization
 */
export const requireOrg = () =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user');

    if (!user) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        },
        401
      );
    }

    const orgIdHeader = c.req.header('X-Organization-Id');

    if (!orgIdHeader) {
      // Check if user has any orgs
      const orgs = await getUserOrganizations(user.id);

      if (orgs.length === 0) {
        return c.json(
          {
            success: false,
            error: { code: 'NO_ORGANIZATION', message: 'User is not a member of any organization' },
          },
          403
        );
      }

      if (orgs.length > 1) {
        return c.json(
          {
            success: false,
            error: {
              code: 'MULTIPLE_ORGS',
              message: 'User belongs to multiple organizations. Please specify X-Organization-Id header',
              organizations: orgs.map((o) => ({ id: o.id, name: o.name })),
            },
          },
          400
        );
      }

      // Single org - use it
      c.set('orgContext', {
        organizationId: orgs[0].id,
        role: orgs[0].role,
        organizationName: orgs[0].name,
      } as OrgContext);
    } else {
      const role = await getUserOrgRole(user.id, orgIdHeader);

      if (!role) {
        return c.json(
          {
            success: false,
            error: { code: 'NOT_ORG_MEMBER', message: 'User is not a member of this organization' },
          },
          403
        );
      }

      c.set('orgContext', {
        organizationId: orgIdHeader,
        role,
      } as OrgContext);
    }

    await next();
  });

/**
 * Middleware that requires a specific role or higher
 */
export const requireOrgRole = (minRole: OrgRole) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const orgContext = c.get('orgContext') as OrgContext | undefined;

    if (!orgContext) {
      return c.json(
        {
          success: false,
          error: { code: 'NO_ORG_CONTEXT', message: 'Organization context required' },
        },
        403
      );
    }

    const roleHierarchy: OrgRole[] = ['member', 'instructor', 'admin', 'owner'];
    const userRoleIndex = roleHierarchy.indexOf(orgContext.role);
    const minRoleIndex = roleHierarchy.indexOf(minRole);

    if (userRoleIndex < minRoleIndex) {
      return c.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: `Requires ${minRole} role or higher`,
            currentRole: orgContext.role,
          },
        },
        403
      );
    }

    await next();
  });

/**
 * Check if user has org-level subscription (enterprise membership grants immersion tier)
 */
export async function hasOrgSubscription(userId: string): Promise<boolean> {
  const orgs = await getUserOrganizations(userId);

  // If user is in any active org, they get enterprise benefits
  return orgs.length > 0;
}

/**
 * Get the effective subscription tier for a user
 * Enterprise org membership overrides individual subscription
 */
export async function getEffectiveSubscriptionTier(
  userId: string,
  individualTier: string
): Promise<string> {
  const hasEnterprise = await hasOrgSubscription(userId);

  if (hasEnterprise) {
    return 'immersion'; // Enterprise members get full access
  }

  return individualTier;
}
