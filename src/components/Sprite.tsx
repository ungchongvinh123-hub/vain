'use client';
import { memo, useEffect, useRef } from 'react';
import { SPRITES } from '../game/sprite/generated';
import type { SpriteState } from '../game/types';
import { ELEMENT_COLORS } from './Icon';
import type { Element } from '../game/types';

/**
 * Full-body standing sprite rendered from the procedurally generated rig.
 * Pose animation is CSS-driven (src/styles/sprite.css), so `pose` changes are cheap.
 */
export const Sprite = memo(function Sprite({
  defId, pose = 'idle', flip, glow, className, style, poseKey = 0,
}: {
  defId: string;
  pose?: SpriteState;
  flip?: boolean;
  glow?: string;
  className?: string;
  style?: React.CSSProperties;
  /** bump to restart a one-shot animation for the same pose */
  poseKey?: number | string;
}) {
  const svg = SPRITES[defId];
  const ref = useRef<HTMLDivElement | null>(null);

  /**
   * Replay a pose WITHOUT remounting.
   * The wrapper used to carry `key={`${pose}-${poseKey}`}`, so every single hit
   * tore the element down and re-parsed its ~117-node inline SVG through
   * innerHTML — measured at ~83 remounts per battle (143 on stage 3), i.e.
   * ~10k SVG nodes re-parsed mid-animation. Seeking the already-running CSS
   * animations back to 0 produces the identical one-shot replay with no DOM
   * churn at all.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.getAnimations !== 'function') return;
    for (const a of el.getAnimations({ subtree: true })) {
      try { a.currentTime = 0; a.play(); } catch { /* finished or detached — nothing to replay */ }
    }
  }, [pose, poseKey]);

  if (!svg) {
    return <div className={className} style={{ aspectRatio: '260/430', background: '#1a1428', borderRadius: 8, ...style }} />;
  }
  return (
    <div
      ref={ref}
      className={`sprite relative ${flip ? 'sprite-flip' : ''} ${className ?? ''}`}
      data-pose={pose}
      data-pose-key={poseKey}
      style={{
        // one drop-shadow, not two stacked ones: each of them forces the whole
        // SVG subtree into its own raster pass on every animated frame
        filter: glow ? `drop-shadow(0 0 16px ${glow})` : undefined,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});

const RUNES = 'ᚠᚢᚦᚱᚷᚹᛈᛉᛏᛒᛖᛗ';

/** element-tinted magic-circle pedestal under each fighter */
export function MagicCircle({ element, size = 120, active, spin = 26, opacity = 1 }: { element: Element; size?: number; active?: boolean; spin?: number; opacity?: number }) {
  const color = ELEMENT_COLORS[element];
  const runes = Array.from({ length: 12 }, (_, i) => RUNES[(i + element.length) % RUNES.length]);
  return (
    <div className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ width: size, height: size * 0.42, bottom: -size * 0.16, opacity }}>
      <svg viewBox="0 0 200 84" className="h-full w-full" style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id={`mcg-${element}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity={active ? 0.55 : 0.3} />
            <stop offset="60%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="100" cy="42" rx="98" ry="40" fill={`url(#mcg-${element})`} />
        <g style={{ transformOrigin: '100px 42px', animation: `spin ${spin}s linear infinite` }}>
          <ellipse cx="100" cy="42" rx="78" ry="30" fill="none" stroke={color} strokeOpacity="0.85" strokeWidth="1.6" strokeDasharray="14 7" />
          <ellipse cx="100" cy="42" rx="58" ry="22" fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="1" />
          {runes.map((r, i) => {
            const a = (i / runes.length) * Math.PI * 2;
            return (
              <text key={i} x={100 + Math.cos(a) * 68} y={42 + Math.sin(a) * 26 + 3} fill={color} fillOpacity="0.85" fontSize="9" textAnchor="middle" style={{ fontFamily: 'serif' }}>
                {r}
              </text>
            );
          })}
        </g>
        <ellipse cx="100" cy="42" rx="34" ry="13" fill="none" stroke={color} strokeOpacity="0.7" strokeWidth="1.2" style={{ transformOrigin: '100px 42px', animation: `spin ${spin * 0.7}s linear infinite reverse` }} />
        {active && <ellipse cx="100" cy="42" rx="86" ry="34" fill="none" stroke={color} strokeWidth="2" className="animate-ring" />}
      </svg>
    </div>
  );
}
