import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Connection pool configuration based on environment
const isProduction = process.env.NODE_ENV === 'production';

// For migrations and one-off queries (single connection)
export const migrationClient = postgres(connectionString, { max: 1 });

// For the application - configure connection pool
const queryClient = postgres(connectionString, {
  // Maximum number of connections in the pool
  // Production: higher limit for concurrent requests
  // Development: lower limit to avoid exhausting local DB
  max: isProduction ? 20 : 5,

  // Minimum number of idle connections
  min: isProduction ? 5 : 1,

  // Maximum time (ms) to wait for a connection from the pool
  connection: {
    application_name: 'kairos-api',
  },

  // Idle timeout (ms) - how long a connection can be idle before being closed
  idle_timeout: 30,

  // Connection timeout (ms) - max time to wait for a connection
  connect_timeout: 10,

  // Statement timeout (ms) - max time a query can run (30 seconds)
  // Prevents long-running queries from blocking the pool
  max_lifetime: 60 * 30, // 30 minutes max connection lifetime

  // Enable prepared statements for better performance
  prepare: true,

  // Transform undefined to null for better PostgreSQL compatibility
  transform: {
    undefined: null,
  },

  // Handle connection errors gracefully
  onnotice: (notice) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('[DB Notice]', notice.message);
    }
  },
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;

// Graceful shutdown helper
export async function closeDatabase(): Promise<void> {
  await queryClient.end();
  await migrationClient.end();
}

// Re-export schema
export * from './schema';
