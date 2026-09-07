import type { CharacterDef, OwnedCharacter, Rarity } from '../types';
import { CHARACTERS } from '../data/characters';
import { GACHA, MAX_LOADOUT } from '../data/constants';
import { defaultLoadout } from './loadout';

export interface PullResult {
  charId: string;
  rarity: Rarity;
  isNew: boolean;
  instanceId?: number;
}

const BY_RARITY: Record<Rarity, CharacterDef[]> = {
  R: CHARACTERS.filter((c) => c.rarity === 'R'),
  SR: CHARACTERS.filter((c) => c.rarity === 'SR'),
  SSR: CHARACTERS.filter((c) => c.rarity === 'SSR'),
};

/**
 * One pull. `pity` counts pulls since the last SSR (soft pity not modelled — the spec
 * fixes flat rates 3/17/80) plus the "10-pull guarantees ≥1 SR" rule which is
 * enforced by the caller via `guaranteeAt`.
 */
export function pullOne(rnd: () => number, opts: { forceSrPlus?: boolean } = {}): CharacterDef {
  const roll = rnd();
  let rarity: Rarity;
  if (opts.forceSrPlus) {
    rarity = roll < GACHA.rates.SSR / (GACHA.rates.SSR + GACHA.rates.SR) ? 'SSR' : 'SR';
  } else if (roll < GACHA.rates.SSR) rarity = 'SSR';
  else if (roll < GACHA.rates.SSR + GACHA.rates.SR) rarity = 'SR';
  else rarity = 'R';
  const pool = BY_RARITY[rarity];
  return pool[Math.floor(rnd() * pool.length) % pool.length];
}

export function rollTen(rnd: () => number): CharacterDef[] {
  const out: CharacterDef[] = [];
  for (let i = 0; i < 10; i++) {
    const force = i === 9 && !out.some((c) => c.rarity !== 'R');
    out.push(pullOne(rnd, { forceSrPlus: force }));
  }
  return out;
}

export function rollSingle(rnd: () => number): CharacterDef {
  return pullOne(rnd);
}

/** instances created from a pull (duplicates stay independent — never merged) */
export function ownedFromPull(def: CharacterDef, startInstanceId: number, rnd: () => number): OwnedCharacter {
  return {
    instanceId: startInstanceId,
    charId: def.id,
    level: 1,
    exp: 0,
    sp: 1 + Math.floor(rnd() * 3),
    skillLevels: {},
    loadout: defaultLoadout(def.id).slice(0, MAX_LOADOUT),
    gear: { weapon: null, armor: null, accessory: null },
    createdAt: Date.now(),
  };
}
