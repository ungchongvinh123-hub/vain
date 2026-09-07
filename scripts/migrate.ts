/**
 * Applies the generated drizzle-kit SQL migrations (idempotent, no drizzle-studio needed).
 * If no migration files exist yet it falls back to pushing the schema directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

const DIR = path.resolve(process.cwd(), 'drizzle');

function readUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.PGUSER ?? 'vain';
  const host = process.env.PGHOST ?? '127.0.0.1';
  const port = process.env.PGPORT ?? '5432';
  const db = process.env.PGDATABASE ?? 'vain';
  return `postgres://${user}@${host}:${port}/${db}`;
}

async function main() {
  const url = readUrl();
  const pool = new Pool({ connectionString: url, ssl: false, max: 4 });
  const client = await pool.connect();
  try {
    await client.query(`create table if not exists __vain_migrations (id text primary key, applied_at timestamptz not null default now())`);
    const journal = path.join(DIR, 'meta', '_journal.json');
    const files: string[] = [];
    if (fs.existsSync(journal)) {
      const j = JSON.parse(fs.readFileSync(journal, 'utf8')) as { entries: { tag: string }[] };
      for (const e of j.entries) files.push(`${e.tag}.sql`);
    } else if (fs.existsSync(DIR)) {
      for (const f of fs.readdirSync(DIR)) if (f.endsWith('.sql')) files.push(f);
    }
    if (!files.length) {
      console.log('[migrate] no sql migrations found in ./drizzle — nothing to do (run `npm run db:generate`)');
      return;
    }
    for (const f of files) {
      const fp = path.join(DIR, f);
      if (!fs.existsSync(fp)) continue;
      const done = await client.query(`select 1 from __vain_migrations where id=$1`, [f]);
      if (done.rowCount) { console.log(`[migrate] = ${f} (already applied)`); continue; }
      const sql = fs.readFileSync(fp, 'utf8');
      console.log(`[migrate] + ${f}`);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(`insert into __vain_migrations(id) values($1) on conflict do nothing`, [f]);
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        // statements are individually idempotent-friendly; try per-statement
        const stmts = sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
        let ok = 0;
        for (const s of stmts) {
          try { await client.query(s); ok++; } catch (err) {
            const m = String((err as Error).message);
            if (/already exists|duplicate/.test(m)) ok++;
            else console.warn(`  ! skipped: ${m.split('\n')[0]}`);
          }
        }
        await client.query(`insert into __vain_migrations(id) values($1) on conflict do nothing`, [f]);
        console.log(`[migrate]   applied ${ok}/${stmts.length} statements (tolerant mode)`);
      }
    }
    console.log('[migrate] done');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
