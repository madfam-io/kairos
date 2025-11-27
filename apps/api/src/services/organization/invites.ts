/**
 * Organization Invites Service
 *
 * Invite management and bulk user provisioning.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import {
  db,
  organizationInvites,
  users,
} from '../../db';
import { type OrgRole, generateInviteToken } from './types';
import { logAuditEvent } from './audit';
import { addOrgMember } from './members';

// =============================================================================
// Create Invite
// =============================================================================

export async function createInvite(
  orgId: string,
  actorId: string,
  email: string,
  options?: { role?: OrgRole; departmentId?: string }
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(organizationInvites).values({
    organizationId: orgId,
    email: email.toLowerCase(),
    role: options?.role ?? 'member',
    departmentId: options?.departmentId,
    invitedById: actorId,
    token,
    expiresAt,
  });

  await logAuditEvent(orgId, actorId, 'invite_created', 'invite', email, {
    role: options?.role ?? 'member',
  });

  return { token, expiresAt };
}

// =============================================================================
// Get Invites
// =============================================================================

export async function getOrgInvites(
  orgId: string
): Promise<Array<typeof organizationInvites.$inferSelect & { invitedByEmail: string }>> {
  const invites = await db
    .select({
      invite: organizationInvites,
      invitedByEmail: users.email,
    })
    .from(organizationInvites)
    .innerJoin(users, eq(organizationInvites.invitedById, users.id))
    .where(
      and(eq(organizationInvites.organizationId, orgId), sql`${organizationInvites.acceptedAt} IS NULL`)
    )
    .orderBy(desc(organizationInvites.createdAt));

  return invites.map((i) => ({
    ...i.invite,
    invitedByEmail: i.invitedByEmail,
  }));
}

// =============================================================================
// Accept Invite
// =============================================================================

export async function acceptInvite(
  token: string,
  userId: string
): Promise<{ success: boolean; error?: string; organizationId?: string }> {
  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(eq(organizationInvites.token, token))
    .limit(1);

  if (!invite) {
    return { success: false, error: 'Invalid invite' };
  }

  if (invite.acceptedAt) {
    return { success: false, error: 'Invite already used' };
  }

  if (new Date() > invite.expiresAt) {
    return { success: false, error: 'Invite expired' };
  }

  // Check user email matches (optional, can be disabled)
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Add member
  const result = await addOrgMember(invite.organizationId, userId, invite.invitedById, {
    role: invite.role as OrgRole,
    departmentId: invite.departmentId ?? undefined,
  });

  if (!result.success) {
    return result;
  }

  // Mark invite as accepted
  await db
    .update(organizationInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(organizationInvites.id, invite.id));

  return { success: true, organizationId: invite.organizationId };
}

// =============================================================================
// Cancel Invite
// =============================================================================

export async function cancelInvite(orgId: string, inviteId: string, actorId: string): Promise<{ success: boolean }> {
  const [invite] = await db
    .delete(organizationInvites)
    .where(and(eq(organizationInvites.id, inviteId), eq(organizationInvites.organizationId, orgId)))
    .returning();

  if (invite) {
    await logAuditEvent(orgId, actorId, 'invite_cancelled', 'invite', invite.email, {});
  }

  return { success: !!invite };
}

// =============================================================================
// Bulk Provisioning
// =============================================================================

export async function bulkProvisionUsers(
  orgId: string,
  actorId: string,
  userList: Array<{
    email: string;
    displayName?: string;
    studentId?: string;
    departmentId?: string;
    role?: OrgRole;
  }>
): Promise<{ created: number; existing: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let existing = 0;

  for (const userData of userList) {
    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, userData.email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      // Try to add as member
      const result = await addOrgMember(orgId, existingUser.id, actorId, {
        role: userData.role,
        departmentId: userData.departmentId,
        displayName: userData.displayName,
        studentId: userData.studentId,
      });

      if (result.success) {
        existing++;
      } else {
        errors.push(`${userData.email}: ${result.error}`);
      }
    } else {
      // Create invite instead
      await createInvite(orgId, actorId, userData.email, {
        role: userData.role,
        departmentId: userData.departmentId,
      });
      created++;
    }
  }

  await logAuditEvent(orgId, actorId, 'bulk_provision', 'organization', orgId, {
    attempted: userList.length,
    created,
    existing,
    errors: errors.length,
  });

  return { created, existing, errors };
}
