/**
 * Organization Management Service
 * Handles enterprise/institutional tier features
 */

import { eq, and, desc, sql, count, sum, avg, gte, lte, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import {
  db,
  organizations,
  organizationMembers,
  organizationDepartments,
  organizationInvites,
  organizationDecks,
  organizationSsoConfigs,
  organizationAuditLogs,
  organizationLicenseHistory,
  users,
  vocabulary,
  dailyStats,
  sharedDecks,
} from '../db';

// Types
export type OrgRole = 'owner' | 'admin' | 'instructor' | 'member';
export type OrgType = 'university' | 'school' | 'company' | 'language_school';
export type LicenseTier = 'standard' | 'premium' | 'unlimited';

export interface CreateOrgInput {
  name: string;
  type: OrgType;
  domain?: string;
  billingEmail?: string;
  maxSeats?: number;
  licenseTier?: LicenseTier;
}

export interface OrgMemberInfo {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: OrgRole;
  departmentId: string | null;
  departmentName: string | null;
  studentId: string | null;
  isActive: boolean;
  joinedAt: Date;
  lastActiveAt: Date | null;
}

export interface OrgAnalytics {
  totalMembers: number;
  activeMembers: number;
  totalWordsLearned: number;
  averageWordsPerMember: number;
  totalStudyTimeHours: number;
  averageStudyTimeHours: number;
  topLearners: Array<{
    userId: string;
    displayName: string | null;
    wordsLearned: number;
    studyTimeHours: number;
  }>;
  departmentBreakdown: Array<{
    departmentId: string | null;
    departmentName: string | null;
    memberCount: number;
    wordsLearned: number;
  }>;
  progressOverTime: Array<{
    date: string;
    wordsLearned: number;
    activeUsers: number;
  }>;
}

// Helper functions
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

// Organization CRUD

export async function createOrganization(
  creatorUserId: string,
  input: CreateOrgInput
): Promise<typeof organizations.$inferSelect> {
  const baseSlug = generateSlug(input.name);
  let slug = baseSlug;
  let attempt = 0;

  // Ensure unique slug
  while (true) {
    const [existing] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name: input.name,
      slug,
      type: input.type,
      domain: input.domain,
      billingEmail: input.billingEmail,
      maxSeats: input.maxSeats ?? 50,
      licenseTier: input.licenseTier ?? 'standard',
      usedSeats: 1, // Creator takes first seat
    })
    .returning();

  // Add creator as owner
  await db.insert(organizationMembers).values({
    organizationId: org.id,
    userId: creatorUserId,
    role: 'owner',
  });

  // Log creation
  await logAuditEvent(org.id, creatorUserId, 'organization_created', 'organization', org.id, {
    name: org.name,
    type: org.type,
  });

  // Record license history
  await db.insert(organizationLicenseHistory).values({
    organizationId: org.id,
    event: 'created',
    newTier: org.licenseTier,
    newSeats: org.maxSeats,
  });

  return org;
}

export async function getOrganization(orgId: string): Promise<typeof organizations.$inferSelect | null> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return org ?? null;
}

export async function getOrganizationBySlug(slug: string): Promise<typeof organizations.$inferSelect | null> {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return org ?? null;
}

export async function updateOrganization(
  orgId: string,
  actorId: string,
  updates: Partial<{
    name: string;
    logoUrl: string;
    domain: string;
    billingEmail: string;
    settings: Record<string, unknown>;
  }>
): Promise<typeof organizations.$inferSelect | null> {
  const [org] = await db
    .update(organizations)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(organizations.id, orgId))
    .returning();

  if (org) {
    await logAuditEvent(orgId, actorId, 'organization_updated', 'organization', orgId, updates);
  }

  return org ?? null;
}

export async function getUserOrganizations(
  userId: string
): Promise<Array<typeof organizations.$inferSelect & { role: OrgRole }>> {
  const memberships = await db
    .select({
      org: organizations,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.isActive, true)));

  return memberships.map((m) => ({
    ...m.org,
    role: m.role as OrgRole,
  }));
}

// Member management

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

// Department management

export async function createDepartment(
  orgId: string,
  actorId: string,
  input: { name: string; code?: string; description?: string; parentId?: string }
): Promise<typeof organizationDepartments.$inferSelect> {
  const [dept] = await db
    .insert(organizationDepartments)
    .values({
      organizationId: orgId,
      name: input.name,
      code: input.code,
      description: input.description,
      parentId: input.parentId,
    })
    .returning();

  await logAuditEvent(orgId, actorId, 'department_created', 'department', dept.id, {
    name: input.name,
    code: input.code,
  });

  return dept;
}

export async function getOrgDepartments(
  orgId: string
): Promise<Array<typeof organizationDepartments.$inferSelect & { memberCount: number }>> {
  const depts = await db
    .select({
      dept: organizationDepartments,
      memberCount: sql<number>`COUNT(${organizationMembers.id})::int`,
    })
    .from(organizationDepartments)
    .leftJoin(
      organizationMembers,
      and(
        eq(organizationMembers.departmentId, organizationDepartments.id),
        eq(organizationMembers.isActive, true)
      )
    )
    .where(and(eq(organizationDepartments.organizationId, orgId), eq(organizationDepartments.isActive, true)))
    .groupBy(organizationDepartments.id);

  return depts.map((d) => ({
    ...d.dept,
    memberCount: d.memberCount,
  }));
}

export async function updateDepartment(
  orgId: string,
  deptId: string,
  actorId: string,
  updates: Partial<{ name: string; code: string; description: string }>
): Promise<typeof organizationDepartments.$inferSelect | null> {
  const [dept] = await db
    .update(organizationDepartments)
    .set(updates)
    .where(and(eq(organizationDepartments.id, deptId), eq(organizationDepartments.organizationId, orgId)))
    .returning();

  if (dept) {
    await logAuditEvent(orgId, actorId, 'department_updated', 'department', deptId, updates);
  }

  return dept ?? null;
}

export async function deleteDepartment(
  orgId: string,
  deptId: string,
  actorId: string
): Promise<{ success: boolean }> {
  // Set members' departmentId to null
  await db
    .update(organizationMembers)
    .set({ departmentId: null })
    .where(eq(organizationMembers.departmentId, deptId));

  await db
    .update(organizationDepartments)
    .set({ isActive: false })
    .where(and(eq(organizationDepartments.id, deptId), eq(organizationDepartments.organizationId, orgId)));

  await logAuditEvent(orgId, actorId, 'department_deleted', 'department', deptId, {});

  return { success: true };
}

// Invite management

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

// Bulk user provisioning

export async function bulkProvisionUsers(
  orgId: string,
  actorId: string,
  users: Array<{
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

  for (const userData of users) {
    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(db._.fullSchema.users)
      .where(eq(db._.fullSchema.users.email, userData.email.toLowerCase()))
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
    attempted: users.length,
    created,
    existing,
    errors: errors.length,
  });

  return { created, existing, errors };
}

// Organization decks (private content library)

export async function addOrgDeck(
  orgId: string,
  deckId: string,
  actorId: string,
  options?: { departmentId?: string; isRequired?: boolean }
): Promise<{ success: boolean; error?: string }> {
  // Verify deck exists
  const [deck] = await db.select().from(sharedDecks).where(eq(sharedDecks.id, deckId)).limit(1);

  if (!deck) {
    return { success: false, error: 'Deck not found' };
  }

  try {
    await db.insert(organizationDecks).values({
      organizationId: orgId,
      deckId,
      departmentId: options?.departmentId,
      isRequired: options?.isRequired ?? false,
      addedById: actorId,
    });

    await logAuditEvent(orgId, actorId, 'deck_added', 'deck', deckId, {
      deckName: deck.name,
      isRequired: options?.isRequired,
    });

    return { success: true };
  } catch {
    return { success: false, error: 'Deck already added' };
  }
}

export async function getOrgDecks(
  orgId: string,
  departmentId?: string
): Promise<Array<typeof sharedDecks.$inferSelect & { isRequired: boolean; addedAt: Date }>> {
  let query = db
    .select({
      deck: sharedDecks,
      isRequired: organizationDecks.isRequired,
      addedAt: organizationDecks.createdAt,
    })
    .from(organizationDecks)
    .innerJoin(sharedDecks, eq(organizationDecks.deckId, sharedDecks.id))
    .where(eq(organizationDecks.organizationId, orgId))
    .$dynamic();

  if (departmentId) {
    query = query.where(
      sql`(${organizationDecks.departmentId} = ${departmentId} OR ${organizationDecks.departmentId} IS NULL)`
    );
  }

  const decks = await query;

  return decks.map((d) => ({
    ...d.deck,
    isRequired: d.isRequired,
    addedAt: d.addedAt,
  }));
}

export async function removeOrgDeck(
  orgId: string,
  deckId: string,
  actorId: string
): Promise<{ success: boolean }> {
  const [removed] = await db
    .delete(organizationDecks)
    .where(and(eq(organizationDecks.organizationId, orgId), eq(organizationDecks.deckId, deckId)))
    .returning();

  if (removed) {
    await logAuditEvent(orgId, actorId, 'deck_removed', 'deck', deckId, {});
  }

  return { success: !!removed };
}

// License management

export async function updateLicense(
  orgId: string,
  actorId: string,
  updates: { licenseTier?: LicenseTier; maxSeats?: number; licenseExpiresAt?: Date }
): Promise<{ success: boolean; error?: string }> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

  if (!org) {
    return { success: false, error: 'Organization not found' };
  }

  // Validate seat reduction
  if (updates.maxSeats && updates.maxSeats < org.usedSeats) {
    return {
      success: false,
      error: `Cannot reduce seats below current usage (${org.usedSeats} in use)`,
    };
  }

  await db
    .update(organizations)
    .set({
      licenseTier: updates.licenseTier ?? org.licenseTier,
      maxSeats: updates.maxSeats ?? org.maxSeats,
      licenseExpiresAt: updates.licenseExpiresAt ?? org.licenseExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));

  // Record history
  let event = 'updated';
  if (updates.licenseTier && updates.licenseTier !== org.licenseTier) {
    const tierOrder = ['standard', 'premium', 'unlimited'];
    event = tierOrder.indexOf(updates.licenseTier) > tierOrder.indexOf(org.licenseTier) ? 'upgraded' : 'downgraded';
  } else if (updates.maxSeats && updates.maxSeats !== org.maxSeats) {
    event = updates.maxSeats > org.maxSeats ? 'seats_increased' : 'seats_decreased';
  }

  await db.insert(organizationLicenseHistory).values({
    organizationId: orgId,
    event,
    previousTier: org.licenseTier,
    newTier: updates.licenseTier ?? org.licenseTier,
    previousSeats: org.maxSeats,
    newSeats: updates.maxSeats ?? org.maxSeats,
  });

  await logAuditEvent(orgId, actorId, 'license_updated', 'organization', orgId, {
    event,
    previousTier: org.licenseTier,
    newTier: updates.licenseTier,
    previousSeats: org.maxSeats,
    newSeats: updates.maxSeats,
  });

  return { success: true };
}

// Audit logging

async function logAuditEvent(
  orgId: string,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await db.insert(organizationAuditLogs).values({
    organizationId: orgId,
    actorId,
    action,
    targetType,
    targetId,
    details,
    ipAddress,
    userAgent,
  });
}

export async function getAuditLogs(
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
    actorId?: string;
    action?: string;
    since?: Date;
  }
): Promise<Array<typeof organizationAuditLogs.$inferSelect & { actorEmail: string | null }>> {
  let query = db
    .select({
      log: organizationAuditLogs,
      actorEmail: users.email,
    })
    .from(organizationAuditLogs)
    .leftJoin(users, eq(organizationAuditLogs.actorId, users.id))
    .where(eq(organizationAuditLogs.organizationId, orgId))
    .orderBy(desc(organizationAuditLogs.createdAt))
    .$dynamic();

  if (options?.actorId) {
    query = query.where(eq(organizationAuditLogs.actorId, options.actorId));
  }
  if (options?.action) {
    query = query.where(eq(organizationAuditLogs.action, options.action));
  }
  if (options?.since) {
    query = query.where(gte(organizationAuditLogs.createdAt, options.since));
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.offset(options.offset);
  }

  const logs = await query;

  return logs.map((l) => ({
    ...l.log,
    actorEmail: l.actorEmail,
  }));
}

// Organization analytics

export async function getOrgAnalytics(orgId: string, days: number = 30): Promise<OrgAnalytics> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get member IDs
  const members = await db
    .select({
      userId: organizationMembers.userId,
      displayName: organizationMembers.displayName,
      departmentId: organizationMembers.departmentId,
    })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.isActive, true)));

  const memberIds = members.map((m) => m.userId);

  if (memberIds.length === 0) {
    return {
      totalMembers: 0,
      activeMembers: 0,
      totalWordsLearned: 0,
      averageWordsPerMember: 0,
      totalStudyTimeHours: 0,
      averageStudyTimeHours: 0,
      topLearners: [],
      departmentBreakdown: [],
      progressOverTime: [],
    };
  }

  // Aggregate stats from daily_stats
  const stats = await db
    .select({
      userId: dailyStats.userId,
      wordsLearned: sum(dailyStats.wordsLearned),
      studyTimeMinutes: sum(dailyStats.studyTimeMinutes),
    })
    .from(dailyStats)
    .where(and(inArray(dailyStats.userId, memberIds), gte(dailyStats.date, since)))
    .groupBy(dailyStats.userId);

  const statsMap = new Map(stats.map((s) => [s.userId, s]));

  // Calculate totals
  let totalWordsLearned = 0;
  let totalStudyTimeMinutes = 0;
  let activeMembers = 0;

  const learnerStats = members.map((m) => {
    const s = statsMap.get(m.userId);
    const wordsLearned = Number(s?.wordsLearned) || 0;
    const studyTimeMinutes = Number(s?.studyTimeMinutes) || 0;

    totalWordsLearned += wordsLearned;
    totalStudyTimeMinutes += studyTimeMinutes;
    if (wordsLearned > 0 || studyTimeMinutes > 0) activeMembers++;

    return {
      userId: m.userId,
      displayName: m.displayName,
      wordsLearned,
      studyTimeHours: Math.round(studyTimeMinutes / 60 * 10) / 10,
      departmentId: m.departmentId,
    };
  });

  // Top learners
  const topLearners = learnerStats
    .sort((a, b) => b.wordsLearned - a.wordsLearned)
    .slice(0, 10);

  // Department breakdown
  const departments = await getOrgDepartments(orgId);
  const deptMap = new Map(departments.map((d) => [d.id, d.name]));

  const deptStats = new Map<string | null, { memberCount: number; wordsLearned: number }>();
  for (const m of learnerStats) {
    const key = m.departmentId;
    const existing = deptStats.get(key) || { memberCount: 0, wordsLearned: 0 };
    existing.memberCount++;
    existing.wordsLearned += m.wordsLearned;
    deptStats.set(key, existing);
  }

  const departmentBreakdown = Array.from(deptStats.entries()).map(([deptId, stats]) => ({
    departmentId: deptId,
    departmentName: deptId ? deptMap.get(deptId) ?? null : null,
    ...stats,
  }));

  // Progress over time
  const dailyProgress = await db
    .select({
      date: sql<string>`${dailyStats.date}::date`,
      wordsLearned: sum(dailyStats.wordsLearned),
      activeUsers: count(sql`DISTINCT ${dailyStats.userId}`),
    })
    .from(dailyStats)
    .where(and(inArray(dailyStats.userId, memberIds), gte(dailyStats.date, since)))
    .groupBy(sql`${dailyStats.date}::date`)
    .orderBy(sql`${dailyStats.date}::date`);

  const progressOverTime = dailyProgress.map((d) => ({
    date: d.date,
    wordsLearned: Number(d.wordsLearned) || 0,
    activeUsers: Number(d.activeUsers) || 0,
  }));

  return {
    totalMembers: members.length,
    activeMembers,
    totalWordsLearned,
    averageWordsPerMember: members.length > 0 ? Math.round(totalWordsLearned / members.length) : 0,
    totalStudyTimeHours: Math.round(totalStudyTimeMinutes / 60),
    averageStudyTimeHours:
      members.length > 0 ? Math.round((totalStudyTimeMinutes / 60 / members.length) * 10) / 10 : 0,
    topLearners,
    departmentBreakdown,
    progressOverTime,
  };
}

// Permission helpers

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
