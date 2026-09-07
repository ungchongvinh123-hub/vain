'use client';
import { motion } from 'framer-motion';
import { Sprite } from './Sprite';
import { ElementBadge, Icon, ELEMENT_COLORS } from './Icon';
import { RarityBadge, Bar, Chip } from './ui';
import type { OwnedCharacter, OwnedGear } from '../game/types';
import { CHAR_MAP } from '../game/data/characters';
import { GEAR_MAP } from '../game/data/gear';
import { ROLE_META } from '../game/data/constants';
import { characterCombat } from '../game/systems/stats';
import { expProgress } from '../game/systems/loadout';

export function PortraitCard({
  oc, gear, inTeam, onClick, selected, size = 'md', footer, badge,
}: {
  oc: OwnedCharacter;
  gear: OwnedGear[];
  inTeam?: boolean;
  onClick?: () => void;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  const def = CHAR_MAP[oc.charId];
  if (!def) return null;
  const c = characterCombat(oc, gear);
  const rc = ELEMENT_COLORS[def.element];
  const h = size === 'sm' ? 92 : size === 'md' ? 128 : 190;
  const exp = expProgress(oc.level, oc.exp);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: .97 }}
      onClick={onClick}
      className={`group relative flex w-full flex-col overflow-hidden rounded-xl border text-left transition
        ${selected ? 'border-gild shadow-[0_0_22px_-6px_#f5c453]' : inTeam ? 'border-emerald-400/50' : 'border-white/10 hover:border-white/30'}`}
      style={{ background: `linear-gradient(180deg, ${rc}14, rgba(5,4,10,.9) 55%)` }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${rc}, transparent)` }} />
      <div className="relative flex items-end justify-center px-1 pt-1" style={{ height: h + 12 }}>
        <Sprite defId={def.id} pose="idle" className="pointer-events-none" style={{ height: h }} />
        <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
          <RarityBadge rarity={def.rarity} size="sm" />
          {inTeam && <span className="rounded bg-emerald-400/90 px-1 text-[8px] font-black text-black">ĐỘI</span>}
          {badge}
        </div>
        <div className="absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
          <ElementBadge element={def.element} size={18} />
          {oc.sp > 0 && <Chip tone="gold" className="!py-0">SP {oc.sp}</Chip>}
        </div>
      </div>
      <div className="relative px-2 pb-1.5">
        <div className="flex items-baseline justify-between gap-1">
          <span className="truncate text-[12px] font-bold text-white/90">{def.name}</span>
          <span className="shrink-0 text-[10px] font-black text-gild">Lv{oc.level}</span>
        </div>
        <div className="truncate text-[9px] uppercase tracking-[.14em] text-white/40">{ROLE_META[def.role].vn} · {def.title}</div>
        <div className="mt-1 grid grid-cols-3 gap-1 text-[9px] text-white/55">
          <span className="flex items-center gap-0.5"><Icon name="heal" size={9} color="#34d399" />{(c.stats.hpMax / 1000).toFixed(1)}k</span>
          <span className="flex items-center gap-0.5"><Icon name="sword" size={9} color="#fb7185" />{c.stats.atk}</span>
          <span className="flex items-center gap-0.5"><Icon name="shield" size={9} color="#60a5fa" />{c.stats.def}</span>
        </div>
        <div className="mt-1"><Bar pct={exp} height={3} color="#a855f7" /></div>
        {footer}
      </div>
    </motion.button>
  );
}

export function gearSummary(oc: OwnedCharacter, gear: OwnedGear[]) {
  return (['weapon', 'armor', 'accessory'] as const).map((slot) => {
    const id = oc.gear[slot];
    const inst = id == null ? null : gear.find((g) => g.instanceId === id) ?? null;
    const def = inst ? GEAR_MAP[inst.gearId] : null;
    return { slot, inst, def, plus: inst?.plus ?? 0 };
  });
}
