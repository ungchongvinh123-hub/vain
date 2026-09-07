'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Fragment, memo } from 'react';
import { Sprite, MagicCircle } from '../Sprite';
import { ElementBadge, Icon } from '../Icon';
import { Bar } from '../ui';
import type { FloatNumber, UnitView } from './types';
import { sameFloatNumbers, sameUnitView } from './types';
import type { StatusKind } from '../../game/types';
import { ELEMENT_COLORS } from '../Icon';

const STATUS_ICON: Record<StatusKind, { icon: string; color: string; label: string }> = {
  burn: { icon: 'flame', color: '#ff6b3d', label: 'Thiêu đốt' },
  poison: { icon: 'leaf', color: '#7ee081', label: 'Ngộ độc' },
  freeze: { icon: 'snow', color: '#63d2ff', label: 'Đóng băng' },
  shock: { icon: 'bolt', color: '#ffd93d', label: 'Tê liệt' },
  regen: { icon: 'heal', color: '#34d399', label: 'Hồi máu' },
  shield: { icon: 'shield', color: '#a5b4fc', label: 'Khiên' },
  taunt: { icon: 'taunt', color: '#f472b6', label: 'Khiêu khích' },
  atkUp: { icon: 'atkUp', color: '#fb7185', label: 'Công +' },
  defUp: { icon: 'defUp', color: '#60a5fa', label: 'Thủ +' },
  atkDown: { icon: 'atkUp', color: '#94a3b8', label: 'Công −' },
  defDown: { icon: 'defUp', color: '#78716c', label: 'Thủ −' },
};

export function StatusRow({ statuses }: { statuses: UnitView['statuses'] }) {
  if (!statuses.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-[3px]">
      {statuses.slice(0, 6).map((s, i) => {
        const meta = STATUS_ICON[s.kind] ?? STATUS_ICON.burn;
        return (
          <span
            key={i}
            className="relative flex h-[15px] w-[15px] items-center justify-center rounded-[4px] border"
            style={{ borderColor: `${meta.color}88`, background: `${meta.color}22` }}
            title={`${meta.label} (${s.turns})`}
          >
            <Icon name={meta.icon} size={10} color={meta.color} />
            <b className="absolute -bottom-[5px] -right-[4px] rounded-full bg-black px-[3px] text-[7px] leading-[10px] text-white/85">{s.turns}</b>
          </span>
        );
      })}
    </div>
  );
}

export function ArenaUnit({
  unit, side, isActive, isTargetable, isSelected, isThreatened, onClick, numbers, small,
}: {
  unit: UnitView;
  side: 'party' | 'foe';
  isActive?: boolean;
  isTargetable?: boolean;
  isSelected?: boolean;
  isThreatened?: boolean;
  onClick?: () => void;
  numbers?: FloatNumber[];
  small?: boolean;
}) {
  const depth = Math.max(0, Math.min(4, unit.slot));
  const toward = side === 'party' ? 1 : -1;
  const scale = (small ? 0.78 : 1) * (1.02 - depth * 0.045);
  const color = ELEMENT_COLORS[unit.element];
  const hpPct = unit.hp / Math.max(1, unit.hpMax);
  const dead = !unit.alive;
  return (
    <div
      className="relative"
      style={{
        width: 190, height: small ? 300 : 372,
        transform: `translate(${toward * depth * -16}px, ${depth * 9}px) scale(${scale})`,
        zIndex: 40 - depth * 5 + (isActive ? 8 : 0),
        opacity: dead ? 0.55 : 1,
        transition: 'opacity .4s ease',
      }}
    >
      {/* targetable hitbox */}
      <button
        type="button"
        onClick={onClick}
        disabled={!isTargetable}
        className={`absolute inset-x-1 bottom-[42px] top-3 z-20 rounded-xl transition
          ${isTargetable ? 'cursor-pointer' : 'pointer-events-none'}
          ${isSelected ? 'ring-2 ring-gild' : ''}
          ${isThreatened ? 'ring-2 ring-blood/80' : ''}`}
        style={{ boxShadow: isTargetable && !isSelected ? `0 0 0 1px ${color}55 inset, 0 0 26px -6px ${color}` : undefined }}
      >
        {isTargetable && !isSelected && (
          <motion.span
            className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-md border border-gild/70 bg-black/70 px-1.5 py-[1px] text-[9px] font-bold text-amber-200"
            animate={{ y: [0, -3, 0] }} transition={{ duration: 1.1, repeat: Infinity }}
          >
            CHỌN
          </motion.span>
        )}
        {isSelected && <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-md bg-gild px-1.5 py-[1px] text-[9px] font-black text-black">MỤC TIÊU</span>}
      </button>

      {/* active glow floor */}
      {isActive && !dead && (
        <motion.div
          className="absolute inset-x-2 bottom-3 z-0 h-16 rounded-[50%]"
          style={{ background: `radial-gradient(closest-side, ${color}66, transparent)` }}
          animate={{ opacity: [0.55, 0.95, 0.55] }} transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}

      <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center">
        <MagicCircle element={unit.element} size={small ? 118 : 150} active={isActive} opacity={dead ? 0.25 : 1} />
      </div>

      {/* sprite */}
      <div className={`absolute inset-x-0 bottom-7 z-10 flex justify-center ${dead ? 'opacity-70' : ''}`}>
        <Sprite
          defId={unit.sprite}
          pose={dead ? 'dead' : unit.pose}
          poseKey={unit.poseKey}
          flip={side === 'foe'}
          glow={isActive ? color : undefined}
          className="h-full w-auto"
          style={{ height: small ? 268 : 330, maxWidth: 190 }}
        />
      </div>

      {/* floating numbers */}
      <div className="pointer-events-none absolute inset-x-0 top-10 z-40">
        <AnimatePresence>
          {(numbers ?? []).map((n, i) => (
            <motion.div
              key={n.id}
              className={`dmg-num absolute left-1/2 whitespace-nowrap font-display font-black leading-none ${
                n.kind === 'crit' ? 'dmg-crit text-[34px]' : n.kind === 'heal' ? 'dmg-heal text-[22px]' :
                n.kind === 'counter' ? 'dmg-counter text-[22px]' : n.kind === 'status' || n.kind === 'info' ? 'text-[14px] text-violet-200' :
                n.kind === 'block' ? 'text-[22px] text-emerald-300' : n.kind === 'miss' ? 'text-[16px] text-sky-200' : 'dmg-normal text-[26px]'
              }`}
              style={{ top: i * 18 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              {n.text}
              {n.kind === 'counter' && <span className="ml-1 text-[13px] tracking-[.1em] text-ember">KHẮC CHẾ</span>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* HUD */}
      <div className="absolute inset-x-0 bottom-0 z-30 space-y-1 px-1">
        <StatusRow statuses={unit.statuses} />
        <div className="flex items-center gap-1">
          <span className="rounded bg-black/60 px-1 text-[9px] font-bold text-white/70">Lv{unit.level}</span>
          <div className="relative flex-1">
            <Bar
              pct={hpPct}
              height={7}
              color={hpPct > 0.5 ? '#34d399' : hpPct > 0.25 ? '#f5c453' : '#fb7185'}
              glow={hpPct <= 0.25}
            />
            {unit.statuses.some((s) => s.kind === 'shield') && (
              <span className="absolute -top-[1px] right-0 text-[8px] font-bold text-indigo-200">⟡</span>
            )}
          </div>
          <ElementBadge element={unit.element} size={16} />
        </div>
        {side === 'party' && (
          <div className="flex items-center justify-center gap-[3px] opacity-90">
            {Array.from({ length: 6 }).map((_, i) => (
              <Fragment key={i}>
                <span className="h-1.5 w-2.5 rounded-[2px]" style={{ background: i < unit.mana && isActive ? 'linear-gradient(180deg,#ffe9a8,#c08a1e)' : 'rgba(255,255,255,.14)' }} />
              </Fragment>
            ))}
          </div>
        )}
      </div>

      {unit.boss && (
        <div className="absolute -top-1 left-1/2 z-30 -translate-x-1/2 rounded-md border border-blood/60 bg-black/70 px-1.5 py-[1px] text-[9px] font-black uppercase tracking-[.16em] text-rose-200">
          {unit.name.length > 14 ? `${unit.name.slice(0, 13)}…` : unit.name}
        </div>
      )}
    </div>
  );
}

interface ArenaSlotProps {
  unit: UnitView;
  side: 'party' | 'foe';
  isActive: boolean;
  isTargetable: boolean;
  isSelected: boolean;
  isThreatened: boolean;
  /** hidden while the clash overlay has taken over this fighter */
  ghost: boolean;
  numbers?: FloatNumber[];
  onPickTarget: (uid: string) => void;
}

/**
 * One position on the field. Memoised so a strike / status tick / pose change
 * that touches ONE unit only re-renders that unit's row: its sprite subtree,
 * MagicCircle, hitbox, HUD and mana pips — not all ~10 units (each of them a
 * ~117-node rigged SVG) on every sync of a battle.
 */
const ArenaSlot = memo(function ArenaSlot(p: ArenaSlotProps) {
  return (
    <div className="transition-opacity duration-200" style={{ opacity: p.ghost ? 0.12 : 1 }}>
      <ArenaUnit
        unit={p.unit}
        side={p.side}
        isActive={p.isActive}
        isTargetable={p.isTargetable}
        isSelected={p.isSelected}
        isThreatened={p.isThreatened}
        onClick={() => p.onPickTarget(p.unit.uid)}
        numbers={p.numbers}
      />
    </div>
  );
}, (a: ArenaSlotProps, b: ArenaSlotProps) =>
  a.ghost === b.ghost && a.isActive === b.isActive && a.isTargetable === b.isTargetable
  && a.isSelected === b.isSelected && a.isThreatened === b.isThreatened
  && a.onPickTarget === b.onPickTarget
  && sameUnitView(a.unit, b.unit)
  && sameFloatNumbers(a.numbers, b.numbers));

export function Arena({
  units, activeUid, phase, targetMode, pickedTarget, threatened, onPickTarget, numbersByUid, hiddenUids,
}: {
  units: UnitView[];
  activeUid: string | null;
  phase: string;
  targetMode: boolean;
  pickedTarget: string | null;
  threatened: string[];
  onPickTarget: (uid: string) => void;
  numbersByUid: Record<string, FloatNumber[]>;
  /** units shown big in the clash overlay — replaced by ghosts here */
  hiddenUids?: Set<string> | null;
}) {
  const party = units.filter((u) => u.side === 'party').sort((a, b) => a.slot - b.slot);
  const foes = units.filter((u) => u.side === 'foe').sort((a, b) => a.slot - b.slot);
  const row = (list: UnitView[], side: 'party' | 'foe') => (
    <div className={`flex h-full items-end gap-1 ${side === 'party' ? 'justify-start pl-2' : 'justify-end pr-2'}`}>
      {list.map((u) => (
        // Ghost the fighters that the clash overlay has taken over. Opacity only:
        // `filter: blur(3px)` on up to 8 complex SVGs at once (animated through
        // `transition-[filter]`) made the compositor re-raster all of them every
        // frame for the whole 200 ms — the single heaviest moment of a battle.
        <ArenaSlot
          key={u.uid}
          unit={u}
          side={side}
          isActive={activeUid === u.uid}
          isTargetable={targetMode && u.side !== 'party' && u.alive}
          isSelected={pickedTarget === u.uid}
          isThreatened={threatened.includes(u.uid)}
          ghost={hiddenUids?.has(u.uid) ?? false}
          numbers={numbersByUid[u.uid]}
          onPickTarget={onPickTarget}
        />
      ))}
    </div>
  );
  return (
    <div className="relative h-full w-full">
      <div className="fx-floor" />
      <div className="absolute inset-0 flex items-end justify-between px-1 pb-1" style={{ height: '100%' }}>
        {row(party, 'party')}
        <div className="mx-1 mb-24 hidden h-40 w-px shrink-0 bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />
        {row(foes, 'foe')}
      </div>
      {phase === 'dice' && <div className="pointer-events-none absolute inset-0 z-30 bg-black/35" />}
    </div>
  );
}
