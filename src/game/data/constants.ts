import type { Element, Rarity, Role } from '../types';

/**
 * Elemental counter matrix. Mutual counters deal x1.5.
 * Fire <-> Ice, Thunder <-> Nature(poison), Holy <-> Dark. Everything else 1.0.
 * Neutral neither takes nor deals bonus damage.
 */
const COUNTERS: Partial<Record<Element, Element>> = {
  fire: 'ice',
  ice: 'fire',
  thunder: 'nature',
  nature: 'thunder',
  holy: 'dark',
  dark: 'holy',
};

export function counters(a: Element, b: Element): boolean {
  return COUNTERS[a] === b;
}

/** multiplier applied to damage dealt from element `a` to element `b` */
export function elementMult(a: Element, b: Element): number {
  if (counters(a, b)) return 1.5;
  return 1;
}

export const ELEMENT_META: Record<Element, { label: string; vn: string; color: string; soft: string; glyph: string }> = {
  fire: { label: 'Fire', vn: 'Lửa', color: '#ff6b3d', soft: '#ffd0b0', glyph: 'flame' },
  ice: { label: 'Ice', vn: 'Băng', color: '#63d2ff', soft: '#c9f0ff', glyph: 'snow' },
  thunder: { label: 'Thunder', vn: 'Sét', color: '#ffd93d', soft: '#fff3b0', glyph: 'bolt' },
  nature: { label: 'Nature', vn: 'Độc', color: '#7ee081', soft: '#d0f7c9', glyph: 'leaf' },
  holy: { label: 'Holy', vn: 'Thánh', color: '#ffe9a8', soft: '#fffbe0', glyph: 'sun' },
  dark: { label: 'Dark', vn: 'Hắc Ám', color: '#a855f7', soft: '#e2ccff', glyph: 'moon' },
  neutral: { label: 'Neutral', vn: 'Vô thuộc tính', color: '#c9c6d6', soft: '#eee9f5', glyph: 'star' },
};

export const ROLE_META: Record<Role, { vn: string; en: string; color: string; desc: string }> = {
  tank: { vn: 'Đỡ Đòn', en: 'Tank', color: '#7aa2ff', desc: 'Máu & Thủ cao, Aggro lớn — quái ưu tiên nhắm vào.' },
  attacker: { vn: 'Tấn Công', en: 'Attacker', color: '#ff6b6b', desc: 'ATK, Chí mạng & Sát thương chí mạng cao nhất.' },
  support: { vn: 'Hỗ Trợ', en: 'Support', color: '#4ade80', desc: 'Cân bằng Máu/Thủ, chuyên Hồi máu – Giải hiệu ứng – Buff.' },
};

export const RARITY_META: Record<Rarity, { vn: string; color: string; glow: string; statMult: number; weight: number }> = {
  R: { vn: 'Thường', color: '#7dd3fc', glow: 'rgba(125,211,252,.55)', statMult: 1.0, weight: 80 },
  SR: { vn: 'Hiếm', color: '#c084fc', glow: 'rgba(192,132,252,.6)', statMult: 1.12, weight: 17 },
  SSR: { vn: 'Cực Hiếm', color: '#f5c453', glow: 'rgba(245,196,83,.75)', statMult: 1.28, weight: 3 },
};

/** Aggro weight used by monster AI target selection. */
export const AGGRO: Record<Role, number> = { tank: 3.2, attacker: 1, support: 0.85 };

/* -------------------------------- progression -------------------------------- */

export const MAX_LEVEL = 50;
export const MAX_SKILL_LEVEL = 5;
export const MAX_GEAR_PLUS = 15;
export const GEAR_STEP_PCT = 0.15;
export const MAX_TEAM = 5;
export const MAX_LOADOUT = 6;
export const MAX_MANA = 6;
export const BASE_GEAR_PLUS_UNEQUIPPED = 3;
export const SP_PER_LEVEL = 2;

/** total exp required to advance from level → level+1 */
export function expToNext(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.round(120 * Math.pow(level, 1.62) + 80 * level);
}

/** stat growth multiplier at a level (1 at Lv.1) */
export function levelMult(level: number): number {
  return 1 + (level - 1) * 0.036 + Math.pow(Math.max(0, level - 20), 1.35) * 0.0032;
}

export function spReward(level: number, stageDifficulty: number): number {
  return Math.max(1, Math.round(1 + level * 0.08 + stageDifficulty * 0.5));
}

export function skillUpgradeCost(level: number): { sp: number; gold: number } {
  return { sp: level * 2 + 1, gold: 180 * Math.pow(level, 1.75) };
}

export function gearUpgradeCost(plus: number, rarity: Rarity): { gold: number; ok: boolean } {
  if (plus >= MAX_GEAR_PLUS) return { gold: 0, ok: false };
  const r = rarity === 'SSR' ? 3 : rarity === 'SR' ? 1.9 : 1;
  return { gold: Math.round((240 + Math.pow(plus + 1, 2.15) * 95) * r), ok: true };
}

export const GACHA = {
  single: 100,
  ten: 900,
  rates: { SSR: 0.03, SR: 0.17, R: 0.8 } as Record<Rarity, number>,
  /** every 10-pull guarantees at least one SR+ */
  pityTen: 10,
};

/** Stage 1..10 difficulty multipliers applied to monster base stats. */
export function stageMult(stageId: number): number {
  return 1 + (stageId - 1) * 0.285 + (stageId >= 8 ? (stageId - 7) * 0.14 : 0);
}
