'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Sprite, MagicCircle } from '../Sprite';
import { Icon } from '../Icon';
import type { ClashFrame } from './useBattleFlow';
import type { FloatNumber, UnitView } from './types';
import { ELEMENT_COLORS } from '../Icon';
import { statusLabel } from './useBattleFlow';

/**
 * Dramatic Spotlight Zoom Clash — the heart of the game.
 * Backdrop dims, the two fighters fill the screen 50/50 at equal size, the QTE
 * floats in the seam between them, and NO skill name text is ever shown here.
 */
export function ClashView({
  frame, units, numbers, qteSlot,
}: {
  frame: ClashFrame | null;
  units: UnitView[];
  numbers: FloatNumber[];
  qteSlot?: React.ReactNode;
}) {
  const byUid = (uid: string | undefined) => units.find((u) => u.uid === uid);
  if (!frame) return null;
  const actor = byUid(frame.actorUid);
  const targets = frame.targetUids.map(byUid).filter(Boolean) as UnitView[];
  const isFoeAttacking = actor?.side === 'foe';
  const primary = targets[0];
  const color = ELEMENT_COLORS[(frame.element as UnitView['element']) ?? 'neutral'];
  const selfOnly = frame.selfOnly;

  const fighter = (u: UnitView | undefined, pose: UnitView['pose'], side: 'left' | 'right') => {
    if (!u) return null;
    const el = ELEMENT_COLORS[u.element];
    return (
      <motion.div
        className="relative flex h-full w-full items-end justify-center"
        initial={side === 'left' ? { x: -140, scale: .82, opacity: 0 } : { x: 140, scale: .82, opacity: 0 }}
        animate={{ x: 0, scale: 1, opacity: 1 }}
        exit={{ opacity: 0, scale: 1.06 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2">
          <MagicCircle element={u.element} size={420} active opacity={0.9} />
        </div>
        {/* ground shadow — painted gradient instead of a `drop-shadow(0 24px 40px)`
            on a 690px-tall sprite, which re-rastered the entire SVG on every
            frame of the spring entrance */}
        <div
          className="pointer-events-none absolute bottom-[6%] left-1/2 h-16 w-[62%] -translate-x-1/2 rounded-[50%]"
          style={{ background: 'radial-gradient(closest-side, rgba(0,0,0,.85), transparent)' }}
        />
        <div className="absolute inset-x-0 bottom-[8%] flex justify-center">
          <Sprite
            defId={u.sprite}
            pose={pose}
            poseKey={`${u.poseKey}-${pose}`}
            flip={side === 'right'}
            glow={pose === 'skill' || pose === 'attack' ? el : undefined}
            style={{ height: 'clamp(360px, 74vh, 690px)', maxHeight: '82%' }}
          />
        </div>
        <div className="absolute bottom-[3.5%] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-white/10 bg-black/55 px-2 py-[3px]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: el, boxShadow: `0 0 8px ${el}` }} />
          <span className="text-[11px] font-bold tracking-wide text-white/85">{u.name}</span>
          <span className="text-[9px] text-white/45">Lv{u.level}</span>
        </div>
      </motion.div>
    );
  };

  const numbersOn = (uid: string) => numbers.filter((n) => n.uid === uid);

  return (
    <motion.div className="absolute inset-0 z-40 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .16 }}>
      <div className="clash-veil absolute inset-0" />
      {/* radial energy bloom of the element behind the seam */}
      <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(closest-side, ${color}33, transparent 72%)` }} />
      <div className="speed-line" />

      <div className="absolute inset-0 flex items-stretch">
        {/* LEFT HALF — the striker (always equal area, equal size) */}
        <div className="relative h-full w-1/2">
          {fighter(actor, frame.pose, isFoeAttacking ? 'right' : 'left')}
          {/* incoming damage on the striker when the foe is hitting it */}
          <NumberStack items={numbersOn(activeTargetOnLeft(frame, units, isFoeAttacking))} big />
        </div>

        {/* RIGHT HALF — the struck */}
        <div className={`relative h-full w-1/2 ${selfOnly ? 'opacity-25' : ''}`}>
          {!selfOnly && fighter(primary, primary && frame.deaths.includes(primary.uid) ? 'dead' : 'hit', isFoeAttacking ? 'left' : 'right')}
          {!selfOnly && (
            <NumberStack items={targets.flatMap((t) => numbersOn(t.uid).map((n) => ({ ...n, uid: t.uid })))} big />
          )}
          {selfOnly && (
            <div className="absolute inset-0 grid place-items-center">
              {frame.statuses.length > 0 && (
                <div className="flex flex-col items-center gap-2">
                  {frame.statuses.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: .7, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: .1 + i * .07 }}
                      className="flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-950/50 px-3 py-1 text-[13px] font-bold text-emerald-100"
                    >
                      {statusLabel(s.kind)}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* the seam — QTE lives here, no frame, no instructions */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/25 to-transparent" />
      <div className="absolute inset-y-0 left-1/2 z-30 w-[46%] -translate-x-1/2">{qteSlot}</div>

      {/* clash shockwave on impact */}
      <AnimatePresence>
        {frame.numbers.length > 0 && (
          <motion.div
            key={frame.numbers[0]?.uid}
            className="shockwave pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2"
            style={{ color }}
            initial={{ scale: .2, opacity: .9 }} animate={{ scale: 2.6, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: .5 }}
          />
        )}
      </AnimatePresence>

      {/* spread indicators for secondary targets (icon only) */}
      {targets.length > 1 && (
        <div className="absolute inset-x-0 top-6 z-30 flex justify-center gap-2">
          {targets.map((t) => (
            <span key={t.uid} className="flex items-center gap-1 rounded-md border border-white/10 bg-black/55 px-1.5 py-[2px] text-[10px] text-white/75">
              <Icon name="target" size={11} color={ELEMENT_COLORS[t.element]} />
              {t.name}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function activeTargetOnLeft(frame: ClashFrame, units: UnitView[], foeAttacking: boolean) {
  if (!foeAttacking) return '';
  return frame.targetUids[0] ?? '';
}

function NumberStack({ items, big }: { items: FloatNumber[]; big?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[16%] z-30">
      <AnimatePresence>
        {items.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 26, scale: .6 }}
            animate={{ opacity: 1, y: 0, scale: big ? 1 : .8 }}
            exit={{ opacity: 0, y: -40, scale: .95 }}
            transition={{ type: 'spring', stiffness: 360, damping: 20, delay: i * 0.05 }}
            className={`dmg-num absolute left-1/2 whitespace-nowrap font-display font-black leading-none ${
              n.kind === 'crit' ? 'dmg-crit text-[64px]' :
              n.kind === 'heal' ? 'dmg-heal text-[40px]' :
              n.kind === 'counter' ? 'dmg-counter text-[40px]' :
              n.kind === 'block' ? 'text-[40px] text-emerald-300' :
              n.kind === 'miss' ? 'text-[26px] text-sky-200' :
              n.kind === 'shield' ? 'text-[30px] text-indigo-200' :
              n.kind === 'status' || n.kind === 'info' ? 'text-[24px] text-violet-100' : 'dmg-normal text-[50px]'
            }`}
            style={{ top: i * 34 }}
          >
            {n.text}
            {n.kind === 'counter' && <span className="ml-2 text-[22px] tracking-[.14em] text-ember">KHẮC CHẾ</span>}
            {n.kind === 'crit' && <span className="ml-1 text-[22px] text-amber-300">!</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
