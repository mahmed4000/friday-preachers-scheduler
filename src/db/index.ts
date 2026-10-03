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
        max: 10,
        connectionTimeoutMillis: 10000,
      };
    } else {
      config = {
        host: process.env.SQL_HOST || 'localhost',
        user: process.env.SQL_USER || 'postgres',
        password: process.env.SQL_PASSWORD || 'postgres',
        database: process.env.SQL_DB_NAME || 'postgres',
        port: Number(process.env.SQL_PORT) || 5432,
        max: 10,
        connectionTimeoutMillis: 10000,
      };
    }

    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
