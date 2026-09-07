'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Stage } from '../components/Stage';
import { TopBar } from '../components/TopBar';
import { BottomNav } from '../components/BottomNav';
import { Toast } from '../components/Toast';
import { useGame } from '../store/game';
import { audio } from '../game/audio/synth';
import { isOfflineBuild } from '../game/offline/localApi';

export function AppProviders({ children }: { children: ReactNode }) {
  const boot = useGame((s) => s.boot);
  const ready = useGame((s) => s.ready);
  const musicOn = useGame((s) => s.audio.music);
  const muted = useGame((s) => s.audio.muted);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => { void boot(); }, [boot]);

  // audio must start inside a user gesture
  useEffect(() => {
    const onGesture = () => {
      const a = audio();
      a.ensure();
      if (!muted && musicOn) a.playMusic('menu');
      setUnlocked(true);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    return () => { window.removeEventListener('pointerdown', onGesture); window.removeEventListener('keydown', onGesture); };
  }, [musicOn, muted]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (isOfflineBuild()) return; // the APK bundle is already fully local
    const t = window.setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* offline cache is best-effort */ });
    }, 2500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <Stage>
      <div className="flex h-full w-full flex-col">
        <TopBar />
        <main className="relative flex-1 overflow-hidden">
          {!ready ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="font-display text-4xl tracking-[.4em] text-gild title-grad">VAIN</div>
              <div className="text-[11px] uppercase tracking-[.34em] text-white/45">đang mở cánh cổng…</div>
              <div className="h-1 w-64 overflow-hidden rounded bg-white/10">
                <div className="h-full w-1/3 animate-[shimmer_1.1s_linear_infinite] bg-gild" />
              </div>
            </div>
          ) : (
            <>
              {children}
              {!unlocked && (
                <div className="pointer-events-none absolute bottom-3 right-4 z-40 rounded-lg border border-white/15 bg-black/70 px-2.5 py-1 text-[10px] text-white/55">
                  chạm để bật âm thanh synth
                </div>
              )}
            </>
          )}
        </main>
        <BottomNav />
      </div>
      <Toast />
    </Stage>
  );
}
