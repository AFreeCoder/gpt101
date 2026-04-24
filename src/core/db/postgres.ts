import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { envConfigs } from '@/config';
import { isCloudflareWorker } from '@/shared/lib/env';

// Global database connection instance (singleton pattern)
let dbInstance: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function buildPostgresConnectionOptions(schemaName: string) {
  const trimmedSchemaName = schemaName.trim();

  if (!trimmedSchemaName || trimmedSchemaName === 'public') {
    return {};
  }

  return {
    connection: {
      options: `-c search_path=${trimmedSchemaName}`,
    },
  };
}

export function shouldUsePostgresSingleton({
  isCloudflareWorker,
  dbSingletonEnabled,
}: {
  isCloudflareWorker: boolean;
  dbSingletonEnabled?: string;
}) {
  if (isCloudflareWorker) {
    return false;
  }

  // Reuse by default in warm Node runtimes (including Vercel), while keeping
  // an explicit env escape hatch for incident rollback.
  return dbSingletonEnabled !== 'false';
}

export function getPostgresDb() {
  let databaseUrl = envConfigs.database_url;

  let isHyperdrive = false;
  const schemaName = (envConfigs.db_schema || 'public').trim();
  const connectionOptions = buildPostgresConnectionOptions(schemaName);

  if (isCloudflareWorker) {
    const { env }: { env: any } = { env: {} };
    // Detect if set Hyperdrive
    isHyperdrive = 'HYPERDRIVE' in env;

    if (isHyperdrive) {
      const hyperdrive = env.HYPERDRIVE;
      databaseUrl = hyperdrive.connectionString;
      console.log('using Hyperdrive connection');
    }
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  // In Cloudflare Workers, create new connection each time
  if (isCloudflareWorker) {
    console.log('in Cloudflare Workers environment');
    // Workers environment uses minimal configuration
    const client = postgres(databaseUrl, {
      prepare: false,
      max: 1, // Limit to 1 connection in Workers
      idle_timeout: 10, // Shorter timeout for Workers
      connect_timeout: 5,
      ...connectionOptions,
    });

    return drizzle(client);
  }

  // Singleton mode: reuse existing connection in warm Node runtimes.
  if (
    shouldUsePostgresSingleton({
      isCloudflareWorker,
      dbSingletonEnabled: envConfigs.db_singleton_enabled,
    })
  ) {
    // Return existing instance if already initialized
    if (dbInstance) {
      return dbInstance;
    }

    // Create connection pool only once
    client = postgres(databaseUrl, {
      prepare: false,
      max: Number(envConfigs.db_max_connections) || 1, // Maximum connections in pool (default 1)
      idle_timeout: 30, // Idle connection timeout (seconds)
      connect_timeout: 10, // Connection timeout (seconds)
      ...connectionOptions,
    });

    dbInstance = drizzle({ client });
    return dbInstance;
  }

  // Non-singleton mode: keep an explicit fallback for incident rollback.
  const serverlessClient = postgres(databaseUrl, {
    prepare: false,
    max: 1, // Use single connection in serverless
    idle_timeout: 20,
    connect_timeout: 10,
    ...connectionOptions,
  });

  return drizzle({ client: serverlessClient });
}

// Optional: Function to close database connection (useful for testing or graceful shutdown)
// Note: Only works in singleton mode
export async function closePostgresDb() {
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
  }
}
