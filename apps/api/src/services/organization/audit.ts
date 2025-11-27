/**
 * Organization Audit Service
 *
 * Audit logging for compliance and tracking.
 */

import { eq, and, desc, gte } from 'drizzle-orm';
import {
  db,
  organizationAuditLogs,
  users,
} from '../../db';

// =============================================================================
// Log Audit Event
// =============================================================================

export async function logAuditEvent(
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

// =============================================================================
// Get Audit Logs
// =============================================================================

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
