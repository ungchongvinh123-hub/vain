'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '../../game/audio/synth';
import type { QtePromptView } from './types';

/**
 * QTE cluster — sits exactly in the middle of the two zoomed fighters.
 * Deliberately frameless & text-free: pure geometry + colour feedback.
 */
export function QteLayer({ prompt, onResolve }: { prompt: QtePromptView | null; onResolve: (mastery: number) => void }) {
  return (
    <AnimatePresence>
      {prompt && (
        <motion.div
          className="pointer-events-auto absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2"
          initial={{ opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.15 }}
          transition={{ duration: .16 }}
        >
          {prompt.kind === 'focus' && <FocusQte strictness={prompt.strictness} mode={prompt.mode} onResolve={onResolve} />}
          {prompt.kind === 'block' && <FocusQte strictness={Math.max(0.86, prompt.strictness)} mode="incoming" onResolve={onResolve} />}
          {prompt.kind === 'link' && <LinkQte strictness={prompt.strictness} onResolve={onResolve} />}
          {prompt.kind === 'tap' && <TapQte strictness={prompt.strictness} onResolve={onResolve} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------- focus / block (聚力) -------------------------- */

function FocusQte({ strictness, mode, onResolve }: { strictness: number; mode: 'outgoing' | 'incoming'; onResolve: (v: number) => void }) {
  // hard & unpredictable for blocks: tiny window, jittered start, fast sweep
  const incoming = mode === 'incoming';
  const W = incoming ? 360 : 420;
  const zone = Math.max(incoming ? 30 : 44, Math.round((incoming ? 66 : 132) * (1 - strictness * 0.72)));
  const center = W / 2 + (incoming ? (Math.random() - 0.5) * W * 0.42 : (Math.random() - 0.5) * W * 0.2);
  const sweep = incoming ? 620 + strictness * 300 : 1180 - strictness * 360;
  const [leadMs] = useState(() => (incoming ? 140 + Math.random() * 420 : 120));

  const [x, setX] = useState(0);
  const [judged, setJudged] = useState<null | number>(null);
  const done = useRef(false);
  const raf = useRef<number | null>(null);
  const t0 = useRef(0);
  const resolve = useCallback((v: number) => {
    if (done.current) return;
    done.current = true;
    if (raf.current) cancelAnimationFrame(raf.current);
    setJudged(Math.max(0, Math.min(1, v)));
    audio().sfx(v > 0.8 ? 'qteGood' : 'qteMiss');
    window.setTimeout(() => onResolve(Math.max(0, Math.min(1, v))), 230);
  }, [onResolve]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      t0.current = performance.now();
      const loop = (t: number) => {
        const p = Math.min(1, (t - t0.current) / sweep);
        setX(p * W);
        if (p >= 1) resolve(0);
        else raf.current = requestAnimationFrame(loop);
      };
      raf.current = requestAnimationFrame(loop);
    }, leadMs);
    return () => { window.clearTimeout(id); if (raf.current) cancelAnimationFrame(raf.current); };
  }, [leadMs, resolve, sweep]);

  const hit = Math.abs(x - center) <= zone / 2;
  const quality = judged ?? (hit ? 1 - Math.abs(x - center) / (zone / 2) : 0);

  return (
    <div
      className="relative select-none"
      style={{ width: W, height: 96 }}
      onPointerDown={(e) => { e.preventDefault(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); void rect; resolve(quality > 0 ? Math.max(0.35, quality) : 0); }}
    >
      {/* soft glow behind, no frame */}
      <div className="absolute inset-x-[-30px] top-1/2 h-24 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(245,196,83,.16),transparent)]" />
      <div className="qte-focus-track absolute left-0 top-1/2 h-3.5 -translate-y-1/2 rounded-full" style={{ width: W }}>
        <motion.div
          className="absolute top-1/2 h-9 -translate-y-1/2 rounded-md"
          style={{
            width: zone, left: center - zone / 2,
            background: judged != null
              ? (judged > 0.75 ? 'rgba(52,211,153,.85)' : judged > 0.3 ? 'rgba(245,196,83,.7)' : 'rgba(225,29,72,.7)')
              : 'linear-gradient(180deg, rgba(255,233,168,.55), rgba(192,132,252,.35))',
            boxShadow: '0 0 20px rgba(255,233,168,.45)',
          }}
          animate={judged != null ? { scale: [1, 1.25, 1] } : { opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 0.3 }}
        />
        {/* sweeping needle */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: x, transform: `translate(-50%, -50%)` }}
        >
          <div className="h-14 w-[3px] rounded-full bg-white shadow-[0_0_14px_2px_rgba(255,255,255,.8)]" />
        </div>
      </div>
      {/* charge bloom under the needle */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2" style={{ width: x }}>
        <div className="h-[3px] w-full rounded-full" style={{ background: hit ? 'rgba(52,211,153,.7)' : 'rgba(255,255,255,.28)' }} />
      </div>
      {/* tap-anywhere affordance: expanding ring at the zone centre before judging */}
      {judged == null && (
        <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" style={{ animation: 'ring-out 1.1s ease-out infinite' }} />
      )}
    </div>
  );
}

/* ------------------------------ link 3 dots ------------------------------ */

const TRI = [
  { x: -108, y: 34 },
  { x: 0, y: -74 },
  { x: 108, y: 34 },
];

function LinkQte({ strictness, onResolve }: { strictness: number; onResolve: (v: number) => void }) {
  const [idx, setIdx] = useState(0);
  const [pts, setPts] = useState<{ x: number; y: number; t: number }[]>([]);
  const [done, setDone] = useState(false);
  const startAt = useRef(performance.now());
  const windowMs = 2600 - strictness * 900;

  useEffect(() => {
    const t = window.setTimeout(() => finish(), windowMs + 400);
    return () => window.clearTimeout(t);
  });

  const finish = useCallback(() => {
    if (done) return;
    setDone(true);
    const elapsed = performance.now() - startAt.current;
    const timing = Math.max(0, 1 - Math.max(0, elapsed - windowMs * 0.45) / (windowMs * 0.6));
    let accuracy = 1;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - TRI[idxOf(i)].x, pts[i].y - TRI[idxOf(i)].y);
      accuracy = Math.min(accuracy, 1 - Math.min(1, d / 150) * 0.6);
    }
    const mastery = (pts.length / 3) * (0.55 + 0.45 * timing) * (0.7 + 0.3 * accuracy);
    audio().sfx(mastery > 0.75 ? 'qteGood' : 'qteMiss');
    window.setTimeout(() => onResolve(mastery), 220);
  }, [done, onResolve, pts, windowMs]);

  const handle = (e: React.PointerEvent) => {
    if (done) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const target = TRI[idx];
    const d = Math.hypot(x - target.x, y - target.y);
    if (d < 62) {
      setPts((p) => [...p, { x, y, t: performance.now() }]);
      audio().sfx('qteTick');
      if (idx >= 2) { setIdx(3); finish(); } else setIdx(idx + 1);
    }
  };

  return (
    <div className="relative h-[220px] w-[300px] touch-none select-none" onPointerDown={handle}>
      <svg viewBox="-150 -120 300 240" className="absolute inset-0 h-full w-full overflow-visible">
        {idx > 0 && <path d={`M${pts.slice(0, idx).map((p) => `${p.x},${p.y}`).join(' L')}`} fill="none" stroke="rgba(245,196,83,.9)" strokeWidth="4" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 8px rgba(245,196,83,.7))' }} />}
        {TRI.map((n, i) => {
          const active = i === idx;
          const hitDone = i < idx;
          return (
            <g key={i} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
              <motion.circle
                cx={n.x} cy={n.y}
                r={active ? 30 : 22}
                fill={hitDone ? 'rgba(52,211,153,.22)' : active ? 'rgba(245,196,83,.18)' : 'rgba(255,255,255,.06)'}
                stroke={hitDone ? '#34d399' : active ? '#f5c453' : 'rgba(255,255,255,.35)'}
                strokeWidth={active ? 3 : 1.6}
                animate={active ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                transition={{ duration: .7, repeat: active ? Infinity : 0 }}
              />
              {hitDone && <path d={`M${n.x - 9},${n.y} l6,7 l12,-14`} fill="none" stroke="#34d399" strokeWidth="3.4" strokeLinecap="round" />}
            </g>
          );
        })}
        {/* countdown ring for the window */}
        {!done && (
          <motion.circle
            cx="0" cy="0" r="112" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="2" strokeDasharray="704"
            initial={{ strokeDashoffset: 0 }} animate={{ strokeDashoffset: 704 }} transition={{ duration: (windowMs + 400) / 1000, ease: 'linear' }}
          />
        )}
      </svg>
    </div>
  );
}
function idxOf(i: number) { return Math.min(2, i); }

/* ------------------------------- rapid tap ------------------------------- */

const TAP_MAX = 10;

function TapQte({ strictness, onResolve }: { strictness: number; onResolve: (v: number) => void }) {
  const [taps, setTaps] = useState(0);
  const [done, setDone] = useState(false);
  const windowMs = 1500 + (1 - strictness) * 600;
  const start = useRef(performance.now());

  const finish = useCallback((count: number) => {
    if (done) return;
    setDone(true);
    const ratio = Math.min(1, count / TAP_MAX);
    const mastery = 0.25 + ratio * 0.75 * (count >= TAP_MAX ? 1 : 0.92);
    audio().sfx(mastery > 0.8 ? 'qteGood' : 'qteMiss');
    window.setTimeout(() => onResolve(mastery), 200);
  }, [done, onResolve]);

  useEffect(() => {
    const t = window.setTimeout(() => finish(taps), Math.max(120, windowMs - (performance.now() - start.current)));
    return () => window.clearTimeout(t);
  });

  return (
    <div
      className="relative grid h-[230px] w-[230px] touch-none select-none place-items-center"
      onPointerDown={(e) => {
        e.preventDefault();
        if (done) return;
        const n = Math.min(TAP_MAX, taps + 1);
        setTaps(n);
        audio().sfx('qteTick');
        if (n >= TAP_MAX) finish(n);
      }}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
        <motion.circle
          cx="100" cy="100" r="86" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="7"
        />
        {Array.from({ length: TAP_MAX }).map((_, i) => {
          const a = (i / TAP_MAX) * Math.PI * 2;
          const cx = 100 + Math.cos(a) * 86, cy = 100 + Math.sin(a) * 86;
          const lit = i < taps;
          return <circle key={i} cx={cx} cy={cy} r={lit ? 9 : 5.5} fill={lit ? '#f5c453' : 'rgba(255,255,255,.25)'} style={{ filter: lit ? 'drop-shadow(0 0 8px rgba(245,196,83,.9))' : undefined }} />;
        })}
        <motion.circle
          cx="100" cy="100" r="52" fill="url(#tapg)"
          animate={{ scale: taps ? [1, 1.16, 1] : 1 }} transition={{ duration: .16 }}
        />
        <defs>
          <radialGradient id="tapg"><stop offset="0%" stopColor="rgba(255,233,168,.5)" /><stop offset="100%" stopColor="rgba(168,85,247,.12)" /></radialGradient>
        </defs>
        <motion.text
          x="100" y="112" textAnchor="middle" fontSize="44" fontWeight={800} fill="#fff"
          animate={{ scale: [1, 1.1, 1] }} transition={{ duration: .14 }} key={taps}
        >
          {taps}
        </motion.text>
      </svg>
      {/* shrinking window ring */}
      {!done && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/20"
          initial={{ scale: 1.12, opacity: .8 }} animate={{ scale: .92, opacity: .25 }}
          transition={{ duration: windowMs / 1000, ease: 'linear' }}
        />
      )}
    </div>
  );
}
