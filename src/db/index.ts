import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { PoolConfig, Pool as PgPool } from 'pg';
const { Pool } = pg;
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _isDbAlive: boolean | undefined;
}

export const isDatabaseConfigured = Boolean(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.VERCEL_POSTGRES_URL
);

export const isDatabaseAvailable = () => {
  return global._isDbAlive ?? false;
};

export const markDatabaseUnavailable = () => {
  global._isDbAlive = false;
};

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
        connectionTimeoutMillis: 1000,
        idleTimeoutMillis: 10000,
      };
      global._isDbAlive = true;
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
        connectionTimeoutMillis: 800,
        idleTimeoutMillis: 10000,
      };
      // Without DATABASE_URL, operate in high-speed in-memory store
      global._isDbAlive = false;
    }

    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      global._isDbAlive = false;
      console.warn('PostgreSQL idle pool notification:', err?.message || err);
    });

    if (connectionString) {
      global._postgresPool.query('SELECT 1')
        .then(() => {
          global._isDbAlive = true;
          console.log('PostgreSQL database connected successfully.');
        })
        .catch((err) => {
          global._isDbAlive = false;
          console.warn('PostgreSQL connection check failed, operating with in-memory store:', err?.message || err);
        });
    } else {
      global._isDbAlive = false;
    }
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
