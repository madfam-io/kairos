/**
 * Organization Services
 *
 * Barrel export for all organization-related services:
 * - Core organization CRUD
 * - Member management
 * - Department management
 * - Invite management
 * - Deck library
 * - License management
 * - Audit logging
 * - Analytics
 * - Permissions
 */

// Types
export * from './types';

// Core
export {
  createOrganization,
  getOrganization,
  getOrganizationBySlug,
  updateOrganization,
  getUserOrganizations,
} from './core';

// Members
export {
  getOrgMembers,
  addOrgMember,
  removeOrgMember,
  updateMemberRole,
} from './members';

// Departments
export {
  createDepartment,
  getOrgDepartments,
  updateDepartment,
  deleteDepartment,
} from './departments';

// Invites
export {
  createInvite,
  getOrgInvites,
  acceptInvite,
  cancelInvite,
  bulkProvisionUsers,
} from './invites';

// Decks
export {
  addOrgDeck,
  getOrgDecks,
  removeOrgDeck,
} from './decks';

// Licenses
export { updateLicense } from './licenses';

// Audit
export {
  logAuditEvent,
  getAuditLogs,
} from './audit';

// Analytics
export { getOrgAnalytics } from './analytics';

// Permissions
export {
  getUserOrgRole,
  canManageMembers,
  canManageDepartments,
  canManageSettings,
  canViewAnalytics,
  canManageDecks,
} from './permissions';
