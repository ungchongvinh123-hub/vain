/**
 * VAIN offline data layer (APK / PWA-without-server mode).
 *
 * Implements the exact same HTTP contract as the Next API routes —
 * `{ ok, data } | { ok:false, error }` — but against IndexedDB and the pure
 * game systems. The APK build (NEXT_PUBLIC_OFFLINE=1) routes every fetch here;
 * the web build falls here automatically when the server is unreachable,
 * so progress is never lost to a dead connection.
 */
import type { EquipSlot, OwnedCharacter, OwnedGear, PlayerSnapshot, SkillRuntime } from '../types';
import { CHAR_MAP } from '../data/characters';
import { GEAR_MAP } from '../data/gear';
import { MONSTER_MAP } from '../data/monsters';
import { SHOP_MAP, STAGES, STAGE_MAP } from '../data/stages';
import {
  GACHA, GEAR_STEP_PCT, MAX_GEAR_PLUS, MAX_LOADOUT, MAX_TEAM, expToNext, gearUpgradeCost,
} from '../data/constants';
import { rollSingle, rollTen, ownedFromPull } from '../systems/gacha';
import { characterCombat, monsterCombat } from '../systems/stats';
import { autoAllocateSp, defaultLoadout } from '../systems/loadout';
import { skillTree } from '../data/skillFactory';
import {
  actSkill, currentUnit, finishTurn, foeApply, foeChoose, initBattle, partyPreview, partyTurnOpen,
  rollDice, usableSkills, type BattleState, type CombatantSeed, type RuntimeSkill, type Unit,
} from '../engine/battle';
import type { BattleConfigView } from '@/components/battle/types';

/* --------------------------------- storage -------------------------------- */

const DB_NAME = 'vain-offline';
const STORE = 'saves';

interface OffChar extends OwnedCharacter { locked?: boolean }
interface OffSave {
  saveKey: string;
  name: string;
  gold: number;
  gem: number;
  pity: number;
  sinceSr: number;
  pullCount: number;
  stageProgress: number;
  bestRound: number;
  purchases: Record<string, number>;
  team: (number | null)[];
  owned: OffChar[];
  gears: OwnedGear[];
  updatedAt: number;
}

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function readSave(key: string): Promise<OffSave | null> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    tx.onsuccess = () => resolve((tx.result as OffSave) ?? null);
    tx.onerror = () => reject(tx.error);
  });
}

async function writeSave(s: OffSave): Promise<void> {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(s, s.saveKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const SAVE_COOKIE_KEY = 'vain_save_key';
function currentKey(): string {
  if (typeof window === 'undefined') return 'local';
  try { return localStorage.getItem(SAVE_COOKIE_KEY) || 'local'; } catch { return 'local'; }
}
function setCurrentKey(k: string) {
  try { localStorage.setItem(SAVE_COOKIE_KEY, /^[a-z0-9_-]{1,32}$/.test(k) ? k : 'local'); } catch { /* ignore */ }
}

/* ------------------------------- save creation ----------------------------- */

function makeStarter(saveKey: string): OffSave {
  const save: OffSave = {
    saveKey, name: saveKey === 'local' ? 'Chủ Nhân' : saveKey.slice(0, 12),
    gold: 1500, gem: 1000, pity: 0, sinceSr: 0, pullCount: 0, stageProgress: 1, bestRound: 0,
    purchases: {}, team: [], owned: [], gears: [], updatedAt: Date.now(),
  };
  const rnd = localRng(hashStr(saveKey) ^ 0x51ed2701);
  const wantRoles: ('tank' | 'attacker' | 'support')[] = ['tank', 'attacker', 'attacker', 'support', 'support'];
  const pool = Object.values(CHAR_MAP).filter((c) => c.rarity !== 'SSR');
  const used = new Set<string>();
  let nextId = 1;
  for (const role of wantRoles) {
    const cand = pool.filter((c) => c.role === role && !used.has(c.id));
    const pick = cand[Math.floor(rnd() * cand.length) % cand.length];
    used.add(pick.id);
    save.owned.push({
      instanceId: nextId++, charId: pick.id, level: 1, exp: 0, sp: 4, skillLevels: {},
      loadout: defaultLoadout(pick.id), gear: { weapon: null, armor: null, accessory: null }, createdAt: Date.now(),
    });
  }
  let gid = 900;
  const gift = ['w_sword_iron', 'ar_cloth_traveler', 'ac_ring_copper'];
  gift.forEach((gearId, i) => {
    save.gears.push({ instanceId: gid + i, gearId, plus: 0, equippedBy: i === 0 ? 2 : null });
    if (i === 0) save.owned[1].gear.weapon = gid + i;
  });
  gid += gift.length;
  save.team = save.owned.map((o) => o.instanceId);
  return save;
}

function localRng(seed: number) {
  let x = (seed >>> 0) || 0x9e3779b9;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function snapshot(s: OffSave): PlayerSnapshot {
  return {
    id: 1, name: s.name, gold: s.gold, gem: s.gem, pity: s.pity, pullCount: s.pullCount,
    stageProgress: s.stageProgress,
    owned: s.owned.map(({ locked: _l, ...o }) => o), team: [...s.team], gear: s.gears, purchases: s.purchases,
  };
}

async function load(): Promise<OffSave> {
  const key = currentKey();
  const found = await readSave(key);
  if (found) return found;
  const fresh = makeStarter(key);
  await writeSave(fresh);
  return fresh;
}

/* -------------------------------- business -------------------------------- */

const ERRORS = new Set(['INSUFFICIENT_GEM', 'TEAM_FULL', 'NOT_OWNED', 'LOCKED_STAGE', 'UNKNOWN_STAGE', 'MAX_PLUS',
  'LEVEL_GATE', 'UNEQUIPPED_CAP', 'NO_GOLD', 'NO_SP', 'REQUIRES', 'DUPLICATE_SKILL', 'NOT_ACTIVE', 'UNKNOWN_SKILL',
  'BASIC_REQUIRED', 'LOCKED', 'SOLD_OUT', 'NOT_FOUND', 'GEAR_NOT_FOUND', 'CHAR_NOT_FOUND', 'BAD_GEAR', 'MAX_LEVEL_REACHED', 'MAX_LEVEL']);

function err(e: unknown): { ok: false; status: number; data: { error: string } } {
  const msg = e instanceof Error ? e.message : String(e);
  if (ERRORS.has(msg)) {
    const status = msg === 'INSUFFICIENT_GEM' || msg === 'NO_GOLD' || msg === 'NO_SP' ? 400
      : msg === 'LOCKED' || msg === 'SOLD_OUT' || msg === 'UNKNOWN_STAGE' || msg === 'LOCKED_STAGE' ? 403 : 400;
    return { ok: false, status, data: { error: msg } };
  }
  return { ok: false, status: 500, data: { error: msg } };
}

function nextCharId(s: OffSave) { return s.owned.reduce((a, o) => Math.max(a, o.instanceId), 0) + 1; }
function nextGearId(s: OffSave) { return s.gears.reduce((a, o) => Math.max(a, o.instanceId), 900) + 1; }

function doPull(s: OffSave, kind: 'single' | 'ten') {
  const cost = kind === 'ten' ? GACHA.ten : GACHA.single;
  if (s.gem < cost) throw new Error('INSUFFICIENT_GEM');
  const ownedIds = new Set(s.owned.map((o) => o.charId));
  const seed = ((Date.now() ^ hashStr(s.saveKey)) >>> 0) || 12345;
  const rnd = localRng(seed);
  const defs = kind === 'ten' ? rollTen(rnd) : [rollSingle(rnd)];
  let id = nextCharId(s);
  const created: OwnedCharacter[] = [];
  for (const d of defs) {
    const oc = ownedFromPull(d, id, rnd);
    id++;
    created.push(oc);
    s.owned.push({ ...oc });
  }
  const result = created.map((c) => {
    const d = CHAR_MAP[c.charId];
    return {
      instanceId: c.instanceId, charId: c.charId, name: d.name, title: d.title, rarity: d.rarity,
      element: d.element, role: d.role, level: c.level, sp: c.sp, isNew: !ownedIds.has(c.charId),
    };
  });
  const dupes = result.filter((r) => !r.isNew).length;
  const refund = dupes * 40;
  const ssr = result.filter((r) => r.rarity === 'SSR').length;
  const sr = result.filter((r) => r.rarity === 'SR').length;
  s.gem = s.gem - cost + refund;
  s.pullCount += result.length;
  s.pity = ssr > 0 ? 0 : s.pity + result.length;
  s.sinceSr = sr + ssr > 0 ? 0 : s.sinceSr + result.length;
  return { result, refund, seed, cost };
}

function toggleTeam(s: OffSave, instanceId: number, mode: 'add' | 'remove' | 'move', toSlot?: number) {
  const team = [...s.team] as (number | null)[];
  while (team.length < MAX_TEAM) team.push(null);
  const idx = team.indexOf(instanceId);
  if (mode === 'add') {
    if (idx >= 0) return team;
    if (!s.owned.some((o) => o.instanceId === instanceId)) throw new Error('NOT_OWNED');
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
  s.team = team;
  return team;
}

function setLoadout(s: OffSave, instanceId: number, loadout: (string | null)[]) {
  const oc = s.owned.find((o) => o.instanceId === instanceId);
  if (!oc) throw new Error('NOT_FOUND');
  const tree = skillTree(CHAR_MAP[oc.charId]).all;
  const clean = loadout.slice(0, MAX_LOADOUT);
  const seen = new Set<string>();
  for (const id of clean) {
    if (!id) continue;
    if (seen.has(id)) throw new Error('DUPLICATE_SKILL');
    seen.add(id);
    const sk = tree.find((x) => x.id === id);
    if (!sk) throw new Error('UNKNOWN_SKILL');
    if (sk.kind !== 'active') throw new Error('NOT_ACTIVE');
  }
  if (!clean.some((x) => x && tree.find((sk) => sk.id === x)?.cost === 0)) throw new Error('BASIC_REQUIRED');
  oc.loadout = clean;
  return clean;
}

function upgradeSkill(s: OffSave, instanceId: number, skillId: string) {
  const oc = s.owned.find((o) => o.instanceId === instanceId);
  if (!oc) throw new Error('NOT_FOUND');
  const skill = skillTree(CHAR_MAP[oc.charId]).all.find((x) => x.id === skillId);
  if (!skill) throw new Error('UNKNOWN_SKILL');
  const levels = { ...oc.skillLevels };
  const cur = levels[skillId] ?? 0;
  if (cur >= 5) throw new Error('MAX_LEVEL_REACHED');
  const gate = (skill as unknown as { levelGate?: number }).levelGate ?? 1;
  if (skill.kind === 'passive' && oc.level < gate) throw new Error('LEVEL_GATE');
  if (skill.requires.length && !skill.requires.every((r) => (levels[r] ?? 0) > 0)) throw new Error('REQUIRES');
  const costSp = cur + 1;
  const costGold = Math.round(180 * Math.pow(cur + 1, 1.75));
  if (oc.sp < costSp) throw new Error('NO_SP');
  if (s.gold < costGold) throw new Error('NO_GOLD');
  s.gold -= costGold;
  oc.sp -= costSp;
  levels[skillId] = cur + 1;
  oc.skillLevels = levels;
  return { level: cur + 1, sp: oc.sp, gold: s.gold };
}

function equipGear(s: OffSave, gearInstanceId: number, charInstanceId: number | null) {
  const g = s.gears.find((x) => x.instanceId === gearInstanceId);
  if (!g) throw new Error('GEAR_NOT_FOUND');
  const gdef = GEAR_MAP[g.gearId];
  if (!gdef) throw new Error('BAD_GEAR');
  const slot = gdef.slot as EquipSlot;
  if (charInstanceId == null) {
    g.equippedBy = null;
    for (const oc of s.owned) if (oc.gear[slot] === gearInstanceId) oc.gear[slot] = null;
    return { ok: true as const, slot };
  }
  const c = s.owned.find((o) => o.instanceId === charInstanceId);
  if (!c) throw new Error('CHAR_NOT_FOUND');
  if (gdef.roles !== 'all' && !gdef.roles.includes(CHAR_MAP[c.charId].role)) throw new Error('CLASS_LOCKED');
  if (g.plus > c.level) throw new Error('PLUS_GATE');
  if (c.gear[slot] && c.gear[slot] !== gearInstanceId) {
    const prev = c.gear[slot]!;
    const prevG = s.gears.find((x) => x.instanceId === prev);
    if (prevG) prevG.equippedBy = null;
    for (const oc of s.owned) if (oc.gear[slot] === prev) oc.gear[slot] = null;
  }
  g.equippedBy = charInstanceId;
  c.gear[slot] = gearInstanceId;
  return { ok: true as const, slot };
}

function upgradeGear(s: OffSave, gearInstanceId: number) {
  const g = s.gears.find((x) => x.instanceId === gearInstanceId);
  if (!g) throw new Error('GEAR_NOT_FOUND');
  if (g.plus >= MAX_GEAR_PLUS) throw new Error('MAX_PLUS');
  let cap = 3;
  if (g.equippedBy != null) {
    const c = s.owned.find((o) => o.instanceId === g.equippedBy);
    cap = c ? Math.min(MAX_GEAR_PLUS, Math.max(c.level, 1)) : 3;
    if (g.plus >= cap) throw new Error('LEVEL_GATE');
  } else if (g.plus >= 3) throw new Error('UNEQUIPPED_CAP');
  const { gold: cost, ok } = gearUpgradeCost(g.plus, GEAR_MAP[g.gearId].rarity);
  if (!ok) throw new Error('MAX_PLUS');
  if (s.gold < cost) throw new Error('NO_GOLD');
  s.gold -= cost;
  g.plus += 1;
  return { plus: g.plus, gold: s.gold, stepPct: GEAR_STEP_PCT };
}

function buyShopItem(s: OffSave, itemId: string) {
  const item = SHOP_MAP[itemId];
  if (!item) throw new Error('UNKNOWN_ITEM');
  const purchases = s.purchases;
  if (item.stock > 0 && (purchases[itemId] ?? 0) >= item.stock) throw new Error('SOLD_OUT');
  if (s.gold < item.gold) throw new Error('NO_GOLD');
  const gearGiven: number[] = [];
  let spGrant = 0;
  if (item.kind === 'gear' && item.gearId) {
    const id = nextGearId(s);
    s.gears.push({ instanceId: id, gearId: item.gearId, plus: 0, equippedBy: null });
    gearGiven.push(id);
  } else if (item.contents) {
    for (const c of item.contents) {
      if (c.type === 'gem') s.gem += Number(c.value);
      if (c.type === 'sp') spGrant += Number(c.value);
    }
  }
  if (spGrant > 0) {
    for (const id of s.team) {
      const oc = s.owned.find((o) => o.instanceId === id);
      if (oc) oc.sp += spGrant;
    }
  }
  s.gold -= item.gold;
  s.purchases = { ...purchases, [itemId]: (purchases[itemId] ?? 0) + 1 };
  return { gold: s.gold, gem: s.gem, gearGiven, spGrant };
}

/* ----------------------------- battle (server-less) ---------------------------- */

function toRuntime(a: SkillRuntime) {
  return {
    id: a.def.id, name: a.def.name, element: a.def.element, cost: a.def.cost, target: a.def.target,
    effects: a.effects, hits: a.def.hits, qte: a.def.qte, qteStrictness: a.def.qteStrictness,
    level: a.level, powerMult: a.def.powerMult, kind: a.def.kind, charId: a.def.charId, desc: a.def.desc,
    tags: a.def.tags, tier: a.def.tier, node: a.def.node, requires: a.def.requires, maxLevel: a.def.maxLevel, icon: a.def.icon,
  } as unknown as RuntimeSkill;
}

function buildSeeds(s: OffSave, stageId: number) {
  const party: CombatantSeed[] = [];
  s.team.forEach((instanceId, slot) => {
    if (instanceId == null) return;
    const oc = s.owned.find((o) => o.instanceId === instanceId);
    const def = oc && CHAR_MAP[oc.charId];
    if (!oc || !def) return;
    const c = characterCombat(oc, s.gears);
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

export function stageMultOf(stageId: number): number {
  return 1 + (stageId - 1) * 0.285 + (stageId >= 8 ? (stageId - 7) * 0.14 : 0);
}

function runtimeFor(s: OffSave, unit: Unit): RuntimeSkill[] {
  if (unit.side === 'party') {
    const instanceId = s.team[unit.slot];
    const oc = s.owned.find((o) => o.instanceId === instanceId);
    if (!oc) return [];
    return characterCombat(oc, s.gears).actives.map(toRuntime);
  }
  const md = MONSTER_MAP[unit.defId];
  return monsterCombat(md, unit.level, 1).actives.map(toRuntime);
}

function clamp01(v: number | undefined): number {
  if (v == null || Number.isNaN(v)) return 0.7;
  return Math.max(0, Math.min(1, v));
}

function completeStage(s: OffSave, report: { stageId: number; seed: number; claimedWin: boolean; actions: { uid: string; skillId?: string; targetUid?: string | null; mastery?: number; blockMastery?: number }[]; durationMs?: number }) {
  const stage = STAGE_MAP[report.stageId];
  if (!stage) throw new Error('UNKNOWN_STAGE');
  if (report.stageId > s.stageProgress) throw new Error('LOCKED_STAGE');

  const { party, foes } = buildSeeds(s, report.stageId);
  const skillsByUid = new Map<string, RuntimeSkill[]>();
  const st: BattleState = initBattle(
    { stageId: stage.id, seed: report.seed >>> 0, maxRounds: 30, party, foes },
    (u) => {
      let v = skillsByUid.get(u.uid);
      if (!v) { v = runtimeFor(s, u); skillsByUid.set(u.uid, v); }
      return v;
    },
  );

  const run = (u: Unit, skillId: string | undefined, targetUid: string | null, mastery: number | undefined) => {
    if (partyTurnOpen(st) === 'skipped') return;
    rollDice(st, u);
    const list = usableSkills(st, u);
    const sk = list.find((x) => (x as unknown as { id: string }).id === skillId) ?? list[0];
    if (!sk) { finishTurn(st); return; }
    const it = partyPreview(st, u, sk, targetUid);
    actSkill(st, u, sk, it.targets[0] ?? null, clamp01(mastery));
    finishTurn(st);
  };
  const drainFoes = (blockMastery: number | undefined) => {
    let g = 0;
    while (!st.result && st.phase === 'foe' && g++ < 60) {
      const u = currentUnit(st);
      if (!u) break;
      if (partyTurnOpen(st) === 'skipped') continue;
      const it = foeChoose(st, u);
      if (it) foeApply(st, u, it, clamp01(blockMastery));
      finishTurn(st);
    }
  };

  for (const a of (report.actions ?? []).slice(0, 400)) {
    if (st.result) break;
    drainFoes(a.blockMastery);
    const u = currentUnit(st);
    if (!u || u.side !== 'party') break;
    if (u.uid !== a.uid) { run(u, undefined, null, 0.7); continue; }
    run(u, a.skillId, a.targetUid ?? null, a.mastery);
  }
  drainFoes(0);

  const win = st.result === 'win';
  const firstClear = win && stage.id === s.stageProgress && s.stageProgress < 10;
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
    const instanceId = s.team[u.slot];
    if (instanceId == null) continue;
    const oc = s.owned.find((o) => o.instanceId === instanceId);
    if (!oc) continue;
    let level = oc.level, exp = oc.exp + (expByUid[u.uid] ?? 0), sp = oc.sp + (spByUid[u.uid] ?? 0);
    while (level < 50 && exp >= expToNext(level)) { exp -= expToNext(level); level++; sp += 2 + (level % 5 === 0 ? 3 : 0); }
    if (level >= 50) exp = 0;
    oc.level = level; oc.exp = exp; oc.sp = sp;
  }

  const dropIds: number[] = [];
  if (win) {
    const rnd = localRng((report.seed ^ 0x9e3779b1) >>> 0);
    if (rnd() < stage.drop.chance) {
      const total = stage.drop.table.reduce((a, b) => a + b.weight, 0);
      let r = rnd() * total;
      let chosen = stage.drop.table[0].gearId;
      for (const t of stage.drop.table) { r -= t.weight; if (r <= 0) { chosen = t.gearId; break; } }
      const id = nextGearId(s);
      s.gears.push({ instanceId: id, gearId: chosen, plus: 0, equippedBy: null });
      dropIds.push(id);
    }
    if (stage.boss && firstClear) {
      const id = nextGearId(s) + 1;
      s.gears.push({ instanceId: id, gearId: 'ar_plate_maiden', plus: 0, equippedBy: null });
      dropIds.push(id);
    }
  }
  s.gold += rewards.gold;
  s.gem += rewards.gem;
  if (firstClear) s.stageProgress += 1;
  s.bestRound = Math.max(s.bestRound, st.round);

  const totalDamage = st.units.filter((u) => u.side === 'party').reduce((a, b) => a + b.dealtDamage, 0);
  return {
    verdict: win ? ('win' as const) : ('lose' as const),
    claimedWin: report.claimedWin,
    tampered: win !== report.claimedWin,
    rounds: st.round, totalDamage, drops: dropIds, rewards,
    progress: s.stageProgress,
    exp: expByUid, sp: spByUid,
  };
}

function battleConfig(s: OffSave, stageId: number): BattleConfigView {
  const { party, foes, stage } = buildSeeds(s, stageId);
  const units = party.map((p) => {
    const oc = s.owned.find((o) => o.instanceId === s.team[p.slot])!;
    const c = characterCombat(oc, s.gears);
    const def = CHAR_MAP[p.defId];
    return {
      ...p,
      title: def.title,
      rarity: def.rarity,
      sprite: def.id,
      visual: { roleLabel: def.role === 'tank' ? 'Đỡ Đòn' : def.role === 'attacker' ? 'Tấn Công' : 'Hỗ Trợ', elementLabel: def.element, rarityColor: def.rarity === 'SSR' ? '#f5c453' : def.rarity === 'SR' ? '#c084fc' : '#7dd3fc' },
      skills: c.actives.map((a) => ({
        id: a.def.id, name: a.def.name, element: a.def.element, cost: a.def.cost, target: a.def.target,
        icon: a.def.icon, desc: a.def.desc, tags: a.def.tags, qte: a.def.qte, strictness: a.def.qteStrictness,
        hits: a.def.hits, level: a.level, effects: a.effects,
      })),
      exp: oc.exp, expNeed: 0,
    };
  });
  const foeUnits = foes.map((f) => {
    const md = MONSTER_MAP[f.defId];
    const stageDef = STAGE_MAP[stageId];
    const monsterLevel = stageDef.waves[0].monsters.find((m) => m.id === f.defId)?.level ?? 1;
    const c = monsterCombat(md, monsterLevel, stageMultOf(stageId));
    const { stats: _drop, ...rest } = f as CombatantSeed & { stats: unknown };
    void _drop;
    return {
      ...rest, stats: c.stats, sprite: md.id,
      skills: monsterCombat(md, monsterLevel, 1).actives.map((a) => ({
        id: a.def.id, name: a.def.name, element: a.def.element, cost: a.def.cost, target: a.def.target,
        icon: a.def.icon, desc: a.def.desc, tags: a.def.tags, qte: a.def.qte, strictness: a.def.qteStrictness,
        hits: a.def.hits, level: a.level, effects: a.effects,
      })),
      visual: { roleLabel: md.role === 'tank' ? 'Đỡ Đòn' : md.role === 'attacker' ? 'Tấn Công' : 'Hỗ Trợ', elementLabel: md.element, rarityColor: '#c9c6d6' },
    };
  });
  return {
    stageId,
    seed: (Date.now() ^ (stageId * 2654435761)) >>> 0,
    name: stage.name,
    desc: stage.desc,
    boss: !!stage.boss,
    party: units as BattleConfigView['party'],
    foes: foeUnits as BattleConfigView['foes'],
    reward: stage.reward,
    maxRounds: 30,
  };
}

/* -------------------------------- dispatcher ------------------------------- */

export function isOfflineBuild(): boolean {
  return process.env.NEXT_PUBLIC_OFFLINE === '1';
}

export async function localApi(pathname: string, init?: RequestInit): Promise<Response> {
  const path = pathname.replace(/\?.*$/, '');
  let body: Record<string, unknown> = {};
  if (init?.body && typeof init.body === 'string') {
    try { body = JSON.parse(init.body) as Record<string, unknown>; } catch { body = {}; }
  }
  const json = (ok: boolean, data: unknown, status = 200) =>
    new Response(JSON.stringify({ ok, data: ok ? data : data }), { status, headers: { 'content-type': 'application/json' } });

  try {
    if (path === '/api/health') return json(true, { db: { ok: true, mode: 'offline' }, ts: Date.now() });

    if (path === '/api/save') {
      const action = body.action as string | undefined;
      let s = await load();
      if (!action) return json(true, { snapshot: snapshot(s), db: { ok: true, mode: 'offline' } });
      switch (action) {
        case 'rename': {
          s.name = String(body.name ?? s.name).slice(0, 24); break;
        }
        case 'settings': {
          break; // audio prefs live in localStorage; nothing to persist here
        }
        case 'wipe': {
          s = makeStarter(currentKey()); break;
        }
        case 'cheat': {
          s.gold += Number(body.gold ?? 0); s.gem += Number(body.gem ?? 0); break;
        }
        case 'grant': {
          const cid = String(body.charId ?? '');
          const def = CHAR_MAP[cid];
          if (!def) throw new Error('UNKNOWN_CHAR');
          const rnd = localRng(Date.now() >>> 0);
          const oc = ownedFromPull(def, nextCharId(s), rnd);
          s.owned.push({ ...oc });
          break;
        }
        case 'switchSave': {
          setCurrentKey(String(body.saveKey ?? 'local'));
          s = await load();
          return json(true, { saveKey: currentKey(), snapshot: snapshot(s) });
        }
      }
      s.updatedAt = Date.now();
      await writeSave(s);
      return json(true, { snapshot: snapshot(s) });
    }

    if (path === '/api/pull') {
      const s = await load();
      const res = doPull(s, body.kind === 'ten' ? 'ten' : 'single');
      s.updatedAt = Date.now();
      await writeSave(s);
      return json(true, { ...res, snapshot: snapshot(s) });
    }

    if (path === '/api/team') {
      const s = await load();
      if (body.action === 'release') {
        const id = Number(body.instanceId);
        const oc = s.owned.find((o) => o.instanceId === id);
        if (!oc) throw new Error('NOT_FOUND');
        if (oc.locked) throw new Error('LOCKED');
        for (const g of s.gears) if (g.equippedBy === id) g.equippedBy = null;
        s.owned = s.owned.filter((o) => o.instanceId !== id);
        s.team = s.team.map((t) => (t === id ? null : t));
        s.gold += 120 + oc.level * 8;
        await writeSave(s);
        return json(true, { gold: s.gold, snapshot: snapshot(s) });
      }
      if (body.action === 'lock') {
        const id = Number(body.instanceId);
        const oc = s.owned.find((o) => o.instanceId === id);
        if (!oc) throw new Error('NOT_FOUND');
        oc.locked = !oc.locked;
        await writeSave(s);
        return json(true, { locked: oc.locked, snapshot: snapshot(s) });
      }
      const team = toggleTeam(s, Number(body.instanceId), (body.mode as 'add' | 'remove' | 'move') ?? 'add', body.toSlot == null ? undefined : Number(body.toSlot));
      await writeSave(s);
      return json(true, { team, snapshot: snapshot(s) });
    }

    if (path === '/api/loadout') {
      const s = await load();
      const loadout = setLoadout(s, Number(body.instanceId), (body.loadout as (string | null)[]) ?? []);
      await writeSave(s);
      return json(true, { loadout, snapshot: snapshot(s) });
    }

    if (path === '/api/skill') {
      const s = await load();
      if (body.action === 'auto') {
        const oc = s.owned.find((o) => o.instanceId === Number(body.instanceId));
        if (!oc) throw new Error('NOT_FOUND');
        const res = autoAllocateSp(CHAR_MAP[oc.charId], oc);
        oc.skillLevels = res.levels;
        oc.sp = res.sp;
        await writeSave(s);
        return json(true, { levels: res.levels, sp: res.sp, snapshot: snapshot(s) });
      }
      const res = upgradeSkill(s, Number(body.instanceId), String(body.skillId));
      await writeSave(s);
      return json(true, { ...res, snapshot: snapshot(s) });
    }

    if (path === '/api/gear') {
      const s = await load();
      if (body.action === 'upgrade') {
        const res = upgradeGear(s, Number(body.gearInstanceId));
        await writeSave(s);
        return json(true, { ...res, snapshot: snapshot(s) });
      }
      const res = equipGear(s, Number(body.gearInstanceId), body.charInstanceId == null ? null : Number(body.charInstanceId));
      await writeSave(s);
      return json(true, { ...res, snapshot: snapshot(s) });
    }

    if (path === '/api/stage') {
      const s = await load();
      return json(true, {
        stages: STAGES.map((st) => ({
          id: st.id, name: st.name, region: st.region, boss: !!st.boss, desc: st.desc,
          difficulty: st.difficulty, reward: st.reward, dropChance: st.drop.chance,
          monsters: st.waves[0].monsters.map((m) => ({ id: m.id, level: m.level })),
          unlocked: st.id <= s.stageProgress,
        })),
        progress: s.stageProgress,
      });
    }

    if (path === '/api/stage/complete') {
      const s = await load();
      const res = completeStage(s, {
        stageId: Number(body.stageId), seed: Number(body.seed), claimedWin: !!body.claimedWin,
        actions: (body.actions as never[]) ?? [], durationMs: body.durationMs == null ? undefined : Number(body.durationMs),
      });
      await writeSave(s);
      return json(true, { verdict: res, snapshot: snapshot(s) });
    }

    if (path === '/api/shop') {
      const s = await load();
      if (body.itemId == null) {
        return json(true, {
          items: Object.values(SHOP_MAP).map((i) => ({ ...i, bought: s.purchases[i.id] ?? 0, soldOut: i.stock > 0 && (s.purchases[i.id] ?? 0) >= i.stock })),
          gold: s.gold,
        });
      }
      const res = buyShopItem(s, String(body.itemId));
      await writeSave(s);
      return json(true, { ...res, snapshot: snapshot(s) });
    }

    const battleMatch = /^\/api\/battle\/(\d+)(\/skills)?$/.exec(path);
    if (battleMatch) {
      const s = await load();
      const stageId = Number(battleMatch[1]);
      if (battleMatch[2]) {
        const slots = (body.slots as number[]) ?? [];
        const out = slots.map((instanceId) => {
          const oc = s.owned.find((o) => o.instanceId === instanceId);
          if (!oc) return null;
          const c = characterCombat(oc, s.gears);
          return {
            instanceId, stats: c.stats, mods: c.mods,
            skills: c.actives.map((a) => ({
              id: a.def.id, name: a.def.name, element: a.def.element, cost: a.def.cost, target: a.def.target,
              icon: a.def.icon, desc: a.def.desc, tags: a.def.tags, qte: a.def.qte, strictness: a.def.qteStrictness,
              hits: a.def.hits, level: a.level, effects: a.effects,
            })),
          };
        }).filter(Boolean);
        return json(true, { units: out });
      }
      return json(true, battleConfig(s, stageId));
    }

    return json(false, { error: `offline 404: ${path}` }, 404);
  } catch (e) {
    const r = err(e);
    return json(false, r.data, r.status);
  }
}
