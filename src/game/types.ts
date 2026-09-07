/** VAIN — core game types. Shared by client, server and the deterministic battle engine. */

export type Element = 'fire' | 'ice' | 'thunder' | 'nature' | 'holy' | 'dark' | 'neutral';
export const ELEMENTS: Element[] = ['fire', 'ice', 'thunder', 'nature', 'holy', 'dark', 'neutral'];

export type Role = 'tank' | 'attacker' | 'support';
export type Rarity = 'R' | 'SR' | 'SSR';
export const RARITIES: Rarity[] = ['R', 'SR', 'SSR'];

export type EquipSlot = 'weapon' | 'armor' | 'accessory';
export type WeaponKind =
  | 'sword' | 'bow' | 'blade' | 'shield' | 'greatsword' | 'staff' | 'tome' | 'orb';

export type StatusKind =
  | 'burn' | 'poison' | 'freeze' | 'shock' | 'regen' | 'shield' | 'atkUp' | 'defUp' | 'atkDown' | 'defDown' | 'taunt';

export type QteKind = 'focus' | 'link' | 'tap' | 'block';

/* ---------------------------------- effects --------------------------------- */

export type EffectTargetMode =
  | 'enemyOne'      // player chooses one enemy
  | 'enemyAll'
  | 'enemyFront'    // first alive enemy
  | 'enemySpread'   // target + adjacent columns (±1)
  | 'allyOne'
  | 'allyAll'
  | 'allyLowest'
  | 'self'
  | 'allyDead';     // revive

export type EffectDef =
  | { t: 'damage'; power: number; scale: number; critBonus?: number }
  | { t: 'heal'; power: number; scale: number }
  | { t: 'shield'; power: number; scale: number }
  | { t: 'status'; status: StatusKind; turns: number; potency: number; chance?: number }
  | { t: 'cleanse'; scope: 'debuffs' | 'all'; count: number }
  | { t: 'revive'; healPct: number }
  | { t: 'drain'; power: number; scale: number; healPct: number }
  | { t: 'dispel'; scope: 'buffs'; count: number };

/** Passive stat mods granted by skills (equipped passives) and gear. */
export interface StatMods {
  hpPct?: number;
  atkPct?: number;
  defPct?: number;
  spdPct?: number;
  critRate?: number;      // absolute % points
  critDmg?: number;       // absolute % points
  resist?: number;        // absolute % effect resistance
  diceBonus?: number;     // chance/points of bonus dice
  lifesteal?: number;     // % of damage dealt healed
  dmgOut?: number;        // % increased damage
  dmgIn?: number;         // % increased damage taken (negative = better)
  healOut?: number;       // % increased healing
  execute?: number;       // execute threshold % (0-25)
  killHeal?: number;      // % max hp healed on kill
  procElement?: Element;  // elemental proc on skill
  procChance?: number;    // 0-100
  procTurns?: number;
  skillCostReduce?: number;
}

export type PassiveDef = { id: string; name: string; desc: string } & StatMods;

/* ---------------------------------- skills ---------------------------------- */

export interface SkillDef {
  id: string;
  charId: string;
  name: string;
  /** short name used nowhere in battle UI (icons only) — used in popovers/tooltips */
  desc: string;
  kind: 'active' | 'passive';
  element: Element;
  /** dice cost 0..6 (0 = basic attack) */
  cost: number;
  target: EffectTargetMode;
  effects: EffectDef[];
  /** status effect applied on hit for damage skills */
  procs?: { status: StatusKind; turns: number; potency: number; chance: number }[];
  hits?: number;
  qte?: QteKind;
  qteStrictness?: number;   // 0..1, higher = harder
  tier: number;             // skill tree depth 0..4 (5 = passive wing)
  node: number;             // index within tier
  requires: string[];       // prerequisite skill ids
  maxLevel: number;
  icon: string;
  tags: string[];
  powerMult: number;        // 0..1 how strong (used for scaling & qte weighting)
  /** passive-only: stat modifiers granted (base, before skill-level scaling) */
  passiveMods?: StatMods;
  /** passive-only: character level required to unlock */
  levelGate?: number;
}

/** A concrete skill level resolved from def + level. */
export interface SkillRuntime {
  def: SkillDef;
  level: number;
  effects: EffectDef[];
}

/* -------------------------------- characters -------------------------------- */

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  role: Role;
  element: Element;
  rarity: Rarity;
  seed: number;
  bio: string;
  base: { hp: number; atk: number; def: number; spd: number; critRate: number; critDmg: number; resist: number };
  /** visual parameters for the procedural sprite renderer */
  art: SpriteSpec;
  /** signature skill names forced into the tree (flavour) */
  signature: { activeNames: string[]; passiveNames: string[] };
  weaponKind: WeaponKind;
}

/* ---------------------------------- gear ------------------------------------ */

export type GearPassiveId =
  | 'killHeal' | 'execute' | 'procElement' | 'diceBonus' | 'resist' | 'critRate' | 'critDmg'
  | 'atkPct' | 'defPct' | 'hpPct' | 'spdPct' | 'dmgOut' | 'dmgIn' | 'healOut' | 'lifesteal' | 'costReduce';

export interface GearDef {
  id: string;
  name: string;
  slot: EquipSlot;
  weaponKind?: WeaponKind;
  rarity: Rarity;
  /** which roles may wear it (weapon/armor gating) */
  roles: Role[] | 'all';
  base: { hp?: number; atk?: number; def?: number; spd?: number; critRate?: number; critDmg?: number; resist?: number };
  passives: { id: GearPassiveId; value: number; label: string }[];
  desc: string;
  levelStepPct: number; // 0.15
}

/* ---------------------------------- stages ---------------------------------- */

export interface MonsterDef {
  id: string;
  name: string;
  element: Element;
  role: Role;
  tier: 1 | 2 | 3;
  base: { hp: number; atk: number; def: number; spd: number; critRate: number; critDmg: number; resist: number };
  art: SpriteSpec;
  skills: SkillDef[];
}

export interface StageDef {
  id: number;
  name: string;
  region: 1 | 2 | 3;
  difficulty: number;
  /** monster ids, ordered as they appear on the field */
  waves: { monsters: { id: string; level: number }[] }[];
  reward: { gold: number; gem: number; exp: number; firstClearGold: number };
  drop: { chance: number; table: { gearId: string; weight: number }[] };
  boss?: boolean;
  desc: string;
}

/* ---------------------------------- sprite ---------------------------------- */

export type SpriteState = 'idle' | 'attack' | 'skill' | 'hit' | 'dead';

export interface SpriteSpec {
  /** silhouette / rig style */
  body: 'waifu' | 'brute' | 'beast' | 'wraith' | 'construct' | 'dragon';
  skin: string;
  hair: { color: string; shade: string; style: 'long' | 'twin' | 'pony' | 'short' | 'braid' | 'hood' | 'wild' | 'bald' | 'horns' };
  eyes: { color: string; lashes?: boolean };
  outfit: {
    kind: 'catsuit' | 'gown' | 'armor' | 'robe' | 'prayer' | 'kimono' | 'rags' | 'husk' | 'hide';
    primary: string;
    secondary: string;
    accent: string;
  };
  /** extra flourishes */
  trim?: { cape?: boolean; halo?: boolean; wings?: boolean; scarf?: boolean; hood?: boolean; mask?: boolean; ears?: 'cat' | 'elf' | 'wolf'; weapon?: string; aura?: string; crown?: boolean; } & Record<string, unknown>;
  height?: number;
  bulk?: number;
  element: Element;
}

/* --------------------------------- combat ----------------------------------- */

export interface CombatantStats {
  hp: number;
  hpMax: number;
  atk: number;
  def: number;
  spd: number;
  critRate: number;
  critDmg: number;
  resist: number;
}

export interface StatusInstance {
  kind: StatusKind;
  turns: number;
  potency: number;
  sourceId: string;
  /** for shields: remaining absorb amount */
  value?: number;
}

export interface Combatant {
  uid: string;
  side: 'party' | 'foe';
  slot: number;
  defId: string;
  name: string;
  element: Element;
  role: Role;
  level: number;
  rarity?: Rarity;
  stats: CombatantStats;
  mana: number;
  statuses: StatusInstance[];
  /** character-only */
  skills: SkillRuntime[];
  /** passive modifiers already baked into stats mostly; kept for killHeal/execute etc. */
  mods: StatMods;
  alive: boolean;
  xpGained: number;
  goldGained: number;
  spriteState: SpriteState;
}

export type CombatEvent =
  | { e: 'roundStart'; round: number }
  | { e: 'turnStart'; uid: string; round: number }
  | { e: 'dice'; uid: string; faces: number[]; total: number; bonus: number; rolls: number[][] }
  | { e: 'cast'; uid: string; skillId: string; skillName: string; cost: number; qte?: QteKind; targets: string[]; selfOnly: boolean }
  | { e: 'damage'; from: string; to: string; amount: number; crit: boolean; counter: number; source: 'skill' | 'status' | 'basic' }
  | { e: 'heal'; from: string; to: string; amount: number; kind: 'heal' | 'regen' }
  | { e: 'shield'; to: string; amount: number }
  | { e: 'absorb'; to: string; amount: number; remaining: number }
  | { e: 'status'; from: string; to: string; status: StatusKind; applied: boolean; turns?: number; potency?: number; resisted?: boolean }
  | { e: 'cleanse'; to: string; removed: StatusKind[] }
  | { e: 'dispel'; to: string; removed: StatusKind[] }
  | { e: 'death'; uid: string; killedBy?: string }
  | { e: 'revive'; uid: string; amount: number }
  | { e: 'execute'; uid: string; by: string }
  | { e: 'killHeal'; uid: string; amount: number }
  | { e: 'skip'; uid: string; reason: 'freeze' | 'allDead' }
  | { e: 'block'; uid: string; success: boolean; amount: number }
  | { e: 'qte'; uid: string; kind: QteKind; mastery: number; mult: number }
  | { e: 'foeAct'; uid: string; skillId: string; targets: string[] }
  | { e: 'battleEnd'; win: boolean; rounds: number; tiebreak?: boolean };

export interface RngState { s0: number; s1: number; s2: number; s3: number }

export interface CombatState {
  seed: number;
  stageId: number;
  round: number;
  maxRounds: number;
  party: Combatant[];
  foes: Combatant[];
  /** flat action queue: party slots first, then foes, per round */
  queue: string[];
  /** index into queue */
  cursor: number;
  activeUid: string | null;
  phase: 'intro' | 'partyTurn' | 'foeTurn' | 'over';
  status: 'win' | 'lose' | null;
  rng: RngState;
  log: CombatEvent[];
  diceValue: number;
  history: { uid: string; skillId: string; targetUid: string | null; mastery: number }[];
}

/* --------------------------------- payloads --------------------------------- */

export interface PlayerSnapshot {
  id: number;
  name: string;
  gold: number;
  gem: number;
  pity: number;
  pullCount: number;
  stageProgress: number;
  /** roster entries (each owned copy is independent) */
  owned: OwnedCharacter[];
  team: (number | null)[];
  gear: OwnedGear[];
  purchases: Record<string, number>;
}

export interface OwnedCharacter {
  instanceId: number;
  charId: string;
  level: number;
  exp: number;
  sp: number;
  skillLevels: Record<string, number>;
  loadout: (string | null)[];
  gear: Record<EquipSlot, number | null>;
  createdAt: number;
}

export interface OwnedGear {
  instanceId: number;
  gearId: string;
  plus: number;
  equippedBy: number | null;
}
