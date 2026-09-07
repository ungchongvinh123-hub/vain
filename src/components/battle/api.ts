import type { BattleConfigView } from './types';
import { apiFetch } from '@/game/offline/fetch';

export interface ClientActionEntry {
  uid: string;
  skillId?: string;
  targetUid?: string | null;
  mastery?: number;
  blockMastery?: number;
}

export async function fetchBattleConfig(stageId: number): Promise<{ ok: boolean; data?: BattleConfigView; error?: string }> {
  const res = await apiFetch(`/api/battle/${stageId}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const j = await res.json().catch(() => ({}));
  return res.ok && j?.ok ? { ok: true, data: j.data as BattleConfigView } : { ok: false, error: j?.error ?? 'battle-load-failed' };
}

export interface SettleResult {
  verdict: 'win' | 'lose';
  rounds: number;
  totalDamage: number;
  drops: number[];
  rewards: { gold: number; gem: number; exp: number };
  progress: number;
  tampered: boolean;
  claimedWin: boolean;
  exp: Record<string, number>;
  sp: Record<string, number>;
}

export async function settleBattle(body: {
  stageId: number; seed: number; claimedWin: boolean; actions: ClientActionEntry[]; durationMs?: number;
}): Promise<{ ok: boolean; data?: SettleResult & { snapshot?: unknown }; error?: string }> {
  const res = await apiFetch('/api/stage/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  return res.ok && j?.ok ? { ok: true, data: j.data } : { ok: false, error: j?.error ?? 'settle-failed' };
}
