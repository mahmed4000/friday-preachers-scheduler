import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString =
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.VERCEL_POSTGRES_URL;

    let config: PoolConfig;

    if (connectionString) {
      config = {
        connectionString,
        ssl:
          connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
            ? false
            : { rejectUnauthorized: false },
        max: 5,
        connectionTimeoutMillis: 2500,
        idleTimeoutMillis: 10000,
      };
    } else {
      let host = process.env.SQL_HOST || 'localhost';
      // If host is a unix socket path that does not exist, fallback to localhost
      if (host.startsWith('/') && typeof window === 'undefined') {
        try {
          const fs = require('fs');
          if (!fs.existsSync(host)) {
            host = 'localhost';
          }
        } catch {
          host = 'localhost';
        }
      }

      config = {
        host,
        user: process.env.SQL_USER || 'postgres',
        password: process.env.SQL_PASSWORD || 'postgres',
        database: process.env.SQL_DB_NAME || 'postgres',
        port: Number(process.env.SQL_PORT) || 5432,
        max: 5,
        connectionTimeoutMillis: 2500,
        idleTimeoutMillis: 10000,
      };
    }

    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      console.warn('PostgreSQL idle pool notification:', err?.message || err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
