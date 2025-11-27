/**
 * Organization Licenses Service
 *
 * License and seat management.
 */

import { eq } from 'drizzle-orm';
import {
  db,
  organizations,
  organizationLicenseHistory,
} from '../../db';
import { type LicenseTier } from './types';
import { logAuditEvent } from './audit';

// =============================================================================
// Update License
// =============================================================================

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
