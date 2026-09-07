'use client';
import { create } from 'zustand';
import type { PlayerSnapshot } from '../game/types';
import { audio } from '../game/audio/synth';
import { apiFetch } from '../game/offline/fetch';

export interface AudioPrefs { muted: boolean; volume: number; music: boolean }

interface GameState {
  ready: boolean;
  dbOnline: boolean;
  snapshot: PlayerSnapshot | null;
  error: string | null;
  busy: boolean;
  toast: { id: number; text: string; tone: 'ok' | 'bad' | 'gold' } | null;
  audio: AudioPrefs;

  boot: () => Promise<void>;
  refresh: () => Promise<void>;
  post: (path: string, body?: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string }>;
  setSnapshot: (s: PlayerSnapshot) => void;
  notify: (text: string, tone?: 'ok' | 'bad' | 'gold') => void;
  setAudioPrefs: (p: Partial<AudioPrefs>) => void;
  sfx: (n: Parameters<typeof audio extends () => infer A ? never : never>[0] | string) => void;
}

const LS_AUDIO = 'vain_audio_prefs';

function loadAudioPrefs(): AudioPrefs {
  if (typeof window === 'undefined') return { muted: false, volume: 0.75, music: true };
  try {
    const raw = localStorage.getItem(LS_AUDIO);
    if (raw) return { muted: false, volume: 0.75, music: true, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { muted: false, volume: 0.75, music: true };
}

export const useGame = create<GameState>((set, get) => ({
  ready: false,
  dbOnline: true,
  snapshot: null,
  error: null,
  busy: false,
  toast: null,
  audio: loadAudioPrefs(),

  boot: async () => {
    const prefs = get().audio;
    set({ busy: true, error: null });
    try {
      const res = await apiFetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.error ?? 'load-failed');
      set({ snapshot: j.data.snapshot as PlayerSnapshot, dbOnline: (j.data.db as { ok: boolean }).ok, ready: true, busy: false });
    } catch (e) {
      set({ ready: true, dbOnline: false, error: e instanceof Error ? e.message : String(e), busy: false });
    }
    void prefs;
  },

  refresh: async () => {
    try {
      const res = await apiFetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const j = await res.json();
      if (j?.ok) set({ snapshot: j.data.snapshot as PlayerSnapshot, dbOnline: true, error: null });
    } catch { set({ dbOnline: false }); }
  },

  post: async (path, body) => {
    set({ busy: true });
    try {
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const j = await res.json().catch(() => ({}));
      set({ busy: false });
      if (!res.ok || !j.ok) {
        const msg = j?.error === 'INSUFFICIENT_GEM' ? 'Không đủ Ngọc!'
          : j?.error === 'NO_GOLD' ? 'Không đủ Vàng!'
            : j?.error === 'NO_SP' ? 'Không đủ Điểm Kỹ Năng!'
              : j?.error === 'TEAM_FULL' ? 'Đội đã đủ 5 người!'
                : j?.error === 'LEVEL_GATE' ? 'Cấp tướng chưa đủ để cường hóa thêm!'
                  : j?.error === 'UNEQUIPPED_CAP' ? 'Đồ chưa mặc chỉ tăng cấp tới +3!'
                    : j?.error === 'PLUS_GATE' ? 'Cường hóa tối đa bằng cấp tướng đang mặc!'
                      : j?.error === 'CLASS_LOCKED' ? 'Trang bị này không dành cho class đó!'
                        : j?.error === 'LOCKED' ? 'Tướng đang bị khóa!'
                          : j?.error === 'SOLD_OUT' ? 'Đã bán hết!'
                            : j?.error ?? 'Có lỗi xảy ra';
        get().notify(msg, 'bad');
        audio().sfx('error');
        return { ok: false, error: msg };
      }
      const data = j.data as { snapshot?: PlayerSnapshot } & Record<string, unknown>;
      if (data?.snapshot) {
        set({ snapshot: data.snapshot });
      } else {
        // mutation endpoints that don't return a snapshot: pull one so the UI stays live
        try {
          const res2 = await apiFetch('/api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
          const j2 = await res2.json();
          if (j2?.ok) set({ snapshot: j2.data.snapshot as PlayerSnapshot });
        } catch { /* ignore */ }
      }
      return { ok: true, data };
    } catch (e) {
      set({ busy: false });
      get().notify('Mất kết nối máy chủ lưu trữ', 'bad');
      return { ok: false, error: e instanceof Error ? e.message : 'network' };
    }
  },

  setSnapshot: (s) => set({ snapshot: s }),

  notify: (text, tone = 'ok') => {
    const id = Date.now();
    set({ toast: { id, text, tone } });
    setTimeout(() => { if (get().toast?.id === id) set({ toast: null }); }, 2200);
  },

  setAudioPrefs: (p) => {
    const next = { ...get().audio, ...p };
    set({ audio: next });
    try { localStorage.setItem(LS_AUDIO, JSON.stringify(next)); } catch { /* ignore */ }
    const a = audio();
    a.setMuted(next.muted);
    a.setVolume(next.volume);
    if (!next.muted && next.music) a.playMusic('menu');
  },

  sfx: (n) => { audio().sfx(n as never); },
}));

export function useSnapshot() { return useGame((s) => s.snapshot); }
export function useGold() { return useGame((s) => s.snapshot?.gold ?? 0); }
export function useGem() { return useGame((s) => s.snapshot?.gem ?? 0); }
