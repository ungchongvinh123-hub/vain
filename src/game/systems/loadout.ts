import type { CharacterDef, OwnedCharacter, SkillDef } from '../types';
import { CHAR_MAP } from '../data/characters';
import { skillTree } from '../data/skillFactory';
import { MAX_LEVEL, MAX_LOADOUT, MAX_SKILL_LEVEL, RARITY_META, expToNext, levelMult, spReward } from '../data/constants';

/** best-N equipped actives (basic attack first). Deterministic, no RNG. */
export function defaultLoadout(charId: string): (string | null)[] {
  const def = CHAR_MAP[charId];
  if (!def) return new Array(MAX_LOADOUT).fill(null);
  const tree = skillTree(def);
  const basic = tree.actives[0];
  const rest = tree.actives.slice(1)
    .sort((a, b) => (b.cost * 1.35 + b.powerMult * 2) - (a.cost * 1.35 + a.powerMult * 2));
  const out: (string | null)[] = [basic.id];
  for (const s of rest) {
    if (out.length >= MAX_LOADOUT) break;
    out.push(s.id);
  }
  while (out.length < MAX_LOADOUT) out.push(null);
  return out.slice(0, MAX_LOADOUT);
}

export function allUnlockedSkillLevels(def: CharacterDef, sp: number, gold: number, charLevel: number, existing: Record<string, number> = {}) {
  const tree = skillTree(def);
  const levels: Record<string, number> = { ...existing };
  let points = sp;
  const order = [...tree.all].sort((a, b) => a.tier - b.tier || a.node - b.node);
  let changed = true;
  while (changed && points > 0) {
    changed = false;
    for (const s of order) {
      const cur = levels[s.id] ?? 0;
      if (cur >= MAX_SKILL_LEVEL) continue;
      if (s.kind === 'passive' && charLevel < (s.levelGate ?? 1)) continue;
      const cost = cur + 1;
      if (points < cost) continue;
      levels[s.id] = cost;
      points -= cost;
      changed = true;
      if (points <= 0) break;
    }
  }
  return { levels, spent: sp - points, leftover: points, gold };
}

/** auto-spend SP on the tree respecting gates (used by "Tự cộng điểm" button) */
export function autoAllocateSp(def: CharacterDef, oc: OwnedCharacter): { levels: Record<string, number>; sp: number; gained: number } {
  const tree = skillTree(def);
  const levels: Record<string, number> = { ...oc.skillLevels };
  let sp = oc.sp;
  const basics = tree.actives[0];
  if ((levels[basics.id] ?? 0) === 0 && sp >= 1) { levels[basics.id] = 1; sp -= 1; }
  const order = [...tree.all].sort((a, b) => a.tier - b.tier || a.cost - b.cost || a.node - b.node);
  let moved = true;
  while (moved && sp > 0) {
    moved = false;
    for (const s of order) {
      const cur = levels[s.id] ?? 0;
      if (cur >= MAX_SKILL_LEVEL) continue;
      if (s.requires.length && !s.requires.every((r) => (levels[r] ?? 0) > 0)) continue;
      if (s.kind === 'passive' && oc.level < (s.levelGate ?? 1)) continue;
      const cost = cur + 1;
      if (sp < cost) continue;
      levels[s.id] = cur + 1;
      sp -= cost;
      moved = true;
      if (sp <= 0) break;
    }
  }
  return { levels, sp, gained: 0 };
}

export function grantExp(oc: OwnedCharacter, exp: number, stageId: number): { level: number; exp: number; sp: number; leveled: number } {
  let level = oc.level, cur = oc.exp + exp, sp = oc.sp, leveled = 0;
  while (level < MAX_LEVEL && cur >= expToNext(level)) {
    cur -= expToNext(level);
    level += 1;
    leveled += 1;
    sp += spReward(level, stageId) + (level % 5 === 0 ? 3 : 0);
  }
  if (level >= MAX_LEVEL) cur = Math.min(cur, expToNext(MAX_LEVEL - 1));
  return { level, exp: cur, sp, leveled };
}

/** stat line for tooltips/roster cards */
export function statPreview(def: CharacterDef, level: number) {
  const m = levelMult(level);
  const rm = RARITY_META[def.rarity].statMult;
  return {
    hp: Math.round(def.base.hp * m * rm),
    atk: Math.round(def.base.atk * m * rm),
    def: Math.round(def.base.def * m * rm),
    spd: def.base.spd,
    nextExp: expToNext(level),
  };
}

export function expProgress(level: number, exp: number): number {
  const need = expToNext(level);
  return need ? Math.max(0, Math.min(1, exp / need)) : 1;
}

export type { SkillDef };
