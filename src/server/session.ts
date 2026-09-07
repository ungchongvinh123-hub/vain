import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ensurePlayer, loadSnapshot } from '../db/repo';
import { getDb } from '../db/client';
import { players } from '../db/schema';
import { eq } from 'drizzle-orm';

export const SAVE_COOKIE = 'vain_save';
const SAVE_RE = /^[a-z0-9_-]{1,32}$/;

export async function saveKey(): Promise<string> {
  const jar = await cookies();
  const raw = jar.get(SAVE_COOKIE)?.value ?? '';
  return SAVE_RE.test(raw) ? raw : 'local';
}

export async function currentPlayer() {
  const key = await saveKey();
  const p = await ensurePlayer(key);
  return p;
}

export async function currentSnapshot() {
  const p = await currentPlayer();
  return { player: p, snapshot: await loadSnapshot(p.id) };
}

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function handle<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown-error';
    const map: Record<string, number> = {
      INSUFFICIENT_GEM: 402, NO_GOLD: 402, NO_SP: 402, TEAM_FULL: 409, NOT_OWNED: 404, NOT_FOUND: 404,
      GEAR_NOT_FOUND: 404, CHAR_NOT_FOUND: 404, PLAYER: 404, UNKNOWN_STAGE: 400, LOCKED_STAGE: 403,
      MAX_LEVEL: 400, MAX_PLUS: 400, LEVEL_GATE: 400, UNEQUIPPED_CAP: 400, CLASS_LOCKED: 400, PLUS_GATE: 400,
      SOLD_OUT: 409, LOCKED: 409, DUPLICATE_SKILL: 400, UNKNOWN_SKILL: 400, NOT_ACTIVE: 400, BASIC_REQUIRED: 400,
      REQUIRES: 400, BAD_GEAR: 400, UNKNOWN_ITEM: 400, INVALID: 400,
    };
    if (msg === 'DB_UNAVAILABLE') return jsonError(503, msg, { hint: 'Database offline — run `npm run db:up && npm run setup`' });
    return jsonError(map[msg] ?? 500, msg);
  }
}

export const uidBody = z.object({ instanceId: z.number().int().positive() });
export const teamBody = z.object({ instanceId: z.number().int().positive(), mode: z.enum(['add', 'remove', 'move']), toSlot: z.number().int().min(0).max(4).optional() });
export const pullBody = z.object({ kind: z.enum(['single', 'ten']) });
export const loadoutBody = z.object({ instanceId: z.number().int().positive(), loadout: z.array(z.string().nullable()).max(6) });
export const skillBody = z.object({ instanceId: z.number().int().positive(), skillId: z.string().min(3).max(48) });
export const gearBody = z.object({ gearInstanceId: z.number().int().positive(), charInstanceId: z.number().int().positive().nullable() });
export const gearUpBody = z.object({ gearInstanceId: z.number().int().positive() });
export const shopBody = z.object({ itemId: z.string().min(3).max(40) });
export const nameBody = z.object({ name: z.string().min(2).max(18) });
export const battleBody = z.object({
  stageId: z.number().int().min(1).max(10),
  seed: z.number().int().min(0),
  claimedWin: z.boolean(),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
  actions: z.array(z.object({
    uid: z.string().max(8),
    skillId: z.string().max(48).optional(),
    targetUid: z.string().max(8).nullish(),
    mastery: z.number().min(0).max(1).nullish(),
    blockMastery: z.number().min(0).max(1).nullish(),
  })).max(400),
});

/** used by the /api/health route and by UI "db offline" banner */
export async function dbStatus() {
  try {
    const db = getDb();
    const r = await db.select({ v: players.id }).from(players).limit(1);
    return { ok: true, rows: r.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
