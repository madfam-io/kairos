/**
 * Database Integration Tests: Organization Service
 *
 * Tests organization operations including:
 * - Organization CRUD
 * - Member management
 * - Department hierarchy
 * - License management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { eq, and, sql } from 'drizzle-orm';
import {
  getTestDatabase,
  closeTestDatabase,
  cleanTables,
  createDbTestUser,
  createDbTestOrganization,
  addUserToOrganization,
  canRunIntegrationTests,
} from './db-setup';
import * as schema from '../../db/schema';

const describeIntegration = canRunIntegrationTests() ? describe : describe.skip;

describeIntegration('Integration: Organization Database Operations', () => {
  beforeAll(async () => {
    await getTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanTables(
      'organization_audit_logs',
      'organization_license_history',
      'organization_sso_configs',
      'organization_decks',
      'organization_invites',
      'organization_members',
      'organization_departments',
      'organizations',
      'users'
    );
  });

  describe('Organization CRUD', () => {
    it('should create organization with required fields', async () => {
      const org = await createDbTestOrganization({
        name: 'Test University',
        slug: 'test-university',
        type: 'university',
      });

      expect(org.id).toBeDefined();
      expect(org.name).toBe('Test University');
      expect(org.slug).toBe('test-university');
      expect(org.type).toBe('university');
      expect(org.isActive).toBe(true);
      expect(org.licenseTier).toBe('standard');
    });

    it('should enforce unique slugs', async () => {
      await createDbTestOrganization({ slug: 'unique-slug' });

      try {
        await createDbTestOrganization({ slug: 'unique-slug' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should update organization settings', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization();

      const [updated] = await db
        .update(schema.organizations)
        .set({
          name: 'Updated Name',
          licenseTier: 'premium',
          maxSeats: 100,
          settings: { allowPublicDecks: true },
          updatedAt: new Date(),
        })
        .where(eq(schema.organizations.id, org.id))
        .returning();

      expect(updated.name).toBe('Updated Name');
      expect(updated.licenseTier).toBe('premium');
      expect(updated.maxSeats).toBe(100);
      expect((updated.settings as any).allowPublicDecks).toBe(true);
    });
  });

  describe('Member Management', () => {
    it('should add members with different roles', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization();

      const owner = await createDbTestUser({ email: 'owner@test.com' });
      const admin = await createDbTestUser({ email: 'admin@test.com' });
      const instructor = await createDbTestUser({ email: 'instructor@test.com' });
      const member = await createDbTestUser({ email: 'member@test.com' });

      await addUserToOrganization(org.id, owner.id, 'owner');
      await addUserToOrganization(org.id, admin.id, 'admin');
      await addUserToOrganization(org.id, instructor.id, 'instructor');
      await addUserToOrganization(org.id, member.id, 'member');

      const members = await db
        .select()
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.organizationId, org.id));

      expect(members.length).toBe(4);
      expect(members.some((m) => m.role === 'owner')).toBe(true);
      expect(members.some((m) => m.role === 'admin')).toBe(true);
      expect(members.some((m) => m.role === 'instructor')).toBe(true);
      expect(members.some((m) => m.role === 'member')).toBe(true);
    });

    it('should prevent duplicate membership', async () => {
      const org = await createDbTestOrganization();
      const user = await createDbTestUser();

      await addUserToOrganization(org.id, user.id, 'member');

      try {
        await addUserToOrganization(org.id, user.id, 'admin');
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should track used seats', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization({ maxSeats: 10 });

      // Add 3 members
      for (let i = 0; i < 3; i++) {
        const user = await createDbTestUser({ email: `user${i}@test.com` });
        await addUserToOrganization(org.id, user.id, 'member');
      }

      // Update used seats count
      const memberCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, org.id),
            eq(schema.organizationMembers.isActive, true)
          )
        );

      await db
        .update(schema.organizations)
        .set({ usedSeats: memberCount[0].count })
        .where(eq(schema.organizations.id, org.id));

      const [updatedOrg] = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, org.id));

      expect(updatedOrg.usedSeats).toBe(3);
    });

    it('should handle member deactivation', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization();
      const user = await createDbTestUser();

      const membership = await addUserToOrganization(org.id, user.id, 'member');

      // Deactivate member
      await db
        .update(schema.organizationMembers)
        .set({ isActive: false })
        .where(eq(schema.organizationMembers.id, membership.id));

      const activeMembers = await db
        .select()
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, org.id),
            eq(schema.organizationMembers.isActive, true)
          )
        );

      expect(activeMembers.length).toBe(0);
    });
  });

  describe('Department Hierarchy', () => {
    it('should create departments within organization', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization();

      const [dept] = await db
        .insert(schema.organizationDepartments)
        .values({
          organizationId: org.id,
          name: 'Chinese Department',
          code: 'CHIN',
          description: 'Chinese language studies',
        })
        .returning();

      expect(dept.id).toBeDefined();
      expect(dept.name).toBe('Chinese Department');
      expect(dept.code).toBe('CHIN');
    });

    it('should support nested departments', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization();

      // Create parent department
      const [parent] = await db
        .insert(schema.organizationDepartments)
        .values({
          organizationId: org.id,
          name: 'Languages',
          code: 'LANG',
        })
        .returning();

      // Create child department
      const [child] = await db
        .insert(schema.organizationDepartments)
        .values({
          organizationId: org.id,
          parentId: parent.id,
          name: 'Chinese',
          code: 'CHIN',
        })
        .returning();

      expect(child.parentId).toBe(parent.id);
    });

    it('should assign members to departments', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization();
      const user = await createDbTestUser();

      // Create department
      const [dept] = await db
        .insert(schema.organizationDepartments)
        .values({
          organizationId: org.id,
          name: 'Test Department',
        })
        .returning();

      // Add member to department
      const [member] = await db
        .insert(schema.organizationMembers)
        .values({
          organizationId: org.id,
          userId: user.id,
          departmentId: dept.id,
          role: 'member',
        })
        .returning();

      expect(member.departmentId).toBe(dept.id);
    });
  });

  describe('Audit Logging', () => {
    it('should log administrative actions', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization();
      const actor = await createDbTestUser();

      // Log an action
      const [log] = await db
        .insert(schema.organizationAuditLogs)
        .values({
          organizationId: org.id,
          actorId: actor.id,
          action: 'member_added',
          targetType: 'member',
          targetId: 'some-user-id',
          details: { role: 'instructor' },
          ipAddress: '192.168.1.1',
        })
        .returning();

      expect(log.action).toBe('member_added');
      expect(log.actorId).toBe(actor.id);
      expect((log.details as any).role).toBe('instructor');
    });

    it('should query audit logs by organization', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization();
      const actor = await createDbTestUser();

      // Create multiple logs
      await db.insert(schema.organizationAuditLogs).values([
        { organizationId: org.id, actorId: actor.id, action: 'settings_changed' },
        { organizationId: org.id, actorId: actor.id, action: 'member_added' },
        { organizationId: org.id, actorId: actor.id, action: 'member_removed' },
      ]);

      const logs = await db
        .select()
        .from(schema.organizationAuditLogs)
        .where(eq(schema.organizationAuditLogs.organizationId, org.id))
        .orderBy(schema.organizationAuditLogs.createdAt);

      expect(logs.length).toBe(3);
    });
  });

  describe('License Management', () => {
    it('should track license history', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization({ licenseTier: 'standard', maxSeats: 50 });

      // Log upgrade
      const [history] = await db
        .insert(schema.organizationLicenseHistory)
        .values({
          organizationId: org.id,
          event: 'upgraded',
          previousTier: 'standard',
          newTier: 'premium',
          previousSeats: 50,
          newSeats: 100,
          amount: 999.99,
          notes: 'Annual upgrade',
        })
        .returning();

      expect(history.event).toBe('upgraded');
      expect(history.previousTier).toBe('standard');
      expect(history.newTier).toBe('premium');
    });

    it('should handle license expiration', async () => {
      const db = await getTestDatabase();
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday

      const org = await createDbTestOrganization({
        licenseExpiresAt: expiredDate,
      });

      // Query for expired licenses
      const expiredOrgs = await db
        .select()
        .from(schema.organizations)
        .where(sql`${schema.organizations.licenseExpiresAt} < NOW()`);

      expect(expiredOrgs.some((o) => o.id === org.id)).toBe(true);
    });
  });

  describe('Cascade Deletion', () => {
    it('should delete all related data when organization is deleted', async () => {
      const db = await getTestDatabase();
      const org = await createDbTestOrganization();
      const user = await createDbTestUser();

      // Create department
      const [dept] = await db
        .insert(schema.organizationDepartments)
        .values({ organizationId: org.id, name: 'Dept' })
        .returning();

      // Add member
      await addUserToOrganization(org.id, user.id, 'member');

      // Add audit log
      await db
        .insert(schema.organizationAuditLogs)
        .values({ organizationId: org.id, actorId: user.id, action: 'test' });

      // Delete organization
      await db.delete(schema.organizations).where(eq(schema.organizations.id, org.id));

      // Verify cascade
      const members = await db
        .select()
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.organizationId, org.id));
      expect(members.length).toBe(0);

      const depts = await db
        .select()
        .from(schema.organizationDepartments)
        .where(eq(schema.organizationDepartments.organizationId, org.id));
      expect(depts.length).toBe(0);

      const logs = await db
        .select()
        .from(schema.organizationAuditLogs)
        .where(eq(schema.organizationAuditLogs.organizationId, org.id));
      expect(logs.length).toBe(0);
    });
  });
});
