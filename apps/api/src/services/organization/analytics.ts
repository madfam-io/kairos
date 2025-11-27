/**
 * Organization Analytics Service
 *
 * Learning analytics and progress tracking.
 */

import { and, eq, gte, inArray, sum, count, sql } from 'drizzle-orm';
import {
  db,
  organizationMembers,
  dailyStats,
} from '../../db';
import { type OrgAnalytics } from './types';
import { getOrgDepartments } from './departments';

// =============================================================================
// Get Organization Analytics
// =============================================================================

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

  const departmentBreakdown = Array.from(deptStats.entries()).map(([deptId, deptStat]) => ({
    departmentId: deptId,
    departmentName: deptId ? deptMap.get(deptId) ?? null : null,
    ...deptStat,
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
