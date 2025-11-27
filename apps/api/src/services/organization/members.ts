/**
 * Organization Members Service
 *
 * Member management operations.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import {
  db,
  organizations,
  organizationMembers,
  organizationDepartments,
  users,
} from '../../db';
import { type OrgRole, type OrgMemberInfo } from './types';
import { logAuditEvent } from './audit';

// =============================================================================
// Get Members
// =============================================================================

export async function getOrgMembers(
  orgId: string,
  options?: {
    departmentId?: string;
    role?: OrgRole;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<OrgMemberInfo[]> {
  let query = db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      email: users.email,
      displayName: organizationMembers.displayName,
      role: organizationMembers.role,
      departmentId: organizationMembers.departmentId,
      departmentName: organizationDepartments.name,
      studentId: organizationMembers.studentId,
      isActive: organizationMembers.isActive,
      joinedAt: organizationMembers.joinedAt,
      lastActiveAt: organizationMembers.lastActiveAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .leftJoin(organizationDepartments, eq(organizationMembers.departmentId, organizationDepartments.id))
    .where(eq(organizationMembers.organizationId, orgId))
    .orderBy(desc(organizationMembers.joinedAt))
    .$dynamic();

  if (options?.departmentId) {
    query = query.where(eq(organizationMembers.departmentId, options.departmentId));
  }
  if (options?.role) {
    query = query.where(eq(organizationMembers.role, options.role));
  }
  if (options?.isActive !== undefined) {
    query = query.where(eq(organizationMembers.isActive, options.isActive));
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.offset(options.offset);
  }

  const members = await query;

  return members.map((m) => ({
    ...m,
    role: m.role as OrgRole,
  }));
}

// =============================================================================
// Add Member
// =============================================================================

export async function addOrgMember(
  orgId: string,
  userId: string,
  actorId: string,
  options?: {
    role?: OrgRole;
    departmentId?: string;
    displayName?: string;
    studentId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  // Check seat availability
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

  if (!org) {
    return { success: false, error: 'Organization not found' };
  }

  if (org.usedSeats >= org.maxSeats) {
    return { success: false, error: 'No available seats' };
  }

  // Check if user is already a member
  const [existing] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
    .limit(1);

  if (existing) {
    if (existing.isActive) {
      return { success: false, error: 'User is already a member' };
    }
    // Reactivate
    await db
      .update(organizationMembers)
      .set({
        isActive: true,
        role: options?.role ?? 'member',
        departmentId: options?.departmentId,
        displayName: options?.displayName,
        studentId: options?.studentId,
      })
      .where(eq(organizationMembers.id, existing.id));
  } else {
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId,
      role: options?.role ?? 'member',
      departmentId: options?.departmentId,
      displayName: options?.displayName,
      studentId: options?.studentId,
    });
  }

  // Update seat count
  await db
    .update(organizations)
    .set({ usedSeats: sql`${organizations.usedSeats} + 1` })
    .where(eq(organizations.id, orgId));

  // Upgrade user to immersion tier if not already
  await db
    .update(users)
    .set({ subscriptionTier: 'immersion' })
    .where(and(eq(users.id, userId), sql`${users.subscriptionTier} != 'immersion'`));

  await logAuditEvent(orgId, actorId, 'member_added', 'member', userId, {
    role: options?.role ?? 'member',
    departmentId: options?.departmentId,
  });

  return { success: true };
}

// =============================================================================
// Remove Member
// =============================================================================

export async function removeOrgMember(
  orgId: string,
  userId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
    .limit(1);

  if (!member) {
    return { success: false, error: 'Member not found' };
  }

  if (member.role === 'owner') {
    // Check if there's another owner
    const [otherOwner] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.role, 'owner'),
          sql`${organizationMembers.userId} != ${userId}`
        )
      )
      .limit(1);

    if (!otherOwner) {
      return { success: false, error: 'Cannot remove the only owner' };
    }
  }

  await db
    .update(organizationMembers)
    .set({ isActive: false })
    .where(eq(organizationMembers.id, member.id));

  // Update seat count
  await db
    .update(organizations)
    .set({ usedSeats: sql`GREATEST(0, ${organizations.usedSeats} - 1)` })
    .where(eq(organizations.id, orgId));

  await logAuditEvent(orgId, actorId, 'member_removed', 'member', userId, {
    previousRole: member.role,
  });

  return { success: true };
}

// =============================================================================
// Update Member Role
// =============================================================================

export async function updateMemberRole(
  orgId: string,
  userId: string,
  actorId: string,
  newRole: OrgRole
): Promise<{ success: boolean; error?: string }> {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
    .limit(1);

  if (!member) {
    return { success: false, error: 'Member not found' };
  }

  const previousRole = member.role;

  // Prevent demoting the only owner
  if (member.role === 'owner' && newRole !== 'owner') {
    const [otherOwner] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.role, 'owner'),
          sql`${organizationMembers.userId} != ${userId}`
        )
      )
      .limit(1);

    if (!otherOwner) {
      return { success: false, error: 'Cannot demote the only owner' };
    }
  }

  await db
    .update(organizationMembers)
    .set({ role: newRole })
    .where(eq(organizationMembers.id, member.id));

  await logAuditEvent(orgId, actorId, 'member_role_changed', 'member', userId, {
    previousRole,
    newRole,
  });

  return { success: true };
}
