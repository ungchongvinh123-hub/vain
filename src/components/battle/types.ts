import type { Element, QteKind, Rarity, Role, StatusKind } from '../../game/types';

export interface SkillView {
  id: string;
  name: string;
  element: Element;
  cost: number;
  target: string;
  icon: string;
  desc: string;
  tags: string[];
  qte?: QteKind;
  strictness?: number;
  hits?: number;
  level: number;
  effects: unknown[];
}

export interface UnitSeedView {
  uid: string;
  defId: string;
  sprite: string;
  name: string;
  title?: string;
  slot: number;
  side: 'party' | 'foe';
  role: Role;
  element: Element;
  level: number;
  rarity?: Rarity;
  boss?: boolean;
  stats: { hp: number; hpMax: number; atk: number; def: number; spd: number; critRate: number; critDmg: number; resist: number };
  skills: SkillView[];
  visual?: { roleLabel: string; elementLabel: string; rarityColor: string };
}

export interface BattleConfigView {
  stageId: number;
  seed: number;
  name: string;
  desc: string;
  boss: boolean;
  maxRounds: number;
  party: UnitSeedView[];
  foes: UnitSeedView[];
  reward: { gold: number; gem: number; exp: number; firstClearGold: number };
}

export type Pose = 'idle' | 'attack' | 'skill' | 'hit' | 'dead';

export interface UnitView {
  uid: string;
  sprite: string;
  name: string;
  side: 'party' | 'foe';
  slot: number;
  role: Role;
  element: Element;
  level: number;
  boss?: boolean;
  hp: number;
  hpMax: number;
  mana: number;
  statuses: { kind: StatusKind; turns: number; potency: number }[];
  pose: Pose;
  poseKey: number;
  alive: boolean;
  skills: SkillView[];
  rarity?: Rarity;
}

export interface FloatNumber {
  id: number;
  uid: string;
  text: string;
  kind: 'damage' | 'crit' | 'heal' | 'status' | 'counter' | 'shield' | 'block' | 'miss' | 'info';
}

export interface QtePromptView {
  kind: QteKind;
  strictness: number;
  actorUid: string;
  targetUids: string[];
  /** 'incoming' = the player must block a foe strike */
  mode: 'outgoing' | 'incoming';
}

export type FlowPhase = 'intro' | 'dice' | 'action' | 'clash' | 'result';

/* -------------------------------------------------------------------------- *
 * View diffing — every battle action rebuilds UnitViews from the (mutating)
 * engine, and `Arena` used to re-render every unit row on every sync even when
 * nothing visible changed. These helpers compare only the fields the battle UI
 * actually RENDERS (not object identity), so a sync can bail out and a memoised
 * Arena row can skip re-rendering for untouched units.
 * -------------------------------------------------------------------------- */

export function sameStatusList(a: UnitView['statuses'], b: UnitView['statuses']): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].kind !== b[i].kind || a[i].turns !== b[i].turns || a[i].potency !== b[i].potency) return false;
  }
  return true;
}

export function sameUnitView(a: UnitView, b: UnitView): boolean {
  if (a === b) return true;
  return a.uid === b.uid && a.sprite === b.sprite && a.name === b.name && a.side === b.side
    && a.slot === b.slot && a.role === b.role && a.element === b.element && a.level === b.level
    && a.boss === b.boss && a.hp === b.hp && a.hpMax === b.hpMax && a.mana === b.mana
    && a.pose === b.pose && a.poseKey === b.poseKey && a.alive === b.alive && a.rarity === b.rarity
    && a.skills === b.skills && sameStatusList(a.statuses, b.statuses);
}

/** float numbers are identified by their monotonic id — same id list = same numbers */
export function sameFloatNumbers(a: FloatNumber[] | undefined, b: FloatNumber[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id) return false;
  return true;
}
