/**
 * Organization Departments Service
 *
 * Department management operations.
 */

import { eq, and, sql } from 'drizzle-orm';
import {
  db,
  organizationMembers,
  organizationDepartments,
} from '../../db';
import { logAuditEvent } from './audit';

// =============================================================================
// Create Department
// =============================================================================

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

// =============================================================================
// Get Departments
// =============================================================================

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

// =============================================================================
// Update Department
// =============================================================================

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

// =============================================================================
// Delete Department
// =============================================================================

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
