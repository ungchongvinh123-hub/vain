import type { RngState } from './types';

/** Deterministic 128-bit xorshift PRNG. State is serialisable so the server can replay battles. */
export function seedRng(seed: number): RngState {
  let s0 = (seed ^ 0x9e3779b9) >>> 0;
  let s1 = (seed * 0x85ebca6b + 0xc2b2ae35) >>> 0;
  let s2 = (seed * 0x27d4eb2f ^ 0x165667b1) >>> 0;
  let s3 = (seed + 0x9e3779b91) >>> 0;
  if (!s0) s0 = 0x6c078965;
  if (!s1) s1 = 0x1b873593;
  if (!s2) s2 = 0xcc9e2d51;
  if (!s3) s3 = 0x1b037337;
  return { s0, s1, s2, s3 };
}

export function cloneRng(s: RngState): RngState { return { ...s }; }

function nextU32(s: RngState): number {
  let t = s.s3;
  const r = s.s0;
  s.s3 = s.s2; s.s2 = s.s1; s.s1 = r;
  t ^= t << 11; t ^= t >>> 8;
  s.s0 = t ^ r ^ (r >>> 19);
  return s.s0 >>> 0;
}

export function rand(s: RngState): number {
  return nextU32(s) / 4294967296;
}

export function randInt(s: RngState, min: number, maxInclusive: number): number {
  return min + Math.floor(rand(s) * (maxInclusive - min + 1));
}

export function pick<T>(s: RngState, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length) % arr.length];
}

export function shuffle<T>(s: RngState, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function chance(s: RngState, pct: number): boolean {
  return rand(s) * 100 < pct;
}

export function weighted<T extends { weight: number }>(s: RngState, items: T[]): T {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let r = rand(s) * total;
  for (const it of items) { r -= it.weight; if (r <= 0) return it; }
  return items[items.length - 1];
}

/** stable string hash → uint32 */
export function hashStr(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
