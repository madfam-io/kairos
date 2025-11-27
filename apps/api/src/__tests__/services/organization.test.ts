import { describe, it, expect } from 'bun:test';
import {
  canManageMembers,
  canManageDepartments,
  canManageSettings,
  canViewAnalytics,
  canManageDecks,
  type OrgRole,
} from '../../services/organization';

describe('Organization Service', () => {
  describe('Permission Helpers', () => {
    const roles: OrgRole[] = ['owner', 'admin', 'instructor', 'member'];

    describe('canManageMembers', () => {
      it('should allow owner to manage members', () => {
        expect(canManageMembers('owner')).toBe(true);
      });

      it('should allow admin to manage members', () => {
        expect(canManageMembers('admin')).toBe(true);
      });

      it('should not allow instructor to manage members', () => {
        expect(canManageMembers('instructor')).toBe(false);
      });

      it('should not allow member to manage members', () => {
        expect(canManageMembers('member')).toBe(false);
      });
    });

    describe('canManageDepartments', () => {
      it('should allow owner to manage departments', () => {
        expect(canManageDepartments('owner')).toBe(true);
      });

      it('should allow admin to manage departments', () => {
        expect(canManageDepartments('admin')).toBe(true);
      });

      it('should not allow instructor to manage departments', () => {
        expect(canManageDepartments('instructor')).toBe(false);
      });

      it('should not allow member to manage departments', () => {
        expect(canManageDepartments('member')).toBe(false);
      });
    });

    describe('canManageSettings', () => {
      it('should only allow owner to manage settings', () => {
        expect(canManageSettings('owner')).toBe(true);
      });

      it('should not allow admin to manage settings', () => {
        expect(canManageSettings('admin')).toBe(false);
      });

      it('should not allow instructor to manage settings', () => {
        expect(canManageSettings('instructor')).toBe(false);
      });

      it('should not allow member to manage settings', () => {
        expect(canManageSettings('member')).toBe(false);
      });
    });

    describe('canViewAnalytics', () => {
      it('should allow owner to view analytics', () => {
        expect(canViewAnalytics('owner')).toBe(true);
      });

      it('should allow admin to view analytics', () => {
        expect(canViewAnalytics('admin')).toBe(true);
      });

      it('should allow instructor to view analytics', () => {
        expect(canViewAnalytics('instructor')).toBe(true);
      });

      it('should not allow member to view analytics', () => {
        expect(canViewAnalytics('member')).toBe(false);
      });
    });

    describe('canManageDecks', () => {
      it('should allow owner to manage decks', () => {
        expect(canManageDecks('owner')).toBe(true);
      });

      it('should allow admin to manage decks', () => {
        expect(canManageDecks('admin')).toBe(true);
      });

      it('should allow instructor to manage decks', () => {
        expect(canManageDecks('instructor')).toBe(true);
      });

      it('should not allow member to manage decks', () => {
        expect(canManageDecks('member')).toBe(false);
      });
    });

    describe('Role Hierarchy', () => {
      it('owner should have the most permissions', () => {
        expect(canManageMembers('owner')).toBe(true);
        expect(canManageDepartments('owner')).toBe(true);
        expect(canManageSettings('owner')).toBe(true);
        expect(canViewAnalytics('owner')).toBe(true);
        expect(canManageDecks('owner')).toBe(true);
      });

      it('admin should have more permissions than instructor', () => {
        // Admin can manage members, instructor cannot
        expect(canManageMembers('admin')).toBe(true);
        expect(canManageMembers('instructor')).toBe(false);

        // Both can view analytics
        expect(canViewAnalytics('admin')).toBe(true);
        expect(canViewAnalytics('instructor')).toBe(true);
      });

      it('instructor should have more permissions than member', () => {
        // Instructor can view analytics, member cannot
        expect(canViewAnalytics('instructor')).toBe(true);
        expect(canViewAnalytics('member')).toBe(false);

        // Instructor can manage decks, member cannot
        expect(canManageDecks('instructor')).toBe(true);
        expect(canManageDecks('member')).toBe(false);
      });

      it('member should have the least permissions', () => {
        expect(canManageMembers('member')).toBe(false);
        expect(canManageDepartments('member')).toBe(false);
        expect(canManageSettings('member')).toBe(false);
        expect(canViewAnalytics('member')).toBe(false);
        expect(canManageDecks('member')).toBe(false);
      });
    });
  });
});
