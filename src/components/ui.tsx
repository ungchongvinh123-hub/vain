'use client';
import { motion } from 'framer-motion';
import { useRef, useState, type ReactNode } from 'react';
import { audio } from '../game/audio/synth';
import type { Rarity } from '../game/types';
import { RARITY_META } from '../game/data/constants';

export function Panel({ children, className = '', glow }: { children: ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`relative rounded-xl border border-white/10 bg-void-900/85 backdrop-blur-[2px] shadow-card ${glow ? 'shadow-glow' : ''} ${className}`}>
      <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      {children}
    </div>
  );
}

export function Btn({
  children, onClick, disabled, tone = 'violet', size = 'md', className = '', icon, full, sound = 'ui',
}: {
  children?: ReactNode; onClick?: () => void; disabled?: boolean;
  tone?: 'violet' | 'gold' | 'danger' | 'ghost' | 'green' | 'blue';
  size?: 'sm' | 'md' | 'lg'; className?: string; icon?: ReactNode; full?: boolean; sound?: 'ui' | 'select' | 'coin' | null;
}) {
  const tones: Record<string, string> = {
    violet: 'from-void-600 to-void-800 border-arcane/45 text-violet-100 hover:border-arcane',
    gold: 'from-[#5a4513] to-[#241a06] border-gild/50 text-amber-100 hover:border-gild',
    danger: 'from-[#4a1424] to-[#1e0910] border-blood/50 text-rose-100 hover:border-blood',
    green: 'from-[#123324] to-[#081410] border-emerald-500/50 text-emerald-100 hover:border-emerald-400',
    blue: 'from-[#122b45] to-[#081019] border-sky-400/50 text-sky-100 hover:border-sky-300',
    ghost: 'from-white/[.04] to-transparent border-white/10 text-white/80 hover:border-white/30',
  };
  const sizes: Record<string, string> = {
    sm: 'h-8 px-2.5 text-[11px] rounded-lg gap-1',
    md: 'h-10 px-3.5 text-[13px] rounded-xl gap-1.5',
    lg: 'h-12 px-5 text-[15px] rounded-xl gap-2',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) { audio().sfx('error'); return; }
        if (sound) audio().sfx(sound);
        onClick?.();
      }}
      className={`relative inline-flex items-center justify-center overflow-hidden border bg-gradient-to-b font-semibold tracking-wide shadow-inset
        transition-[filter,border-color,transform] active:translate-y-[1px] disabled:opacity-40 disabled:saturate-[.35] ${tones[tone]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function Bar({ pct, color, label, sub, height = 8, glow }: { pct: number; color: string; label?: string; sub?: ReactNode; height?: number; glow?: boolean }) {
  const w = Math.max(0, Math.min(1, pct));
  return (
    <div className="relative w-full overflow-hidden rounded-full border border-black/50 bg-black/60" style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)`, boxShadow: glow ? `0 0 10px ${color}` : undefined }}
        animate={{ width: `${w * 100}%` }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      />
      {label != null && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90 stroke-text">{label}</span>}
      {sub}
    </div>
  );
}

export function RarityBadge({ rarity, size = 'md' }: { rarity: Rarity; size?: 'sm' | 'md' }) {
  const m = RARITY_META[rarity];
  return (
    <span
      className={`inline-flex items-center rounded-md border font-black uppercase leading-none tracking-widest ${size === 'sm' ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'}`}
      style={{ color: m.color, borderColor: `${m.color}88`, background: `${m.color}18`, boxShadow: `0 0 10px ${m.glow}` }}
    >
      {rarity}
    </span>
  );
}

/** Press & hold popover: shows on pointerdown, hides on pointerup/leave/cancel. */
export function HoldPopover({ content, children, className = '', width = 268, placement = 'top' }: {
  content: ReactNode; children: ReactNode; className?: string; width?: number; placement?: 'top' | 'bottom';
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const show = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 24);
  };
  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  };
  return (
    <div
      className={`relative ${className}`}
      onPointerDown={show}
      onPointerUp={hide}
      onPointerLeave={hide}
      onPointerCancel={hide}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: placement === 'top' ? 8 : -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.13 }}
          className="pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded-lg border border-arcane/40 bg-void-950/97 p-2.5 text-[11px] leading-relaxed text-white/90 shadow-[0_18px_40px_-12px_#000]"
          style={{ width, [placement === 'top' ? 'bottom' : 'top']: 'calc(100% + 8px)' } as React.CSSProperties}
        >
          {content}
        </motion.div>
      )}
    </div>
  );
}

export function Chip({ children, tone = 'white', className = '' }: { children: ReactNode; tone?: 'white' | 'gold' | 'red' | 'green' | 'blue' | 'violet'; className?: string }) {
  const tones: Record<string, string> = {
    white: 'border-white/15 bg-white/5 text-white/75',
    gold: 'border-gild/45 bg-gild/10 text-amber-200',
    red: 'border-blood/45 bg-blood/10 text-rose-200',
    green: 'border-emerald-400/45 bg-emerald-400/10 text-emerald-200',
    blue: 'border-sky-400/45 bg-sky-400/10 text-sky-200',
    violet: 'border-arcane/45 bg-arcane/10 text-violet-200',
  };
  return <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[10px] font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <h2 className="font-display text-[13px] uppercase tracking-[0.28em] text-gild/90">{children}</h2>
      {right}
    </div>
  );
}

export function Currency({ icon, value, tone }: { icon: ReactNode; value: number; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[12px] font-bold tabular-nums" style={{ color: tone }}>
      {icon}
      {value.toLocaleString('vi-VN')}
    </span>
  );
}
