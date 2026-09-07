import type { OwnedCharacter, OwnedGear, SkillRuntime } from '../game/types';
import type { CombatantSeed, RuntimeSkill } from '../game/engine/battle';
import { characterCombat, monsterCombat } from '../game/systems/stats';
import { CHAR_MAP } from '../game/data/characters';
import { MONSTER_MAP } from '../game/data/monsters';
import { STAGE_MAP } from '../game/data/stages';
import { stageMult } from '../game/data/constants';
import {
  initBattle, partyPreview, playerAct, foeChoose, foeApply, currentUnit, advanceToNextTurn,
  partyTurnOpen, usableSkills, rollDice, actSkill, finishTurn, eff, hasStatus, aliveAllies,
  isFrozen, isShocked, type BattleState,
} from '../game/engine/battle';

export function runtimeToSeedSkill(rt: SkillRuntime) {
  return {
    id: rt.def.id, name: rt.def.name, level: rt.level, cost: rt.def.cost, target: rt.def.target,
    element: rt.def.element, effects: rt.effects, qte: rt.def.qte, qteStrictness: rt.def.qteStrictness,
    hits: rt.def.hits,
  };
}

export function partySeeds(owned: OwnedCharacter[], gear: OwnedGear[], team: (number | null)[]): CombatantSeed[] {
  const out: CombatantSeed[] = [];
  team.forEach((instanceId, slot) => {
    if (instanceId == null) return;
    const oc = owned.find((o) => o.instanceId === instanceId);
    if (!oc) return;
    const def = CHAR_MAP[oc.charId];
    if (!def) return;
    const c = characterCombat(oc, gear);
    out.push({
      uid: `p${slot}`, defId: def.id, name: def.name, slot, side: 'party', role: def.role, element: def.element,
      level: oc.level, rarity: def.rarity, stats: c.stats,
      skills: c.actives.map((a) => ({ id: a.def.id, name: a.def.name, level: a.level })),
      mods: c.mods,
    });
  });
  return out;
}

export function foeSeeds(stageId: number, waveIndex = 0): CombatantSeed[] {
  const stage = STAGE_MAP[stageId];
  const mult = stageMult(stage.id);
  return stage.waves[waveIndex].monsters.map((m, i) => {
    const md = MONSTER_MAP[m.id];
    const c = monsterCombat(md, m.level, mult);
    return {
      uid: `f${i}`, defId: md.id, name: md.name, slot: i, side: 'foe' as const, role: md.role, element: md.element,
      level: m.level, stats: c.stats, skills: c.actives.map((a) => ({ id: a.def.id, name: a.def.name, level: 1 })),
      mods: {}, boss: !!stage.boss && i === 0,
    };
  });
}

/** Build skill runtimes keyed by uid for the engine. */
export function skillIndex(owned: OwnedCharacter[], gear: OwnedGear[], team: (number | null)[], foes: CombatantSeed[]) {
  const map = new Map<string, RuntimeSkill[]>();
  team.forEach((instanceId, slot) => {
    if (instanceId == null) return;
    const oc = owned.find((o) => o.instanceId === instanceId);
    if (!oc) return;
    const c = characterCombat(oc, gear);
    map.set(`p${slot}`, c.actives.map(runtimeToSeedSkill) as unknown as RuntimeSkill[]);
  });
  for (const f of foes) {
    const md = MONSTER_MAP[f.defId];
    map.set(f.uid, monsterCombat(md, f.level, 1).actives.map(runtimeToSeedSkill) as unknown as RuntimeSkill[]);
  }
  return (uidKey: string) => map.get(uidKey) ?? [];
}

export function makeBattle(stageId: number, owned: OwnedCharacter[], gear: OwnedGear[], team: (number | null)[], seed: number) {
  const party = partySeeds(owned, gear, team);
  const foes = foeSeeds(stageId);
  const idx = skillIndex(owned, gear, team, foes);
  const st = initBattle({ stageId, seed, maxRounds: 30, party, foes }, (u) => idx(u.uid));
  return { st, idx };
}

export { currentUnit, partyPreview, playerAct, foeChoose, foeApply, advanceToNextTurn, partyTurnOpen, usableSkills, rollDice, actSkill, finishTurn, eff, hasStatus, aliveAllies, isFrozen, isShocked };
export type { BattleState };
