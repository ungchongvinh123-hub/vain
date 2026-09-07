/** Destructive dev helper: drop the schema, re-apply migrations, re-seed content + demo save. */
import { Pool } from 'pg';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

function url() {
  return process.env.DATABASE_URL ?? `postgres://${process.env.PGUSER ?? 'vain'}@${process.env.PGHOST ?? '127.0.0.1'}:${process.env.PGPORT ?? '5432'}/${process.env.PGDATABASE ?? 'vain'}`;
}

async function main() {
  const pool = new Pool({ connectionString: url(), ssl: false, max: 2 });
  await pool.query('DROP SCHEMA public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await pool.end();
  console.log('[reset] schema recreated');
  const root = resolve(import.meta.dirname, '..');
  for (const step of [['npx', 'tsx', 'scripts/migrate.ts'], ['npx', 'tsx', 'scripts/seed.ts']]) {
    const r = spawnSync(step[0], step.slice(1), { cwd: root, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
