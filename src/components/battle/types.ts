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
