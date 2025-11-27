/**
 * Organization Core Service
 *
 * Organization CRUD operations.
 */

import { eq, and, sql } from 'drizzle-orm';
import {
  db,
  organizations,
  organizationMembers,
  organizationLicenseHistory,
} from '../../db';
import { type CreateOrgInput, type OrgRole, generateSlug } from './types';
import { logAuditEvent } from './audit';

// =============================================================================
// Create Organization
// =============================================================================

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

// =============================================================================
// Get Organization
// =============================================================================

export async function getOrganization(orgId: string): Promise<typeof organizations.$inferSelect | null> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return org ?? null;
}

export async function getOrganizationBySlug(slug: string): Promise<typeof organizations.$inferSelect | null> {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return org ?? null;
}

// =============================================================================
// Update Organization
// =============================================================================

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

// =============================================================================
// Get User Organizations
// =============================================================================

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
