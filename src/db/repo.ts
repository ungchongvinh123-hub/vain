import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from './client';
import { characters, gachaHistory, gears, players, pulls, stageRuns } from './schema';
import type { EquipSlot, OwnedCharacter, OwnedGear, PlayerSnapshot, SkillRuntime } from '../game/types';
import { defaultLoadout, autoAllocateSp } from '../game/systems/loadout';
import {
  GACHA, GEAR_STEP_PCT, MAX_GEAR_PLUS, MAX_LOADOUT, MAX_TEAM, expToNext, gearUpgradeCost,
} from '../game/data/constants';
import { CHAR_MAP } from '../game/data/characters';
import { GEAR_MAP } from '../game/data/gear';
import { MONSTER_MAP } from '../game/data/monsters';
import { SHOP_MAP, STAGE_MAP } from '../game/data/stages';
import { rollSingle, rollTen } from '../game/systems/gacha';
import { characterCombat, monsterCombat } from '../game/systems/stats';
import { skillTree } from '../game/data/skillFactory';
import {
  actSkill, advanceToNextTurn, currentUnit, foeApply, foeChoose, finishTurn, initBattle, partyPreview,
  partyTurnOpen, rollDice, usableSkills, type BattleState, type CombatantSeed, type RuntimeSkill, type Unit,
} from '../game/engine/battle';

const GEAR_SLOTS: EquipSlot[] = ['weapon', 'armor', 'accessory'];
const skillCacheMap = new Map<string, ReturnType<typeof skillTree>['all']>();

function skillCache(charId: string) {
  let v = skillCacheMap.get(charId);
  if (!v) { v = skillTree(CHAR_MAP[charId]).all; skillCacheMap.set(charId, v); }
  return v;
}

function rngFrom(seed: number) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function stageMultOf(stageId: number): number {
  return 1 + (stageId - 1) * 0.285 + (stageId >= 8 ? (stageId - 7) * 0.14 : 0);
}

/* ------------------------------- load / ensure ------------------------------ */

export async function ensurePlayer(saveKey: string) {
  const db = getDb();
  const existing = await db.select().from(players).where(eq(players.saveKey, saveKey)).limit(1);
  if (existing[0]) return existing[0];
  const name = saveKey === 'local' ? 'Chủ Nhân' : saveKey.slice(0, 12);
  const inserted = await db.insert(players).values({ saveKey, name, team: [] as number[] }).returning();
  await seedStarterRoster(inserted[0].id);
  const [reloaded] = await db.select().from(players).where(eq(players.id, inserted[0].id));
  return reloaded;
}

/** a brand new save gets 5 characters so the first stage is playable immediately */
async function seedStarterRoster(playerId: number) {
  const db = getDb();
  const rnd = rngFrom((playerId * 7919) >>> 0);
  const wantRoles: ('tank' | 'attacker' | 'support')[] = ['tank', 'attacker', 'attacker', 'support', 'support'];
  const pool = Object.values(CHAR_MAP).filter((c) => c.rarity !== 'SSR');
  const used = new Set<string>();
  const ids: number[] = [];
  for (const role of wantRoles) {
    const cand = pool.filter((c) => c.role === role && !used.has(c.id));
    const pick = cand[Math.floor(rnd() * cand.length) % cand.length];
    used.add(pick.id);
    const rows = await db.insert(characters).values({
      playerId, charId: pick.id, level: 1, exp: 0, sp: 4, skillLevels: {}, loadout: defaultLoadout(pick.id),
    }).returning({ instanceId: characters.instanceId });
    ids.push(rows[0].instanceId);
  }
  const gift = ['w_sword_iron', 'ar_cloth_traveler', 'ac_ring_copper'];
  const giftRows = await db.insert(gears).values(gift.map((gearId) => ({ playerId, gearId }))).returning({ instanceId: gears.instanceId });
  await db.update(players).set({ team: ids.slice(0, MAX_TEAM) }).where(eq(players.id, playerId));
  // auto-equip gifts on the two attackers' first slot
  if (giftRows[0]) {
    await db.update(gears).set({ equippedBy: ids[1] }).where(eq(gears.instanceId, giftRows[0].instanceId));
    await db.update(characters).set({ weapon: giftRows[0].instanceId }).where(eq(characters.instanceId, ids[1]));
  }
}

export async function loadSnapshot(playerId: number): Promise<PlayerSnapshot> {
  const db = getDb();
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  if (!p) throw new Error('player not found');
  const charRows = await db.select().from(characters).where(eq(characters.playerId, playerId)).orderBy(desc(characters.instanceId));
  const gearRows = await db.select().from(gears).where(eq(gears.playerId, playerId)).orderBy(desc(gears.instanceId));

  const owned: OwnedCharacter[] = charRows.map((c) => ({
    instanceId: c.instanceId,
    charId: c.charId,
    level: c.level,
    exp: c.exp,
    sp: c.sp,
    skillLevels: (c.skillLevels ?? {}) as Record<string, number>,
    loadout: (c.loadout ?? []) as (string | null)[],
    gear: { weapon: c.weapon, armor: c.armor, accessory: c.accessory },
    createdAt: c.createdAt?.getTime?.() ?? 0,
  }));
  const gear: OwnedGear[] = gearRows.map((g) => ({ instanceId: g.instanceId, gearId: g.gearId, plus: g.plus, equippedBy: g.equippedBy }));
  return {
    id: p.id, name: p.name, gold: p.gold, gem: p.gem, pity: p.pity, pullCount: p.pullCount,
    stageProgress: p.stageProgress, owned, team: ((p.team ?? []) as (number | null)[]).slice(0, MAX_TEAM), gear,
    purchases: (p.purchases ?? {}) as Record<string, number>,
  };
}

/* --------------------------------- gacha ---------------------------------- */

export async function doPull(playerId: number, kind: 'single' | 'ten') {
  const db = getDb();
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  if (!p) throw new Error('player not found');
  const cost = kind === 'ten' ? GACHA.ten : GACHA.single;
  if (p.gem < cost) throw new Error('INSUFFICIENT_GEM');

  const snap = await loadSnapshot(playerId);
  const ownedIds = new Set(snap.owned.map((o) => o.charId));
  const seed = ((Date.now() ^ (playerId * 2654435761)) >>> 0) || 12345;
  const rnd = rngFrom(seed);
  const defs = kind === 'ten' ? rollTen(rnd) : [rollSingle(rnd)];

  const inserted = await db.insert(characters).values(defs.map((d) => ({
    playerId, charId: d.id, level: 1, exp: 0, sp: 1 + Math.floor(rnd() * 3), skillLevels: {}, loadout: defaultLoadout(d.id),
  }))).returning();

  const result = inserted.map((c) => {
    const d = CHAR_MAP[c.charId];
    return {
      instanceId: c.instanceId, charId: c.charId, name: d.name, title: d.title, rarity: d.rarity,
      element: d.element, role: d.role, level: c.level, sp: c.sp, isNew: !ownedIds.has(c.charId),
    };
  });
  await db.insert(gachaHistory).values(result.map((r) => ({ playerId, charId: r.charId, rarity: r.rarity, isNew: r.isNew })));

  const dupes = result.filter((r) => !r.isNew).length;
  const refund = dupes * 40;
  const ssr = result.filter((r) => r.rarity === 'SSR').length;
  const sr = result.filter((r) => r.rarity === 'SR').length;
  await db.update(players).set({
    gem: p.gem - cost + refund,
    pullCount: p.pullCount + result.length,
    pity: ssr > 0 ? 0 : p.pity + result.length,
    sinceSr: sr + ssr > 0 ? 0 : p.sinceSr + result.length,
    updatedAt: new Date(),
  }).where(eq(players.id, playerId));
  await db.insert(pulls).values({ playerId, kind, result, cost });
  return { result, refund, seed, cost };
}

/* --------------------------------- roster ---------------------------------- */

export async function toggleTeam(playerId: number, instanceId: number, mode: 'add' | 'remove' | 'move', toSlot?: number) {
  const db = getDb();
  const snap = await loadSnapshot(playerId);
  const team = [...snap.team] as (number | null)[];
  while (team.length < MAX_TEAM) team.push(null);
  const idx = team.indexOf(instanceId);
  if (mode === 'add') {
    if (idx >= 0) return team;
    if (!snap.owned.some((o) => o.instanceId === instanceId)) throw new Error('NOT_OWNED');
    const free = team.findIndex((x) => x == null);
    if (free < 0) throw new Error('TEAM_FULL');
    team[free] = instanceId;
  } else if (mode === 'remove') {
    if (idx >= 0) team[idx] = null;
    for (let i = 0; i < team.length - 1; i++) {
      if (team[i] == null && team[i + 1] != null) { team[i] = team[i + 1]; team[i + 1] = null; }
    }
  } else {
    if (idx < 0) return team;
    const dst = Math.max(0, Math.min(MAX_TEAM - 1, toSlot ?? idx));
    const [moved] = team.splice(idx, 1);
    team.splice(dst, 0, moved);
  }
  await db.update(players).set({ team, updatedAt: new Date() }).where(eq(players.id, playerId));
  return team;
}

export async function setLoadout(playerId: number, instanceId: number, loadout: (string | null)[]) {
  const db = getDb();
  const [row] = await db.select().from(characters).where(and(eq(characters.playerId, playerId), eq(characters.instanceId, instanceId)));
  if (!row) throw new Error('NOT_FOUND');
  const clean = loadout.slice(0, MAX_LOADOUT);
  const seen = new Set<string>();
  for (const id of clean) {
    if (!id) continue;
    if (seen.has(id)) throw new Error('DUPLICATE_SKILL');
    seen.add(id);
    const s = skillCache(row.charId).find((x) => x.id === id);
    if (!s) throw new Error('UNKNOWN_SKILL');
    if (s.kind !== 'active') throw new Error('NOT_ACTIVE');
  }
  if (!clean.some((x) => x && skillCache(row.charId).find((s) => s.id === x)?.cost === 0)) {
    throw new Error('BASIC_REQUIRED');
  }
  await db.update(characters).set({ loadout: clean }).where(eq(characters.instanceId, instanceId));
  return clean;
}

export async function upgradeSkill(playerId: number, instanceId: number, skillId: string) {
  const db = getDb();
  const [row] = await db.select().from(characters).where(and(eq(characters.playerId, playerId), eq(characters.instanceId, instanceId)));
  if (!row) throw new Error('NOT_FOUND');
  const skill = skillCache(row.charId).find((s) => s.id === skillId);
  if (!skill) throw new Error('UNKNOWN_SKILL');
  const levels = { ...(row.skillLevels as Record<string, number>) };
  const cur = levels[skillId] ?? 0;
  if (cur >= 5) throw new Error('MAX_LEVEL');
  if (skill.kind === 'passive' && row.level < (skill.levelGate ?? 1)) throw new Error('LEVEL_GATE');
  if (skill.requires.length && !skill.requires.every((r) => (levels[r] ?? 0) > 0)) throw new Error('REQUIRES');
  const costSp = cur + 1;
  const costGold = Math.round(180 * Math.pow(cur + 1, 1.75));
  if (row.sp < costSp) throw new Error('NO_SP');
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  if (p.gold < costGold) throw new Error('NO_GOLD');
  await db.update(players).set({ gold: p.gold - costGold }).where(eq(players.id, playerId));
  await db.update(characters).set({ sp: row.sp - costSp, skillLevels: { ...levels, [skillId]: cur + 1 } }).where(eq(characters.instanceId, instanceId));
  return { level: cur + 1, sp: row.sp - costSp, gold: p.gold - costGold };
}

export async function spAuto(playerId: number, instanceId: number) {
  const db = getDb();
  const [row] = await db.select().from(characters).where(and(eq(characters.playerId, playerId), eq(characters.instanceId, instanceId)));
  if (!row) throw new Error('NOT_FOUND');
  const oc: OwnedCharacter = {
    instanceId: row.instanceId, charId: row.charId, level: row.level, exp: row.exp, sp: row.sp,
    skillLevels: (row.skillLevels ?? {}) as Record<string, number>, loadout: (row.loadout ?? []) as (string | null)[],
    gear: { weapon: row.weapon, armor: row.armor, accessory: row.accessory }, createdAt: 0,
  };
  const res = autoAllocateSp(CHAR_MAP[row.charId], oc);
  await db.update(characters).set({ skillLevels: res.levels, sp: res.sp }).where(eq(characters.instanceId, instanceId));
  return { levels: res.levels, sp: res.sp };
}

export async function releaseCharacter(playerId: number, instanceId: number) {
  const db = getDb();
  const [row] = await db.select().from(characters).where(and(eq(characters.playerId, playerId), eq(characters.instanceId, instanceId)));
  if (!row) throw new Error('NOT_FOUND');
  if (row.locked) throw new Error('LOCKED');
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  const team = ((p.team ?? []) as (number | null)[]).map((t) => (t === instanceId ? null : t));
  await db.update(gears).set({ equippedBy: null }).where(eq(gears.equippedBy, instanceId));
  await db.delete(characters).where(and(eq(characters.playerId, playerId), eq(characters.instanceId, instanceId)));
  const back = 120 + row.level * 8;
  await db.update(players).set({ team, gold: p.gold + back }).where(eq(players.id, playerId));
  return { gold: p.gold + back };
}

export async function toggleLockChar(playerId: number, instanceId: number) {
  const db = getDb();
  const [row] = await db.select().from(characters).where(and(eq(characters.playerId, playerId), eq(characters.instanceId, instanceId)));
  if (!row) throw new Error('NOT_FOUND');
  await db.update(characters).set({ locked: !row.locked }).where(eq(characters.instanceId, instanceId));
  return { locked: !row.locked };
}

/* ---------------------------------- gear ---------------------------------- */

export async function equipGear(playerId: number, gearInstanceId: number, charInstanceId: number | null) {
  const db = getDb();
  const [g] = await db.select().from(gears).where(and(eq(gears.playerId, playerId), eq(gears.instanceId, gearInstanceId)));
  if (!g) throw new Error('GEAR_NOT_FOUND');
  const gdef = GEAR_MAP[g.gearId];
  if (!gdef) throw new Error('BAD_GEAR');
  const slot = gdef.slot;

  if (charInstanceId == null) {
    await db.update(gears).set({ equippedBy: null }).where(eq(gears.instanceId, gearInstanceId));
    const rows = await db.select().from(characters).where(and(eq(characters.playerId, playerId), eq(characters[slot], gearInstanceId)));
    for (const r of rows) await db.update(characters).set({ [slot]: null } as never).where(eq(characters.instanceId, r.instanceId));
    return { ok: true as const, slot };
  }

  const [c] = await db.select().from(characters).where(and(eq(characters.playerId, playerId), eq(characters.instanceId, charInstanceId)));
  if (!c) throw new Error('CHAR_NOT_FOUND');
  if (gdef.roles !== 'all' && !gdef.roles.includes(CHAR_MAP[c.charId].role)) throw new Error('CLASS_LOCKED');
  if (g.plus > c.level) throw new Error('PLUS_GATE');
  if (c[slot] && c[slot] !== gearInstanceId) {
    const prev = c[slot]!;
    await db.update(gears).set({ equippedBy: null }).where(eq(gears.instanceId, prev));
    await db.update(characters).set({ [slot]: null } as never).where(eq(characters.instanceId, prev));
  }
  await db.update(gears).set({ equippedBy: charInstanceId }).where(eq(gears.instanceId, gearInstanceId));
  await db.update(characters).set({ [slot]: gearInstanceId } as never).where(eq(characters.instanceId, charInstanceId));
  return { ok: true as const, slot };
}

export async function upgradeGear(playerId: number, gearInstanceId: number) {
  const db = getDb();
  const [g] = await db.select().from(gears).where(and(eq(gears.playerId, playerId), eq(gears.instanceId, gearInstanceId)));
  if (!g) throw new Error('GEAR_NOT_FOUND');
  if (g.plus >= MAX_GEAR_PLUS) throw new Error('MAX_PLUS');
  let cap = 3;
  if (g.equippedBy != null) {
    const [c] = await db.select().from(characters).where(eq(characters.instanceId, g.equippedBy));
    cap = c ? Math.min(MAX_GEAR_PLUS, Math.max(c.level, 1)) : 3;
    if (g.plus >= cap) throw new Error('LEVEL_GATE');
  } else if (g.plus >= 3) throw new Error('UNEQUIPPED_CAP');
  const { gold: cost, ok } = gearUpgradeCost(g.plus, GEAR_MAP[g.gearId].rarity);
  if (!ok) throw new Error('MAX_PLUS');
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  if (p.gold < cost) throw new Error('NO_GOLD');
  await db.update(players).set({ gold: p.gold - cost }).where(eq(players.id, playerId));
  await db.update(gears).set({ plus: g.plus + 1 }).where(eq(gears.instanceId, gearInstanceId));
  return { plus: g.plus + 1, gold: p.gold - cost, stepPct: GEAR_STEP_PCT };
}

/* ---------------------------------- shop ---------------------------------- */

export async function buyShopItem(playerId: number, itemId: string) {
  const db = getDb();
  const item = SHOP_MAP[itemId];
  if (!item) throw new Error('UNKNOWN_ITEM');
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  if (!p) throw new Error('PLAYER');
  const purchases = (p.purchases ?? {}) as Record<string, number>;
  if (item.stock > 0 && (purchases[itemId] ?? 0) >= item.stock) throw new Error('SOLD_OUT');
  if (p.gold < item.gold) throw new Error('NO_GOLD');

  let gearGiven: number[] = [];
  let gems = p.gem;
  let spGrant = 0;
  if (item.kind === 'gear' && item.gearId) {
    const rows = await db.insert(gears).values({ playerId, gearId: item.gearId }).returning({ instanceId: gears.instanceId });
    gearGiven = rows.map((r) => r.instanceId);
  } else if (item.contents) {
    for (const c of item.contents) {
      if (c.type === 'gem') gems += Number(c.value);
      if (c.type === 'sp') spGrant += Number(c.value);
    }
  }
  if (spGrant > 0) {
    const team = (p.team ?? []) as (number | null)[];
    const rows = team.length ? await db.select().from(characters).where(inArray(characters.instanceId, team.filter((x): x is number => x != null))) : [];
    for (const r of rows) await db.update(characters).set({ sp: r.sp + spGrant }).where(eq(characters.instanceId, r.instanceId));
  }
  await db.update(players).set({
    gold: p.gold - item.gold, gem: gems,
    purchases: { ...purchases, [itemId]: (purchases[itemId] ?? 0) + 1 },
  }).where(eq(players.id, playerId));
  return { gold: p.gold - item.gold, gem: gems, gearGiven, spGrant };
}

/* ----------------------------- battle validation --------------------------- */

export interface ClientAction {
  uid: string;
  skillId?: string;
  targetUid?: string | null;
  mastery?: number;
  blockMastery?: number;
}

export interface BattleReport {
  stageId: number;
  seed: number;
  actions: ClientAction[];
  claimedWin: boolean;
  durationMs?: number;
}

export function buildSeeds(snap: PlayerSnapshot, stageId: number) {
  const party: CombatantSeed[] = [];
  snap.team.forEach((instanceId, slot) => {
    if (instanceId == null) return;
    const oc = snap.owned.find((o) => o.instanceId === instanceId);
    const def = oc && CHAR_MAP[oc.charId];
    if (!oc || !def) return;
    const c = characterCombat(oc, snap.gear);
    party.push({
      uid: `p${slot}`, defId: def.id, name: def.name, slot, side: 'party', role: def.role, element: def.element,
      level: oc.level, rarity: def.rarity, stats: c.stats,
      skills: c.actives.map((a) => ({ id: a.def.id, name: a.def.name, level: a.level })), mods: c.mods,
    });
  });
  const stage = STAGE_MAP[stageId];
  const foes: CombatantSeed[] = stage.waves[0].monsters.map((m, i) => {
    const md = MONSTER_MAP[m.id];
    const c = monsterCombat(md, m.level, stageMultOf(stageId));
    return {
      uid: `f${i}`, defId: md.id, name: md.name, slot: i, side: 'foe' as const, role: md.role, element: md.element,
      level: m.level, stats: c.stats, skills: c.actives.map((a) => ({ id: a.def.id, name: a.def.name, level: 1 })),
      mods: {}, boss: !!stage.boss && i === 0,
    };
  });
  return { party, foes, stage };
}

function runtimeFor(snap: PlayerSnapshot, unit: Unit): RuntimeSkill[] {
  if (unit.side === 'party') {
    const instanceId = snap.team[unit.slot];
    const oc = snap.owned.find((o) => o.instanceId === instanceId);
    if (!oc) return [];
    return characterCombat(oc, snap.gear).actives.map(toRuntime) as unknown as RuntimeSkill[];
  }
  const md = MONSTER_MAP[unit.defId];
  return monsterCombat(md, unit.level, 1).actives.map(toRuntime) as unknown as RuntimeSkill[];
}

function toRuntime(a: SkillRuntime) {
  return {
    id: a.def.id, name: a.def.name, level: a.level, cost: a.def.cost, target: a.def.target,
    element: a.def.element, effects: a.effects, qte: a.def.qte, qteStrictness: a.def.qteStrictness, hits: a.def.hits,
  };
}

/**
 * Server-authoritative settlement: replay the client's action log with the same seed,
 * ignore whatever the client claims, and pay out exactly what the replay produced.
 */
export async function completeStage(playerId: number, report: BattleReport) {
  const db = getDb();
  const snap = await loadSnapshot(playerId);
  const stage = STAGE_MAP[report.stageId];
  if (!stage) throw new Error('UNKNOWN_STAGE');
  if (report.stageId > snap.stageProgress) throw new Error('LOCKED_STAGE');

  const { party, foes } = buildSeeds(snap, report.stageId);
  const skillsByUid = new Map<string, RuntimeSkill[]>();
  const st: BattleState = initBattle(
    { stageId: stage.id, seed: report.seed >>> 0, maxRounds: 30, party, foes },
    (u) => {
      let v = skillsByUid.get(u.uid);
      if (!v) { v = runtimeFor(snap, u); skillsByUid.set(u.uid, v); }
      return v;
    },
  );

  const run = (u: Unit, skillId: string | undefined, targetUid: string | null, mastery: number | undefined) => {
    if (partyTurnOpen(st) === 'skipped') return;
    rollDice(st, u);
    const list = usableSkills(st, u);
    const sk = list.find((s) => (s as unknown as { id: string }).id === skillId) ?? list[0];
    if (!sk) { finishTurn(st); return; }
    const it = partyPreview(st, u, sk, targetUid);
    actSkill(st, u, sk, it.targets[0] ?? null, clamp01(mastery));
    finishTurn(st);
  };

  const drainFoes = (blockMastery: number | undefined) => {
    let g = 0;
    while (!st.result && st.phase === 'foe' && g++ < 40) {
      const u = currentUnit(st);
      if (!u) break;
      if (partyTurnOpen(st) === 'skipped') continue;
      const it = foeChoose(st, u);
      if (it) foeApply(st, u, it, clamp01(blockMastery));
      finishTurn(st); // foeApply does not end the turn; advanceToNextTurn alone would re-enter the same unit
    }
  };

  for (const a of report.actions.slice(0, 400)) {
    if (st.result) break;
    drainFoes(a.blockMastery);
    const u = currentUnit(st);
    if (!u || u.side !== 'party') break;
    if (u.uid !== a.uid) { run(u, undefined, null, 0.7); continue; }
    run(u, a.skillId, a.targetUid ?? null, a.mastery);
  }
  drainFoes(0);

  const win = st.result === 'win';
  const firstClear = win && stage.id === snap.stageProgress && snap.stageProgress < 10;
  const rewards = win
    ? { gold: stage.reward.gold + (firstClear ? stage.reward.firstClearGold : 0), gem: stage.reward.gem + (firstClear ? 80 : 0), exp: stage.reward.exp }
    : { gold: Math.round(stage.reward.gold * 0.12), gem: 0, exp: Math.round(stage.reward.exp * 0.2) };

  const expByUid: Record<string, number> = {};
  const spByUid: Record<string, number> = {};
  const living = st.units.filter((u) => u.side === 'party' && u.alive).length || 1;
  for (const u of st.units.filter((x) => x.side === 'party')) {
    expByUid[u.uid] = Math.round((rewards.exp / living) * (u.alive ? 1 : 0.6));
    spByUid[u.uid] = win ? Math.max(1, Math.round(1 + u.level * 0.08 + stage.difficulty * 0.5)) : 0;
  }

  for (const u of st.units.filter((x) => x.side === 'party')) {
    const instanceId = snap.team[u.slot];
    if (instanceId == null) continue;
    const oc = snap.owned.find((o) => o.instanceId === instanceId);
    if (!oc) continue;
    let level = oc.level, exp = oc.exp + (expByUid[u.uid] ?? 0), sp = oc.sp + (spByUid[u.uid] ?? 0);
    while (level < 50 && exp >= expToNext(level)) { exp -= expToNext(level); level++; sp += 2 + (level % 5 === 0 ? 3 : 0); }
    if (level >= 50) exp = 0;
    if (level !== oc.level || exp !== oc.exp || sp !== oc.sp) {
      await db.update(characters).set({ level, exp, sp }).where(eq(characters.instanceId, instanceId));
    }
  }

  const dropIds: number[] = [];
  if (win) {
    const rnd = rngFrom((report.seed ^ 0x9e3779b1) >>> 0);
    if (rnd() < stage.drop.chance) {
      const total = stage.drop.table.reduce((a, b) => a + b.weight, 0);
      let r = rnd() * total;
      let chosen = stage.drop.table[0].gearId;
      for (const t of stage.drop.table) { r -= t.weight; if (r <= 0) { chosen = t.gearId; break; } }
      const row = await db.insert(gears).values({ playerId, gearId: chosen }).returning({ instanceId: gears.instanceId });
      dropIds.push(row[0].instanceId);
    }
    if (stage.boss && firstClear) {
      const row = await db.insert(gears).values({ playerId, gearId: 'ar_plate_maiden' }).returning({ instanceId: gears.instanceId });
      dropIds.push(row[0].instanceId);
    }
  }

  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  await db.update(players).set({
    gold: p.gold + rewards.gold,
    gem: p.gem + rewards.gem,
    stageProgress: firstClear ? snap.stageProgress + 1 : snap.stageProgress,
    bestRound: Math.max(p.bestRound, st.round),
    updatedAt: new Date(),
  }).where(eq(players.id, playerId));

  const totalDamage = st.units.filter((u) => u.side === 'party').reduce((a, b) => a + b.dealtDamage, 0);
  const kills = st.events.filter((e) => e.e === 'death' && e.uid.startsWith('f')).length;
  await db.insert(stageRuns).values({
    playerId, stageId: stage.id, win, rounds: st.round, totalDamage, kills, firstClear,
    gold: rewards.gold, gem: rewards.gem, exp: expByUid, sp: spByUid, drops: dropIds,
    seed: report.seed >>> 0, durationMs: report.durationMs ?? 0,
  });

  return {
    verdict: win ? ('win' as const) : ('lose' as const),
    claimedWin: report.claimedWin,
    tampered: win !== report.claimedWin,
    rounds: st.round, totalDamage, drops: dropIds, rewards,
    progress: firstClear ? snap.stageProgress + 1 : snap.stageProgress,
    exp: expByUid, sp: spByUid,
  };
}

function clamp01(v: number | undefined): number {
  if (v == null || Number.isNaN(v)) return 0.7;
  return Math.max(0, Math.min(1, v));
}

export { GEAR_SLOTS, MAX_LOADOUT };

/* --------------------------------- meta ---------------------------------- */

export async function setSaveName(playerId: number, name: string) {
  const db = getDb();
  await db.update(players).set({ name, updatedAt: new Date() }).where(eq(players.id, playerId));
  return { name };
}

export async function setSettings(playerId: number, settings: Record<string, unknown>) {
  const db = getDb();
  await db.update(players).set({ settings: settings as never }).where(eq(players.id, playerId));
  return settings;
}

export async function wipeSave(playerId: number) {
  const db = getDb();
  await db.delete(characters).where(eq(characters.playerId, playerId));
  await db.delete(gears).where(eq(gears.playerId, playerId));
  await db.delete(pulls).where(eq(pulls.playerId, playerId));
  await db.delete(gachaHistory).where(eq(gachaHistory.playerId, playerId));
  await db.delete(stageRuns).where(eq(stageRuns.playerId, playerId));
  const [p] = await db.update(players).set({
    gold: 1500, gem: 1000, pity: 0, pullCount: 0, sinceSr: 0, stageProgress: 1, bestRound: 0,
    team: [] as number[], purchases: {}, updatedAt: new Date(),
  }).where(eq(players.id, playerId)).returning();
  await seedStarterRoster(playerId);
  const [after] = await db.select().from(players).where(eq(players.id, playerId));
  void p;
  return { ok: true, saveKey: after.saveKey };
}

export async function addCheat(playerId: number, gold: number, gem: number) {
  const db = getDb();
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  await db.update(players).set({ gold: p.gold + gold, gem: p.gem + gem }).where(eq(players.id, playerId));
  return { gold: p.gold + gold, gem: p.gem + gem };
}

export async function grantCharacter(playerId: number, charId: string) {
  const db = getDb();
  if (!CHAR_MAP[charId]) throw new Error('UNKNOWN_CHAR');
  const rows = await db.insert(characters).values({
    playerId, charId, level: 1, exp: 0, sp: 2, skillLevels: {}, loadout: defaultLoadout(charId),
  }).returning({ instanceId: characters.instanceId });
  return rows[0];
}
