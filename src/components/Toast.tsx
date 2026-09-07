'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '../store/game';

export function Toast() {
  const toast = useGame((s) => s.toast);
  const tones: Record<string, string> = {
    ok: 'border-emerald-400/50 bg-emerald-950/85 text-emerald-100',
    bad: 'border-rose-500/50 bg-[#2a0b12]/90 text-rose-100',
    gold: 'border-gild/50 bg-[#241a06]/90 text-amber-100',
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-[60] flex flex-col items-center gap-1">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -14, scale: .96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: .98 }}
            transition={{ duration: .18 }}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold shadow-[0_14px_34px_-14px_#000] ${tones[toast.tone]}`}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
