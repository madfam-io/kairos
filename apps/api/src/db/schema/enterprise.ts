/**
 * Enterprise Schema - Organizations, Members, Departments, SSO, Audit Logs
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './core';
import { sharedDecks } from './community';

/**
 * Organizations - universities, schools, companies
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(), // URL-safe identifier
    type: text('type').notNull().default('university'), // 'university', 'school', 'company', 'language_school'
    logoUrl: text('logo_url'),
    domain: text('domain'), // Email domain for auto-join (e.g., 'stanford.edu')
    settings: jsonb('settings').default({}).notNull(),
    // Billing
    billingEmail: text('billing_email'),
    billingAddress: jsonb('billing_address'),
    stripeCustomerId: text('stripe_customer_id'),
    // License info
    licenseTier: text('license_tier').default('standard').notNull(), // 'standard', 'premium', 'unlimited'
    maxSeats: integer('max_seats').default(50).notNull(),
    usedSeats: integer('used_seats').default(0).notNull(),
    licenseExpiresAt: timestamp('license_expires_at', { withTimezone: true }),
    // Status
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
    domainIdx: index('organizations_domain_idx').on(table.domain),
  })
);

/**
 * Organization departments - sub-groups within an org
 */
export const organizationDepartments = pgTable(
  'organization_departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'), // For nested departments
    name: text('name').notNull(),
    code: text('code'), // e.g., 'CHIN101', 'EAST-ASIAN'
    description: text('description'),
    settings: jsonb('settings').default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('org_departments_org_idx').on(table.organizationId),
    codeIdx: index('org_departments_code_idx').on(table.organizationId, table.code),
  })
);

/**
 * Organization members - users belonging to an org with roles
 */
export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id').references(() => organizationDepartments.id, {
      onDelete: 'set null',
    }),
    role: text('role').notNull().default('member'), // 'owner', 'admin', 'instructor', 'member'
    displayName: text('display_name'),
    studentId: text('student_id'), // External student/employee ID
    isActive: boolean('is_active').default(true).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  },
  (table) => ({
    orgUserUnique: uniqueIndex('org_member_unique_idx').on(table.organizationId, table.userId),
    orgIdx: index('org_members_org_idx').on(table.organizationId),
    userIdx: index('org_members_user_idx').on(table.userId),
    deptIdx: index('org_members_dept_idx').on(table.departmentId),
  })
);

/**
 * Organization invites - pending invitations
 */
export const organizationInvites = pgTable(
  'organization_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('member'),
    departmentId: uuid('department_id').references(() => organizationDepartments.id),
    invitedById: uuid('invited_by_id')
      .notNull()
      .references(() => users.id),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('org_invites_token_idx').on(table.token),
    orgEmailIdx: index('org_invites_org_email_idx').on(table.organizationId, table.email),
  })
);

/**
 * Organization decks - private content libraries for orgs
 */
export const organizationDecks = pgTable(
  'organization_decks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    deckId: uuid('deck_id')
      .notNull()
      .references(() => sharedDecks.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id').references(() => organizationDepartments.id),
    isRequired: boolean('is_required').default(false).notNull(), // Required for all members
    addedById: uuid('added_by_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgDeckUnique: uniqueIndex('org_deck_unique_idx').on(table.organizationId, table.deckId),
    orgIdx: index('org_decks_org_idx').on(table.organizationId),
  })
);

/**
 * Organization SSO configs - SAML/OIDC settings
 */
export const organizationSsoConfigs = pgTable(
  'organization_sso_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' })
      .unique(),
    provider: text('provider').notNull(), // 'saml', 'oidc'
    isEnabled: boolean('is_enabled').default(false).notNull(),
    // SAML settings
    samlEntityId: text('saml_entity_id'),
    samlSsoUrl: text('saml_sso_url'),
    samlCertificate: text('saml_certificate'),
    // OIDC settings
    oidcClientId: text('oidc_client_id'),
    oidcClientSecret: text('oidc_client_secret'),
    oidcIssuer: text('oidc_issuer'),
    oidcAuthUrl: text('oidc_auth_url'),
    oidcTokenUrl: text('oidc_token_url'),
    // Attribute mapping
    attributeMapping: jsonb('attribute_mapping').default({}).notNull(),
    // Auto-provisioning
    autoProvision: boolean('auto_provision').default(true).notNull(),
    defaultRole: text('default_role').default('member').notNull(),
    defaultDepartmentId: uuid('default_department_id').references(() => organizationDepartments.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: uniqueIndex('org_sso_config_org_idx').on(table.organizationId),
  })
);

/**
 * Organization audit logs - track administrative actions
 */
export const organizationAuditLogs = pgTable(
  'organization_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(), // 'member_added', 'member_removed', 'settings_changed', etc.
    targetType: text('target_type'), // 'member', 'department', 'deck', 'settings'
    targetId: text('target_id'),
    details: jsonb('details').default({}).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgTimeIdx: index('org_audit_logs_org_time_idx').on(table.organizationId, table.createdAt),
    actorIdx: index('org_audit_logs_actor_idx').on(table.actorId),
  })
);

/**
 * Organization license history - track license changes
 */
export const organizationLicenseHistory = pgTable(
  'organization_license_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    event: text('event').notNull(), // 'created', 'upgraded', 'downgraded', 'renewed', 'expired'
    previousTier: text('previous_tier'),
    newTier: text('new_tier'),
    previousSeats: integer('previous_seats'),
    newSeats: integer('new_seats'),
    amount: real('amount'),
    invoiceId: text('invoice_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('org_license_history_org_idx').on(table.organizationId),
  })
);

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  departments: many(organizationDepartments),
  invites: many(organizationInvites),
  decks: many(organizationDecks),
  ssoConfig: many(organizationSsoConfigs),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
  department: one(organizationDepartments, {
    fields: [organizationMembers.departmentId],
    references: [organizationDepartments.id],
  }),
}));

export const organizationDepartmentsRelations = relations(
  organizationDepartments,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [organizationDepartments.organizationId],
      references: [organizations.id],
    }),
    parent: one(organizationDepartments, {
      fields: [organizationDepartments.parentId],
      references: [organizationDepartments.id],
    }),
    members: many(organizationMembers),
  })
);

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationInvites.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [organizationInvites.invitedById],
    references: [users.id],
  }),
  department: one(organizationDepartments, {
    fields: [organizationInvites.departmentId],
    references: [organizationDepartments.id],
  }),
}));

export const organizationDecksRelations = relations(organizationDecks, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationDecks.organizationId],
    references: [organizations.id],
  }),
  deck: one(sharedDecks, {
    fields: [organizationDecks.deckId],
    references: [sharedDecks.id],
  }),
  department: one(organizationDepartments, {
    fields: [organizationDecks.departmentId],
    references: [organizationDepartments.id],
  }),
  addedBy: one(users, {
    fields: [organizationDecks.addedById],
    references: [users.id],
  }),
}));

export const organizationSsoConfigsRelations = relations(organizationSsoConfigs, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationSsoConfigs.organizationId],
    references: [organizations.id],
  }),
  defaultDepartment: one(organizationDepartments, {
    fields: [organizationSsoConfigs.defaultDepartmentId],
    references: [organizationDepartments.id],
  }),
}));

export const organizationAuditLogsRelations = relations(organizationAuditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationAuditLogs.organizationId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [organizationAuditLogs.actorId],
    references: [users.id],
  }),
}));
