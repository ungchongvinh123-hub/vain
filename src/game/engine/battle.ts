/* eslint-disable @typescript-eslint/no-explicit-any -- engine casts runtime-shaped skill payloads */
import type {
  Combatant, CombatEvent, CombatantStats, Element, QteKind, Rarity, Role, SkillRuntime, StatMods, StatusKind,
} from '../types';
import type { RngState } from '../types';
import { seedRng, randInt, rand, chance } from '../rng';
import { AGGRO, MAX_MANA, elementMult } from '../data/constants';

/* ================================ types ================================= */

export interface CombatantSeed {
  uid: string;
  defId: string;
  name: string;
  slot: number;
  side: 'party' | 'foe';
  role: Role;
  element: Element;
  level: number;
  rarity?: Rarity;
  stats: CombatantStats;
  skills: { id: string; name: string; level: number }[];
  mods: StatMods;
  boss?: boolean;
}

export interface BattleInit {
  stageId: number;
  seed: number;
  maxRounds: number;
  party: CombatantSeed[];
  foes: CombatantSeed[];
}

export type Action =
  | { t: 'skill'; skillId: string; targetUid?: string | null; mastery?: number; blockMastery?: number }
  | { t: 'pass' };

export interface BattleState {
  stageId: number;
  seed: number;
  round: number;
  maxRounds: number;
  units: Unit[];
  queue: { side: 'party' | 'foe'; uid: string }[];
  qi: number;
  phase: 'party' | 'foe' | 'over';
  opened: boolean;
  activeUid: string | null;
  diceValue: number;
  rng: RngState;
  events: CombatEvent[];
  result: 'win' | 'lose' | null;
}

export interface Unit {
  uid: string;
  defId: string;
  name: string;
  slot: number;
  side: 'party' | 'foe';
  role: Role;
  element: Element;
  level: number;
  rarity?: Rarity;
  boss?: boolean;
  base: CombatantStats;
  hp: number;
  mana: number;
  statuses: Status[];
  skills: RuntimeSkill[];
  mods: StatMods;
  alive: boolean;
  dealtDamage: number;
  xp: number;
}

export interface Status {
  kind: StatusKind;
  turns: number;
  potency: number;
  sourceUid: string;
  value?: number;
}

export interface RuntimeSkill {
  id: string;
  name: string;
  level: number;
  effects: unknown[];
  [k: string]: unknown;
}

/* ============================== construction ============================= */

export function toUnit(seed: CombatantSeed): Unit {
  return {
    uid: seed.uid, defId: seed.defId, name: seed.name, slot: seed.slot, side: seed.side, role: seed.role,
    element: seed.element, level: seed.level, rarity: seed.rarity, boss: seed.boss,
    base: { ...seed.stats }, hp: seed.stats.hpMax, mana: 0, statuses: [], skills: [], mods: seed.mods ?? {},
    alive: true, dealtDamage: 0, xp: 0,
  };
}

export function initBattle(init: BattleInit, skillResolver: (u: Unit) => RuntimeSkill[]): BattleState {
  const units = [...init.party, ...init.foes].map(toUnit);
  for (const u of units) u.skills = skillResolver(u);
  const bySide = (side: 'party' | 'foe') => units.filter((u) => u.side === side).sort((a, b) => eff(b, 'spd') - eff(a, 'spd') || a.slot - b.slot);
  const queue = [...bySide('party').map((u) => ({ side: 'party' as const, uid: u.uid })), ...bySide('foe').map((u) => ({ side: 'foe' as const, uid: u.uid }))];
  const st: BattleState = {
    stageId: init.stageId, seed: init.seed, round: 1, maxRounds: init.maxRounds, units, queue, qi: 0,
    phase: 'party', opened: false, activeUid: null, diceValue: 0, rng: seedRng(init.seed), events: [], result: null,
  };
  advanceToNextTurn(st);
  return st;
}

/* ================================ helpers ================================ */

export function uid(st: BattleState, id: string): Unit | undefined { return st.units.find((u) => u.uid === id); }
export const alive = (u: Unit) => u.alive && u.hp > 0;
export const foesOf = (st: BattleState, side: 'party' | 'foe') => st.units.filter((u) => u.side !== side && alive(u));
export const alliesOf = (st: BattleState, side: 'party' | 'foe') => st.units.filter((u) => u.side === side);
export const aliveAllies = (st: BattleState, side: 'party' | 'foe') => st.units.filter((u) => u.side === side && alive(u));

export function hasStatus(u: Unit, kind: StatusKind): Status | undefined { return u.statuses.find((s) => s.kind === kind); }
export function statusTurns(u: Unit, kind: StatusKind): number { return hasStatus(u, kind)?.turns ?? 0; }
export function isFrozen(u: Unit) { return statusTurns(u, 'freeze') > 0; }
export function isShocked(u: Unit) { return statusTurns(u, 'shock') > 0; }

/** effective stat after buffs/debuffs */
export function eff(u: Unit, key: 'atk' | 'def' | 'spd' | 'hpMax'): number {
  if (key === 'hpMax') return u.base.hpMax;
  let v = u.base[key];
  if (key === 'atk') {
    v *= 1 + (statusTurns(u, 'atkUp') > 0 ? (hasStatus(u, 'atkUp')!.potency) : 0);
    const dn = statusTurns(u, 'atkDown') > 0 ? hasStatus(u, 'atkDown')!.potency : 0;
    v *= Math.max(0.5, 1 - dn * (1 + (u.statuses.filter((s) => s.kind === 'atkDown').length - 1) * 0.5));
  }
  if (key === 'def') {
    v *= 1 + (statusTurns(u, 'defUp') > 0 ? hasStatus(u, 'defUp')!.potency : 0);
    const dn = statusTurns(u, 'defDown') > 0 ? hasStatus(u, 'defDown')!.potency : 0;
    v *= Math.max(0.45, 1 - dn * (1 + (u.statuses.filter((s) => s.kind === 'defDown').length - 1) * 0.5));
  }
  return Math.max(1, Math.round(v));
}

export const ROLE_DMG: Record<Role, number> = { tank: 0.82, attacker: 1.05, support: 0.88 };

export function masteryMult(kind: QteKind | undefined, mastery: number | undefined): number {
  if (!kind || mastery == null) return 1;
  if (kind === 'block') return mastery >= 0.85 ? 0 : mastery >= 0.5 ? 0.5 : 1;
  if (kind === 'focus') return mastery <= 0.001 ? 0.6 : 0.6 + 0.7 * mastery;
  if (kind === 'tap') return mastery <= 0.001 ? 0.68 : 0.68 + 0.62 * mastery;
  return mastery <= 0.001 ? 0.62 : 0.62 + 0.68 * mastery; // link
}

/* ================================ turn flow =============================== */

function push(st: BattleState, ev: CombatEvent) { st.events.push(ev); }

export function currentUnit(st: BattleState): Unit | undefined { return st.activeUid ? uid(st, st.activeUid) : undefined; }

/** Move to the next living unit in the queue, handling round rollover & end conditions. */
export function advanceToNextTurn(st: BattleState): void {
  if (st.result) { st.phase = 'over'; return; }
  for (;;) {
    if (st.qi >= st.queue.length) {
      endOfRound(st);
      if (st.result) { st.phase = 'over'; return; }
      st.round += 1;
      if (st.round > st.maxRounds) {
        // timeout: whoever holds more of its starting HP wins — the boss can never win by stalling
        const rel = (side: 'party' | 'foe') => {
          const us = st.units.filter((x) => x.side === side);
          const mx = us.reduce((a, b) => a + Math.max(1, b.base.hpMax), 0);
          return us.reduce((a, b) => a + Math.max(0, b.hp), 0) / mx;
        };
        const win = rel('party') >= rel('foe');
        st.result = win ? 'win' : 'lose';
        push(st, { e: 'battleEnd', win, rounds: st.round, tiebreak: true });
        return;
      }
      push(st, { e: 'roundStart', round: st.round });
      rebuildQueue(st);
      st.qi = 0;
    }
    const entry = st.queue[st.qi];
    const u = uid(st, entry.uid);
    if (!u) { st.qi++; continue; }
    if (!alive(u)) { st.qi++; continue; }
    if (u.side === 'party' && st.phase !== 'party') st.phase = 'party';
    if (u.side === 'foe' && st.phase !== 'foe') st.phase = 'foe';
    st.activeUid = u.uid;
    u.mana = 0;
    st.diceValue = 0;
    st.opened = false;
    push(st, { e: 'turnStart', uid: u.uid, round: st.round });
    return;
  }
}

function rebuildQueue(st: BattleState) {
  const order = (side: 'party' | 'foe') => aliveAllies(st, side).sort((a, b) => eff(b, 'spd') - eff(a, 'spd') || a.slot - b.slot).map((u) => ({ side, uid: u.uid }));
  st.queue = [...order('party'), ...order('foe')];
}

export function finishTurn(st: BattleState) {
  st.opened = false;
  st.activeUid = null;
  st.qi += 1;
  advanceToNextTurn(st);
}

/* --------------------------------- dice ---------------------------------- */

export interface DiceResult { faces: number[]; total: number; bonus: boolean; }

export function rollDice(st: BattleState, u: Unit): DiceResult {
  const bonusPct = Math.min(95, u.mods.diceBonus ?? 0);
  const diceCount = 1 + (u.side === 'party' && bonusPct > 0 ? (chance(st.rng, bonusPct) ? 1 : 0) : 0);
  const faces: number[] = [];
  for (let i = 0; i < diceCount; i++) faces.push(randInt(st.rng, 1, 6));
  const total = Math.min(MAX_MANA, faces.reduce((a, b) => a + b, 0));
  u.mana = total;
  st.diceValue = total;
  st.opened = true;
  push(st, { e: 'dice', uid: u.uid, faces, total, bonus: diceCount > 1 ? 1 : 0, rolls: faces.map((f) => [f]) });
  return { faces, total, bonus: diceCount > 1 };
}

/** skills usable right now (mana, status gates). Basic attack (cost 0) is always present. */
export function usableSkills(st: BattleState, u: Unit): RuntimeSkill[] {
  if (u.side === 'foe') return u.skills;
  if (isShocked(u)) return u.skills.filter((s) => (s.cost as number) === 0);
  return u.skills.filter((s) => (s.cost as number) <= u.mana);
}

/* ================================ actions ================================ */

export function actSkill(st: BattleState, u: Unit, skill: RuntimeSkill, targetUid: string | null, mastery?: number, blockMastery?: number): void {
  const def = skill as unknown as { id: string; name: string; cost: number; target: string; element: Element; qte?: QteKind; hits?: number; effects: any[] };
  const cost = def.cost ?? 0;
  const targets = pickTargets(st, u, def.target as TargetMode, targetUid);
  const selfOnly = def.target === 'self' || def.target === 'allyAll' || def.target === 'allyLowest' || def.target === 'allyOne' || def.target === 'allyDead';
  push(st, { e: 'cast', uid: u.uid, skillId: def.id, skillName: def.name, cost, qte: def.qte, targets: targets.map((t) => t.uid), selfOnly });
  if (def.qte && mastery != null) {
    push(st, { e: 'qte', uid: u.uid, kind: def.qte, mastery, mult: masteryMult(def.qte, mastery) });
  }
  applyEffects(st, u, targets, skill, def, mastery);
  u.mana = Math.max(0, u.mana - cost);
}

type TargetMode = 'enemyOne' | 'enemyAll' | 'enemyFront' | 'enemySpread' | 'allyOne' | 'allyAll' | 'allyLowest' | 'self' | 'allyDead';

export function resolveTargets(st: BattleState, u: Unit, mode: TargetMode, chosen: string | null): Unit[] {
  return pickTargets(st, u, mode, chosen);
}

function pickTargets(st: BattleState, u: Unit, mode: TargetMode, chosen: string | null): Unit[] {
  const enemies = foesOf(st, u.side).sort((a, b) => a.slot - b.slot);
  const allies = aliveAllies(st, u.side).sort((a, b) => a.slot - b.slot);
  switch (mode) {
    case 'enemyOne': {
      const t = (chosen && uid(st, chosen) && alive(uid(st, chosen)!) ? uid(st, chosen) : enemies[0])!;
      return t ? [t] : [];
    }
    case 'enemyAll': return enemies;
    case 'enemyFront': return enemies.slice(0, 1);
    case 'enemySpread': {
      if (enemies.length === 0) return [];
      const anchor = (chosen && uid(st, chosen) && alive(uid(st, chosen)!) ? uid(st, chosen) : enemies[0])!;
      const idx = enemies.indexOf(anchor);
      const out = [enemies[idx]];
      if (enemies[idx - 1]) out.push(enemies[idx - 1]);
      if (enemies[idx + 1]) out.push(enemies[idx + 1]);
      return Array.from(new Set(out)).filter(Boolean);
    }
    case 'self': return [u];
    case 'allyAll': return allies;
    case 'allyLowest': return [allies.filter((a) => a.uid !== u.uid).sort((a, b) => a.hp / eff(a, 'hpMax') - b.hp / eff(b, 'hpMax'))[0] ?? u].filter(Boolean);
    case 'allyOne': return [(chosen && uid(st, chosen) ? uid(st, chosen) : allies[0])!].filter(Boolean);
    case 'allyDead': {
      const dead = st.units.filter((x) => x.side === u.side && !x.alive);
      return [chosen && uid(st, chosen) ? uid(st, chosen)! : dead[0]].filter(Boolean);
    }
    default: return enemies.slice(0, 1);
  }
}

function applyEffects(st: BattleState, actor: Unit, targets: Unit[], skill: RuntimeSkill, def: { element: Element; qte?: QteKind; hits?: number }, mastery?: number) {
  const effects = (skill as unknown as { effects: any[] }).effects ?? [];
  const level = (skill as unknown as { level: number }).level ?? 1;
  void level;
  for (const fx of effects) {
    switch (fx.t) {
      case 'damage': {
        const hits = Math.max(1, def.hits ?? 1);
        for (let h = 0; h < hits; h++) {
          for (const t of targets) {
            if (!alive(t) && t.side === 'foe') continue;
            dealDamage(st, actor, t, fx.power, fx.scale, def.element, def.qte, mastery, 'skill', h > 0);
          }
        }
        break;
      }
      case 'drain': {
        for (const t of targets) {
          const dealt = dealDamage(st, actor, t, fx.power, fx.scale, def.element, def.qte, mastery, 'skill');
          const heal = Math.round(dealt * (fx.healPct / 100));
          if (heal > 0 && alive(actor)) { actor.hp = Math.min(eff(actor, 'hpMax'), actor.hp + heal); push(st, { e: 'heal', from: actor.uid, to: actor.uid, amount: heal, kind: 'heal' }); }
        }
        break;
      }
      case 'heal': {
        for (const t of targets) {
          const amt = Math.round((eff(actor, 'atk') * fx.power * fx.scale) * (1 + (actor.mods.healOut ?? 0) / 100));
          const before = t.hp;
          t.hp = Math.min(eff(t, 'hpMax'), t.hp + amt);
          if (t.hp > before) push(st, { e: 'heal', from: actor.uid, to: t.uid, amount: t.hp - before, kind: 'heal' });
        }
        break;
      }
      case 'shield': {
        for (const t of targets) {
          const amt = Math.round(eff(t, 'hpMax') * fx.power);
          const ex = hasStatus(t, 'shield');
          if (ex) { ex.value = (ex.value ?? 0) + amt; ex.turns = Math.max(ex.turns, 2); }
          else t.statuses.push({ kind: 'shield', turns: 2, potency: 0, sourceUid: actor.uid, value: amt });
          push(st, { e: 'shield', to: t.uid, amount: amt });
        }
        break;
      }
      case 'status': {
        for (const t of targets) {
          applyStatus(st, actor, t, fx.status, fx.turns, fx.potency, fx.chance ?? 100);
        }
        break;
      }
      case 'cleanse': {
        for (const t of targets) {
          const bad: StatusKind[] = ['burn', 'poison', 'freeze', 'shock', 'atkDown', 'defDown'];
          const removed: StatusKind[] = [];
          t.statuses = t.statuses.filter((s) => { if (bad.includes(s.kind) && removed.length < Math.max(1, fx.count)) { removed.push(s.kind); return false; } return true; });
          push(st, { e: 'cleanse', to: t.uid, removed });
        }
        break;
      }
      case 'dispel': {
        for (const t of targets) {
          const good: StatusKind[] = ['atkUp', 'defUp', 'regen', 'shield'];
          const removed: StatusKind[] = [];
          t.statuses = t.statuses.filter((s) => { if (good.includes(s.kind) && removed.length < Math.max(1, fx.count)) { removed.push(s.kind); return false; } return true; });
          push(st, { e: 'dispel', to: t.uid, removed });
        }
        break;
      }
      case 'revive': {
        const t = targets[0];
        if (t && !t.alive) {
          t.alive = true;
          t.hp = Math.max(1, Math.round(eff(t, 'hpMax') * (fx.healPct / 100)));
          t.statuses = [];
          push(st, { e: 'revive', uid: t.uid, amount: t.hp });
        }
        break;
      }
    }
  }
  // elemental proc from gear
  if (def.qte !== 'block' && actor.mods.procElement && (actor.mods.procChance ?? 0) > 0 && targets.length) {
    const el = actor.mods.procElement as Element;
    for (const t of targets) {
      if (!alive(t)) continue;
      if (chance(st.rng, actor.mods.procChance ?? 0)) {
        applyStatus(st, actor, t, statusForElement(el), 1 + (el === 'ice' ? 0 : 1), 0.22, 100);
      }
    }
  }
}

export function statusForElement(el: Element): StatusKind {
  switch (el) { case 'fire': return 'burn'; case 'ice': return 'freeze'; case 'nature': return 'poison'; case 'thunder': return 'shock'; case 'holy': return 'atkUp'; case 'dark': return 'defDown'; default: return 'atkDown'; }
}

export function applyStatus(st: BattleState, actor: Unit, t: Unit, kind: StatusKind, turns: number, potency: number, chancePct: number) {
  if (!alive(t)) { push(st, { e: 'status', from: actor.uid, to: t.uid, status: kind, applied: false }); return; }
  const resistChance = Math.max(0, Math.min(90, t.base.resist - (eff(actor, 'atk') > 0 ? 0 : 0)));
  const rollOk = chance(st.rng, chancePct * (1 - resistChance / 100));
  if (!rollOk) { push(st, { e: 'status', from: actor.uid, to: t.uid, status: kind, applied: false, resisted: true }); return; }
  const ex = hasStatus(t, kind);
  if (ex) { ex.turns = Math.max(ex.turns, turns); ex.potency = Math.max(ex.potency, potency); }
  else t.statuses.push({ kind, turns, potency, sourceUid: actor.uid });
  push(st, { e: 'status', from: actor.uid, to: t.uid, status: kind, applied: true, turns, potency });
}

export function dealDamage(st: BattleState, actor: Unit, target: Unit, power: number, scale: number, element: Element, qte: QteKind | undefined, mastery: number | undefined, source: 'skill' | 'status' | 'basic', minor = false): number {
  if (!alive(target)) return 0;
  const atk = eff(actor, 'atk');
  const defv = eff(target, 'def');
  const raw = atk * power * scale;
  const defPart = 100 / (100 + defv * 0.42);
  const el = elementMult(element, target.element);
  const roleMult = ROLE_DMG[actor.role];
  const variance = 0.9 + rand(st.rng) * 0.2;
  const critP = Math.min(88, actor.base.critRate + (minor ? -6 : 0));
  const isCrit = !minor && chance(st.rng, critP);
  let dmg = raw * defPart * el * roleMult * variance * (1 + (actor.mods.dmgOut ?? 0) / 100) * (1 + (target.mods.dmgIn ?? 0) / 100);
  if (isCrit) dmg *= actor.base.critDmg / 100;
  const mm = masteryMult(qte, mastery);
  dmg *= mm;
  if (source === 'status') dmg = Math.min(eff(target, 'hpMax') * 0.13, dmg * 1.0);
  dmg = Math.max(1, Math.round(dmg));

  // shield absorb
  const sh = hasStatus(target, 'shield');
  let absorbed = 0;
  if (sh && (sh.value ?? 0) > 0) {
    absorbed = Math.min(sh.value ?? 0, dmg);
    sh.value = (sh.value ?? 0) - absorbed;
    dmg -= absorbed;
    push(st, { e: 'absorb', to: target.uid, amount: absorbed, remaining: sh.value });
    if (sh.value <= 0) target.statuses = target.statuses.filter((s) => s !== sh);
  }
  if (dmg > 0) {
    target.hp -= dmg;
    actor.dealtDamage += dmg;
    push(st, { e: 'damage', from: actor.uid, to: target.uid, amount: dmg + absorbed, crit: isCrit, counter: el, source } as CombatEvent);
  }
  // lifesteal
  if (source === 'skill' && (actor.mods.lifesteal ?? 0) > 0 && alive(actor)) {
    const h = Math.round(dmg * (actor.mods.lifesteal ?? 0) / 100);
    if (h > 0) { actor.hp = Math.min(eff(actor, 'hpMax'), actor.hp + h); push(st, { e: 'heal', from: actor.uid, to: actor.uid, amount: h, kind: 'heal' }); }
  }
  if (target.hp <= 0) {
    // execute prevention: a dead unit is dead
    onDeath(st, target, actor);
  } else if (!target.boss && (actor.mods.execute ?? 0) > 0 && target.hp <= eff(target, 'hpMax') * (actor.mods.execute! / 100)) {
    target.hp = 0;
    push(st, { e: 'execute', uid: target.uid, by: actor.uid });
    onDeath(st, target, actor);
  }
  return dmg + absorbed;
}

function onDeath(st: BattleState, target: Unit, killer: Unit) {
  target.alive = false;
  target.hp = 0;
  target.statuses = [];
  push(st, { e: 'death', uid: target.uid, killedBy: killer?.uid });
  if (killer && alive(killer)) {
    if (target.side !== killer.side) {
      const pct = killer.mods.killHeal ?? 0;
      if (pct > 0) {
        const amt = Math.round(eff(killer, 'hpMax') * (pct / 100));
        killer.hp = Math.min(eff(killer, 'hpMax'), killer.hp + amt);
        push(st, { e: 'killHeal', uid: killer.uid, amount: amt });
      }
    }
  }
  const partyAlive = aliveAllies(st, 'party').length;
  const foeAlive = aliveAllies(st, 'foe').length;
  if (foeAlive === 0) { st.result = 'win'; push(st, { e: 'battleEnd', win: true, rounds: st.round }); st.phase = 'over'; }
  else if (partyAlive === 0) { st.result = 'lose'; push(st, { e: 'battleEnd', win: false, rounds: st.round }); st.phase = 'over'; }
}

/* -------------------------------- statuses -------------------------------- */

/** end-of-round tick: DoTs, regen, duration decay */
export function endOfRound(st: BattleState) {
  for (const u of st.units) {
    if (!alive(u)) continue;
    const burn = hasStatus(u, 'burn');
    if (burn) {
      const amt = Math.max(1, Math.round(Math.min(eff(u, 'hpMax') * 0.13, eff(u, 'hpMax') * 0.05 + eff(uid(st, burn.sourceUid) ?? u, 'atk') * 0.35 * burn.potency * 2)));
      u.hp -= amt;
      push(st, { e: 'damage', from: burn.sourceUid, to: u.uid, amount: amt, crit: false, counter: 1, source: 'status' });
      if (u.hp <= 0) { u.hp = 0; onDeath(st, u, uid(st, burn.sourceUid) ?? u); continue; }
    }
    const poison = hasStatus(u, 'poison');
    if (poison) {
      const amt = Math.max(1, Math.round(Math.min(eff(u, 'hpMax') * 0.075, eff(u, 'hpMax') * 0.03 + eff(uid(st, poison.sourceUid) ?? u, 'atk') * 0.22 * poison.potency * 2)));
      u.hp -= amt;
      push(st, { e: 'damage', from: poison.sourceUid, to: u.uid, amount: amt, crit: false, counter: 1, source: 'status' });
      if (u.hp <= 0) { u.hp = 0; onDeath(st, u, uid(st, poison.sourceUid) ?? u); continue; }
    }
    const regen = hasStatus(u, 'regen');
    if (regen) {
      const amt = Math.round(eff(u, 'hpMax') * (0.045 + regen.potency * 0.35));
      const before = u.hp;
      u.hp = Math.min(eff(u, 'hpMax'), u.hp + amt);
      if (u.hp > before) push(st, { e: 'heal', from: regen.sourceUid, to: u.uid, amount: u.hp - before, kind: 'regen' });
    }
    u.statuses = u.statuses.filter((s) => { s.turns -= 1; return s.turns > 0; });
  }
}

/* ---------------------------------- AI ----------------------------------- */

export interface FoeIntent { skill: RuntimeSkill; targets: Unit[]; qte?: QteKind; blocked: boolean }

export function foeChoose(st: BattleState, u: Unit): FoeIntent | null {
  const partyAliveList = aliveAllies(st, 'party');
  if (partyAliveList.length === 0) return null;
  const skills = u.skills.filter((s) => ((s as unknown as { target: string }).target ?? 'enemyOne') !== 'allyDead');
  const allyLowHp = aliveAllies(st, 'foe').some((a) => a.hp < eff(a, 'hpMax') * 0.55);

  let chosen: RuntimeSkill | undefined;
  const healer = skills.find((s) => ((s as unknown as { target: string }).target === 'allyLowest' || (s as unknown as { target: string }).target === 'allyAll') && (s as unknown as { effects: any[] }).effects?.some((e) => e.t === 'heal'));
  const taunter = skills.find((s) => (s as unknown as { effects: any[] }).effects?.some((e) => e.t === 'status' && e.status === 'taunt'));
  const buff = skills.find((s) => (s as unknown as { effects: any[] }).effects?.some((e) => e.t === 'status' && (e.status === 'atkUp' || e.status === 'defUp')));

  if (healer && allyLowHp && chance(st.rng, 72)) chosen = healer;
  else if (taunter && u.role === 'tank' && !partyAliveList.some((p) => hasStatus(p, 'taunt')) && chance(st.rng, 40)) chosen = taunter;
  else if (buff && st.round % 3 === 0 && chance(st.rng, 35)) chosen = buff;
  else chosen = pickDamageSkill(st, skills);

  if (!chosen) {
    chosen = { id: `${u.defId}_basic`, name: 'Tấn Công', level: 1, cost: 0, target: 'enemyOne', element: u.element, effects: [{ t: 'damage', power: 1.0, scale: 1 }] } as unknown as RuntimeSkill;
  }
  const def = chosen as unknown as { target: TargetMode; effects: any[]; qte?: QteKind };
  const isHealLike = def.target === 'allyLowest' || def.target === 'allyAll' || def.target === 'self' ||
    def.effects.every((e) => e.t !== 'damage' && e.t !== 'drain');

  let targets: Unit[];
  if (isHealLike) {
    targets = def.target === 'allyLowest' ? [lowest(st, 'foe')] : def.target === 'self' ? [u] : aliveAllies(st, 'foe');
  } else if (def.target === 'enemyAll') {
    targets = partyAliveList;
  } else if (def.target === 'enemySpread') {
    targets = spreadFrom(st, u, def);
  } else {
    targets = [pickPlayerTarget(st, u)];
  }
  const qte = !isHealLike && def.qte === 'block' ? 'block' : undefined;
  return { skill: chosen, targets: targets.filter(Boolean), qte, blocked: false };
}

/** commit a foe intent (after the block QTE resolved, if any) */
export function foeApply(st: BattleState, u: Unit, intent: FoeIntent, blockMastery?: number): void {
  const def = intent.skill as unknown as { id: string; name: string; effects: any[]; element: Element; qte?: QteKind; hits?: number; cost: number };
  const selfOnly = intent.targets.length > 0 && intent.targets.every((t) => t.side === u.side);
  push(st, { e: 'cast', uid: u.uid, skillId: def.id, skillName: def.name, cost: 0, qte: intent.qte, targets: intent.targets.map((t) => t.uid), selfOnly });
  push(st, { e: 'foeAct', uid: u.uid, skillId: def.id, targets: intent.targets.map((t) => t.uid) });
  if (intent.qte === 'block' && blockMastery != null) {
    const ok = blockMastery >= 0.85;
    push(st, { e: 'block', uid: u.uid, success: ok, amount: 0 });
    push(st, { e: 'qte', uid: u.uid, kind: 'block', mastery: blockMastery, mult: masteryMult('block', blockMastery) });
  }
  applyEffects(st, u, intent.targets, intent.skill, def, intent.qte === 'block' ? blockMastery : undefined);
}

function spreadFrom(st: BattleState, u: Unit, def: { target: TargetMode }): Unit[] {
  const list = aliveAllies(st, 'party').sort((a, b) => a.slot - b.slot);
  const anchor = pickPlayerTarget(st, u);
  const i = list.indexOf(anchor);
  const out = [list[i]];
  if (list[i - 1]) out.push(list[i - 1]);
  if (list[i + 1]) out.push(list[i + 1]);
  return Array.from(new Set(out)).filter(Boolean);
}

function lowest(st: BattleState, side: 'party' | 'foe'): Unit {
  return aliveAllies(st, side).sort((a, b) => a.hp / eff(a, 'hpMax') - b.hp / eff(b, 'hpMax'))[0];
}

function pickDamageSkill(st: BattleState, skills: RuntimeSkill[]): RuntimeSkill | undefined {
  const dms = skills.filter((s) => (s as unknown as { effects: any[] }).effects?.some((e) => e.t === 'damage' || e.t === 'drain'));
  if (!dms.length) return undefined;
  // heavy hits more likely at low player hp pressure
  const weights = dms.map((s) => {
    const fx = (s as unknown as { effects: any[] }).effects.find((e) => e.t === 'damage' || e.t === 'drain');
    return 1 + (fx?.power ?? 1) * 0.6;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand(st.rng) * total;
  for (let i = 0; i < dms.length; i++) { r -= weights[i]; if (r <= 0) return dms[i]; }
  return dms[dms.length - 1];
}

/** monster targeting: taunt > tank aggro > low hp */
export function pickPlayerTarget(st: BattleState, foe: Unit): Unit {
  const list = aliveAllies(st, 'party');
  const taunted = list.filter((p) => hasStatus(p, 'taunt'));
  const pool = taunted.length ? taunted : list;
  const weights = pool.map((p) => {
    const aggro = AGGRO[p.role] ?? 1;
    const hpFactor = 0.65 + (1 - p.hp / eff(p, 'hpMax')) * 0.7;
    const lowDef = 1 + (1 - eff(p, 'def') / 400) * 0.2;
    return aggro * hpFactor * lowDef;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand(st.rng) * total;
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

/* ------------------------------ player action ----------------------------- */

export interface TurnOutcome { ok: boolean; reason?: string }

export interface PartyIntent {
  uid: string;
  skillId: string;
  skillName: string;
  cost: number;
  element: Element;
  qte?: QteKind;
  strictness: number;
  targets: string[];
  selfOnly: boolean;
  hits: number;
}

/**
 * Deterministic preview used by the UI before the strike animation:
 * which units get hit + which QTE (if any) must be performed.
 * Pure — consumes no RNG.
 */
export function partyPreview(st: BattleState, u: Unit, skill: RuntimeSkill, targetUid: string | null): PartyIntent {
  const def = skill as unknown as {
    id: string; name: string; cost: number; target: TargetMode; element: Element; qte?: QteKind;
    qteStrictness?: number; effects: { t: string }[]; hits?: number;
  };
  const targets = pickTargets(st, u, def.target, targetUid);
  const selfOnly = !targets.some((t) => t.side !== u.side);
  const damages = (def.effects ?? []).some((e) => e.t === 'damage' || e.t === 'drain');
  return {
    uid: u.uid, skillId: def.id, skillName: def.name, cost: def.cost ?? 0, element: def.element,
    qte: damages ? def.qte : undefined, strictness: def.qteStrictness ?? 0.6,
    targets: targets.map((t) => t.uid), selfOnly, hits: def.hits ?? 1,
  };
}

/** Resolve a player action for the active unit, then end its turn. */
export function playerAct(st: BattleState, action: Action, resolveSkill: (u: Unit, skillId: string) => RuntimeSkill | undefined): TurnOutcome {
  const u = currentUnit(st);
  if (!u || st.phase !== 'party' || !st.opened || st.result) return { ok: false, reason: 'invalid-state' };
  if (action.t === 'pass') { finishTurn(st); return { ok: true }; }
  const sk = resolveSkill(u, action.skillId);
  if (!sk) return { ok: false, reason: 'unknown-skill' };
  const cost = (sk as unknown as { cost: number }).cost ?? 0;
  if (cost > u.mana) return { ok: false, reason: 'not-enough-mana' };
  if (isShocked(u) && cost > 0) return { ok: false, reason: 'shocked' };
  actSkill(st, u, sk, action.targetUid ?? null, action.mastery, action.blockMastery);
  finishTurn(st);
  return { ok: true };
}

/** the enemy AI turn — always automatic */
export function foeTurn(st: BattleState): void {
  const u = currentUnit(st);
  if (!u || st.phase !== 'foe' || st.result) return;
  if (isFrozen(u)) { push(st, { e: 'skip', uid: u.uid, reason: 'freeze' }); finishTurn(st); return; }
  const intent = foeChoose(st, u);
  if (intent) foeApply(st, u, intent);
  finishTurn(st);
}

/** player unit freeze check — returns true if the turn was skipped (needs no dice) */
export function partyTurnOpen(st: BattleState): 'dice' | 'skipped' {
  const u = currentUnit(st);
  if (!u) return 'skipped';
  if (isFrozen(u)) { push(st, { e: 'skip', uid: u.uid, reason: 'freeze' }); finishTurn(st); return 'skipped'; }
  return 'dice';
}

export function diceForActive(st: BattleState): DiceResult | null {
  const u = currentUnit(st);
  if (!u) return null;
  if (st.diceValue > 0) return { faces: [st.diceValue], total: st.diceValue, bonus: false };
  return rollDice(st, u);
}

/* ------------------------------- serialization ---------------------------- */

export interface ReplayResult {
  result: 'win' | 'lose' | null;
  rounds: number;
  totalDamage: number;
  minHpPct: number;   // lowest party hp ratio reached (loose sanity bound)
  kills: number;
}

export function summarize(st: BattleState): ReplayResult {
  const totalDamage = st.units.filter((u) => u.side === 'party').reduce((a, b) => a + b.dealtDamage, 0);
  const party = st.units.filter((u) => u.side === 'party');
  const minHpPct = 1; // not enforced (variance), kept for API stability
  const kills = st.events.filter((e) => e.e === 'death').length;
  void party;
  return { result: st.result, rounds: st.round, totalDamage, minHpPct, kills };
}

export type { Combatant, CombatEvent };
