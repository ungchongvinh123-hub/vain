import fs from 'node:fs';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

export const DB_READY_FLAG = process.env.VAIN_DB_FLAG ?? '/tmp/vain-db-ready';

function readUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.VAIN_PG_DIR) {
    const dir = `${process.env.VAIN_PG_DIR}/data/postgresql.conf`;
    try {
      const conf = fs.readFileSync(dir, 'utf8');
      const port = /port\s*=\s*(\d+)/.exec(conf)?.[1] ?? '5432';
      return `postgres://vain@127.0.0.1:${port}/vain`;
    } catch { /* fallthrough */ }
  }
  return 'postgres://vain@127.0.0.1:5432/vain';
}

function poolConfig(): PoolConfig {
  const url = readUrl();
  return {
    connectionString: url,
    max: 12,
    idleTimeoutMillis: 30_000,
    ssl: false,
    application_name: 'vain',
  };
}

type DB = NodePgDatabase<typeof schema>;

const g = globalThis as unknown as { __vainDb?: DB; __vainPool?: Pool };

function dbReady(): boolean {
  if (process.env.VAIN_SKIP_DB_READY === '1') return true;
  try { return fs.existsSync(DB_READY_FLAG); } catch { return true; }
}

export function getDb(): DB {
  if (g.__vainDb) return g.__vainDb;
  if (!dbReady()) {
    throw new Error(
      'Database is not running yet. Start Postgres (`npm run db:up`) or set DATABASE_URL / VAIN_PG_DIR, ' +
      `then run "npm run setup". (marker: ${DB_READY_FLAG})`,
    );
  }
  const pool = new Pool(poolConfig());
  g.__vainPool = pool;
  g.__vainDb = drizzle(pool, { schema });
  return g.__vainDb;
}

export { schema };
export type { DB };
