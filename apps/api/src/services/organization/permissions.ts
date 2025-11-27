/**
 * Organization Permissions Service
 *
 * Role-based access control helpers.
 */

import { eq, and } from 'drizzle-orm';
import { db, organizationMembers } from '../../db';
import { type OrgRole } from './types';

// =============================================================================
// Get User Role
// =============================================================================

export async function getUserOrgRole(userId: string, orgId: string): Promise<OrgRole | null> {
  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.isActive, true)
      )
    )
    .limit(1);

  return (member?.role as OrgRole) ?? null;
}

// =============================================================================
// Permission Checks
// =============================================================================

export function canManageMembers(role: OrgRole): boolean {
  return ['owner', 'admin'].includes(role);
}

export function canManageDepartments(role: OrgRole): boolean {
  return ['owner', 'admin'].includes(role);
}

export function canManageSettings(role: OrgRole): boolean {
  return role === 'owner';
}

export function canViewAnalytics(role: OrgRole): boolean {
  return ['owner', 'admin', 'instructor'].includes(role);
}

export function canManageDecks(role: OrgRole): boolean {
  return ['owner', 'admin', 'instructor'].includes(role);
}
