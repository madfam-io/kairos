/**
 * API Usage Service
 *
 * Logs API requests and provides usage statistics.
 */

import { eq, and, desc, gte, count } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db, apiUsageLogs } from '../../db';

// =============================================================================
// Log API Usage
// =============================================================================

export async function logApiUsage(input: {
  apiKeyId?: string;
  applicationId?: string;
  userId?: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs?: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}): Promise<void> {
  await db.insert(apiUsageLogs).values(input);
}

// =============================================================================
// Get API Usage Stats
// =============================================================================

export async function getApiUsageStats(
  userId: string,
  options?: { apiKeyId?: string; days?: number }
): Promise<{
  totalRequests: number;
  requestsByDay: Array<{ date: string; count: number }>;
  requestsByEndpoint: Array<{ path: string; count: number }>;
  errorRate: number;
}> {
  const since = new Date();
  since.setDate(since.getDate() - (options?.days ?? 30));

  let whereConditions = and(
    eq(apiUsageLogs.userId, userId),
    gte(apiUsageLogs.createdAt, since)
  );

  if (options?.apiKeyId) {
    whereConditions = and(whereConditions, eq(apiUsageLogs.apiKeyId, options.apiKeyId));
  }

  // Total requests
  const [totalResult] = await db
    .select({ count: count() })
    .from(apiUsageLogs)
    .where(whereConditions);

  // Requests by day
  const dailyStats = await db
    .select({
      date: sql<string>`${apiUsageLogs.createdAt}::date`,
      count: count(),
    })
    .from(apiUsageLogs)
    .where(whereConditions)
    .groupBy(sql`${apiUsageLogs.createdAt}::date`)
    .orderBy(sql`${apiUsageLogs.createdAt}::date`);

  // Requests by endpoint
  const endpointStats = await db
    .select({
      path: apiUsageLogs.path,
      count: count(),
    })
    .from(apiUsageLogs)
    .where(whereConditions)
    .groupBy(apiUsageLogs.path)
    .orderBy(desc(count()))
    .limit(10);

  // Error rate
  const [errorResult] = await db
    .select({ count: count() })
    .from(apiUsageLogs)
    .where(and(whereConditions, gte(apiUsageLogs.statusCode, 400)));

  const totalRequests = totalResult?.count ?? 0;
  const errorCount = errorResult?.count ?? 0;

  return {
    totalRequests,
    requestsByDay: dailyStats.map((d) => ({ date: d.date, count: d.count })),
    requestsByEndpoint: endpointStats.map((e) => ({ path: e.path, count: e.count })),
    errorRate: totalRequests > 0 ? Math.round((errorCount / totalRequests) * 10000) / 100 : 0,
  };
}
