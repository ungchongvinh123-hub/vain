'use client';
import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

export function Die({ value, size = 150, rolling }: { value: number; size?: number; rolling?: boolean }) {
  const [face, setFace] = useState(value || 6);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!rolling) { setFace(value || 6); return; }
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 70) { last = t; setFace(1 + Math.floor(Math.random() * 6)); }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [rolling, value]);

  const pips = PIPS[face] ?? PIPS[1];
  return (
    <motion.div
      className="dice-face relative grid place-items-center rounded-[22%] border border-white/30"
      style={{ width: size, height: size }}
      animate={rolling
        ? { rotateX: [0, 220, 420, 620], rotateY: [0, -180, -360, -540], y: [0, -60, 0, -30, 0], scale: [1, 1.06, .96, 1] }
        : { rotateX: 0, rotateY: 0, y: 0, scale: 1 }}
      transition={rolling ? { duration: 0.9, ease: 'easeInOut' } : { type: 'spring', stiffness: 420, damping: 16 }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full p-[14%]">
        {pips.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={9.2} className="dice-pip" fill="url(#pipg)" />
        ))}
        <defs>
          <radialGradient id="pipg" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#6b4f9e" />
            <stop offset="100%" stopColor="#140d22" />
          </radialGradient>
        </defs>
      </svg>
      <div className="pointer-events-none absolute inset-0 rounded-[22%]" style={{ boxShadow: 'inset 0 8px 16px rgba(255,255,255,.45), inset 0 -10px 18px rgba(60,30,90,.35)' }} />
    </motion.div>
  );
}

/** big centre-screen dice presentation shown whenever a unit's turn opens */
export function DiceOverlay({
  faces, total, bonus, rolling, name, manaPips,
}: {
  faces: number[]; total: number; bonus: boolean; rolling: boolean; name: string; manaPips?: number;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-40 grid place-items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(closest-side,rgba(20,10,36,.86),rgba(5,4,10,.96))]" />
      <motion.div
        className="relative flex flex-col items-center gap-5"
        initial={{ scale: .8, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      >
        <div className="flex items-end gap-6">
          {faces.length === 0 || rolling ? (
            <Die value={6} size={190} rolling />
          ) : (
            faces.map((f, i) => <Die key={i} value={f} size={faces.length > 1 ? 150 : 190} />)
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="text-[11px] uppercase tracking-[.4em] text-gild/80">{rolling ? 'gieo xúc xắc' : `${name} — ${total} điểm`}</div>
          <div className="flex gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.span
                key={i}
                className="h-3.5 w-6 rounded-sm border"
                initial={{ opacity: .25, background: 'transparent' }}
                animate={i < total
                  ? { opacity: 1, background: 'linear-gradient(180deg,#ffe9a8,#c08a1e)', borderColor: '#f5c453', boxShadow: '0 0 12px rgba(245,196,83,.7)' }
                  : { opacity: .22, background: 'transparent', borderColor: 'rgba(255,255,255,.2)' }}
                transition={{ delay: rolling ? 0 : 0.05 * i, duration: .22 }}
              />
            ))}
          </div>
          {bonus && !rolling && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] uppercase tracking-[.22em] text-emerald-300">
              +1 nội tại trang bị
            </motion.div>
          )}
          {manaPips != null && !bonus && <div className="h-[13px]" />}
        </div>
      </motion.div>
    </motion.div>
  );
}
