import type {
  CombatantStats, Element, EquipSlot, GearDef, MonsterDef, OwnedCharacter, OwnedGear, SkillDef, SkillRuntime, StatMods,
} from '../types';
import { CHAR_MAP } from '../data/characters';
import { GEAR_MAP } from '../data/gear';
import { passiveMods, passiveLevelGate, resolveEffects, skillTree } from '../data/skillFactory';
import { RARITY_META, levelMult } from '../data/constants';

const ADDITIVE: GearDef['passives'][number]['id'][] = [
  'killHeal', 'diceBonus', 'resist', 'critRate', 'critDmg', 'atkPct', 'defPct', 'hpPct', 'spdPct',
  'dmgOut', 'dmgIn', 'healOut', 'lifesteal', 'procElement',
];

export interface CharacterCombatData {
  stats: CombatantStats;
  actives: SkillRuntime[];
  passives: { def: SkillDef; level: number }[];
  mods: StatMods;
}

/** Resolve base stats + gear + passives for an owned character instance. */
export function characterCombat(oc: OwnedCharacter, gear: OwnedGear[]): CharacterCombatData {
  const def = CHAR_MAP[oc.charId];
  if (!def) throw new Error(`unknown character ${oc.charId}`);
  const m = levelMult(oc.level);
  const tree = skillTree(def);

  const equipped = (['weapon', 'armor', 'accessory'] as EquipSlot[])
    .map((slot) => {
      const id = oc.gear[slot];
      if (id == null) return null;
      const inst = gear.find((x) => x.instanceId === id);
      if (!inst) return null;
      const g = GEAR_MAP[inst.gearId];
      return g ? { slot, def: g, plus: inst.plus } : null;
    })
    .filter((x): x is { slot: EquipSlot; def: GearDef; plus: number } => !!x);

  const mods: Record<string, number> = {};
  let procElement: Element | undefined;
  const add = (key: keyof StatMods, v: number) => { mods[key as string] = (mods[key as string] ?? 0) + v; };
  const setMax = (key: keyof StatMods, v: number) => { mods[key as string] = Math.max(mods[key as string] ?? 0, v); };

  const gearStats = { hp: 0, atk: 0, def: 0, spd: 0, critRate: 0, critDmg: 0, resist: 0 };
  for (const e of equipped) {
    const k = 1 + e.plus * 0.15;
    gearStats.hp += (e.def.base.hp ?? 0) * k;
    gearStats.atk += (e.def.base.atk ?? 0) * k;
    gearStats.def += (e.def.base.def ?? 0) * k;
    gearStats.spd += (e.def.base.spd ?? 0) * k;
    gearStats.critRate += (e.def.base.critRate ?? 0);
    gearStats.critDmg += (e.def.base.critDmg ?? 0);
    gearStats.resist += (e.def.base.resist ?? 0);

    for (const p of e.def.passives) {
      // only the flat stat bonus scales with +; passives get a smaller 6%/level bonus
      const v = ADDITIVE.includes(p.id) ? p.value * (1 + e.plus * 0.06) : p.value * (1 + e.plus * 0.06);
      switch (p.id) {
        case 'atkPct': add('atkPct', v); break;
        case 'defPct': add('defPct', v); break;
        case 'hpPct': add('hpPct', v); break;
        case 'spdPct': add('spdPct', v); break;
        case 'critRate': add('critRate', v); break;
        case 'critDmg': add('critDmg', v); break;
        case 'resist': add('resist', v); break;
        case 'diceBonus': add('diceBonus', v); break;
        case 'killHeal': add('killHeal', v); break;
        case 'execute': setMax('execute', v); break;
        case 'lifesteal': add('lifesteal', v); break;
        case 'dmgOut': add('dmgOut', v); break;
        case 'dmgIn': add('dmgIn', v); break;
        case 'healOut': add('healOut', v); break;
        case 'procElement':
          procElement = p.label as Element;
          add('procChance', v);
          break;
        case 'costReduce': add('skillCostReduce', 1); break;
      }
    }
  }

  // passives from the skill tree (always-on once unlocked)
  const passives: { def: SkillDef; level: number }[] = [];
  for (const p of tree.passives) {
    const lvl = oc.skillLevels[p.id] ?? 0;
    if (lvl <= 0) continue;
    if (oc.level < passiveLevelGate(p)) continue;
    passives.push({ def: p, level: lvl });
    const pm = passiveMods(p, lvl);
    for (const key of Object.keys(pm) as (keyof StatMods)[]) {
      const v = pm[key];
      if (typeof v !== 'number') continue;
      if (key === 'execute') setMax(key, v); else add(key, v);
    }
  }

  const rarityMult = RARITY_META[def.rarity].statMult;
  const hp = Math.round((def.base.hp * m + gearStats.hp) * (1 + (mods.hpPct ?? 0) / 100) * rarityMult);
  const atk = Math.round((def.base.atk * m + gearStats.atk) * (1 + (mods.atkPct ?? 0) / 100) * rarityMult);
  const dfn = Math.round((def.base.def * m + gearStats.def) * (1 + (mods.defPct ?? 0) / 100) * rarityMult);
  const spd = Math.round(def.base.spd * (1 + (mods.spdPct ?? 0) / 100) + gearStats.spd);

  const stats: CombatantStats = {
    hp, hpMax: hp, atk, def: dfn, spd,
    critRate: Math.min(85, def.base.critRate + (mods.critRate ?? 0) + gearStats.critRate),
    critDmg: def.base.critDmg + (mods.critDmg ?? 0) + gearStats.critDmg,
    resist: Math.min(85, def.base.resist + (mods.resist ?? 0) + gearStats.resist),
  };

  const actives: SkillRuntime[] = [];
  const seen = new Set<string>();
  for (const id of oc.loadout) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const sd = tree.all.find((s) => s.id === id && s.kind === 'active');
    if (!sd) continue;
    const lvl = Math.max(1, oc.skillLevels[sd.id] ?? 1);
    actives.push({ def: sd, level: lvl, effects: resolveEffects(sd, lvl) });
  }
  const basic = tree.actives[0]; // free basic attack is always index 0 of the tree
  if (!actives.some((a) => a.def.cost === 0)) {
    const lvl = Math.max(1, oc.skillLevels[basic.id] ?? 1);
    actives.unshift({ def: basic, level: lvl, effects: resolveEffects(basic, lvl) });
  }
  const costReduce = (mods.skillCostReduce ?? 0) >= 1 ? 1 : 0;
  const finalActives = actives.map((a) => (a.def.cost >= 4 && costReduce
    ? { ...a, def: { ...a.def, cost: Math.max(1, a.def.cost - costReduce) } }
    : a));

  return { stats, actives: finalActives, passives, mods: { ...(mods as unknown as StatMods), ...(procElement ? { procElement } : {}) } };
}

/** monster combat data (fixed skills, no gear) */
export function monsterCombat(md: MonsterDef, level: number, statMult: number): { stats: CombatantStats; actives: SkillRuntime[] } {
  const m = levelMult(level) * statMult;
  const hp = Math.round(md.base.hp * m);
  const stats: CombatantStats = {
    hp, hpMax: hp,
    atk: Math.round(md.base.atk * m),
    def: Math.round(md.base.def * m),
    spd: md.base.spd + level,
    critRate: md.base.critRate, critDmg: md.base.critDmg, resist: md.base.resist,
  };
  const actives = md.skills.map((s) => ({ def: s, level: 1, effects: resolveEffects(s, 1) }));
  return { stats, actives };
}
