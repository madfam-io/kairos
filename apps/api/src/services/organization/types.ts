/**
 * Organization Types
 *
 * Shared types for organization management.
 */

import { randomBytes } from 'crypto';

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// Helpers
// =============================================================================

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

export function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}
