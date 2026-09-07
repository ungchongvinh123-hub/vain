import type { Element } from '../game/types';

/**
 * Compact geometric icon set (skill/gear glyph). All icons are 24x24 inline SVG
 * so nothing needs an icon font or asset file.
 */
export function Icon({ name, size = 20, color = 'currentColor', className }: { name: string; size?: number; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      <g fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {glyph(name, color)}
      </g>
    </svg>
  );
}

const el = (name: string) => NAME_ELEMENT[name];
const ELEMENT_COLOR: Record<Element, string> = {
  fire: '#ff6b3d', ice: '#63d2ff', thunder: '#ffd93d', nature: '#7ee081',
  holy: '#ffe9a8', dark: '#a855f7', neutral: '#c9c6d6',
};
const NAME_ELEMENT: Record<string, Element> = {
  flame: 'fire', snow: 'ice', bolt: 'thunder', leaf: 'nature', sun: 'holy', moon: 'dark', star: 'neutral',
};

function glyph(name: string, color: string) {
  const accent = el(name) ? ELEMENT_COLOR[el(name)] : color;
  switch (name) {
    case 'slash':
      return <>
        <path d="M4 20 L20 4" stroke={accent} strokeWidth="2.6" />
        <path d="M14 4h6v6" /><path d="M5 19c3-1 5-3 6-6" opacity=".7" />
      </>;
    case 'claw':
      return <><path d="M5 4c2 6 2 10 0 16" /><path d="M12 4c2 6 2 10 0 16" /><path d="M19 4c2 6 2 10 0 16" /></>;
    case 'flame':
      return <><path d="M12 3c1 3-2 4-2 7a4 4 0 0 0 8 .5C18 8 14 6 12 3Z" stroke={accent} /><path d="M9 12c-2 2-2 6 3 7 4 .6 6-2 5-5-1 2-4 2-5-1-1-1 0-2 -3 -1Z" opacity=".55" /></>;
    case 'snow':
      return <>
        <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" stroke={accent} />
      </>;
    case 'bolt':
      return <><path d="M13 2L5 13h5l-2 9 9-12h-5l2-8Z" stroke={accent} /></>;
    case 'leaf':
      return <><path d="M20 4C10 4 4 9 4 16c0 2 2 4 4 4 7 0 12-6 12-16Z" /><path d="M8 20C10 14 14 10 18 8" opacity=".7" /></>;
    case 'sun':
      return <><circle cx="12" cy="12" r="4.4" stroke={accent} /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>;
    case 'moon':
      return <><path d="M15 3a9 9 0 1 0 0 18 7 7 0 0 1 0-18Z" stroke={accent} /></>;
    case 'star':
      return <><path d="M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7L12 3Z" /></>;
    case 'heal':
      return <><path d="M12 21s-8-4.6-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.4 12 21 12 21Z" stroke={accent} /><path d="M12 10v5M9.5 12.5h5" /></>;
    case 'heart':
      return <><path d="M12 21s-8-4.6-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.4 12 21 12 21Z" stroke={accent} /></>;
    case 'shield':
      return <><path d="M12 2l8 3v7c0 5-3.5 8.4-8 10-4.5-1.6-8-5-8-10V5l8-3Z" stroke={accent} /><path d="M12 7v8" opacity=".6" /></>;
    case 'shieldStrike':
      return <><path d="M12 2l8 3v7c0 5-3.5 8.4-8 10-4.5-1.6-8-5-8-10V5l8-3Z" /><path d="M7 17L17 6" stroke={accent} /></>;
    case 'taunt':
      return <><path d="M5 8h14l-2 10H7L5 8Z" stroke={accent} /><path d="M9 8V6a3 3 0 0 1 6 0v2" /><path d="M12 12v3" /></>;
    case 'atkUp':
      return <><path d="M4 20L20 4" /><path d="M13 4h7v7" /><path d="M4 13v7h7" opacity=".6" /></>;
    case 'defUp':
      return <><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z" /><path d="M9 12l2 2 4-4" stroke={accent} /></>;
    case 'cleanse':
      return <><path d="M12 3c2 4 5 5 5 9a5 5 0 0 1-10 0c0-4 3-5 5-9Z" stroke={accent} /><path d="M8 14l2 2M16 13l-3 3" /></>;
    case 'dispel':
      return <><path d="M5 5l14 14M19 5L5 19" stroke={accent} /><circle cx="12" cy="12" r="8" /></>;
    case 'revive':
      return <><path d="M12 21V9" /><path d="M7 14l5-5 5 5" stroke={accent} /><path d="M4 21h16" /><path d="M12 5V2" opacity=".6" /></>;
    case 'drain':
      return <><path d="M12 21s-7-5-7-10a7 7 0 0 1 14 0c0 5-7 10-7 10Z" /><path d="M9 11l3 3 3-3" stroke={accent} /></>;
    case 'aoe':
      return <><circle cx="12" cy="12" r="3" stroke={accent} /><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" /></>;
    case 'crit':
      return <><path d="M3 21L21 3" stroke={accent} strokeWidth="2.4" /><path d="M12 3l9 0-9 9" /><path d="M3 12l0 9 9-9" opacity=".7" /></>;
    case 'critDmg':
      return <><path d="M4 20L20 4" stroke={accent} /><path d="M8 4h12v12" /><path d="M4 8v12h12" opacity=".5" /></>;
    case 'resist':
      return <><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z" /><path d="M8 12h8" stroke={accent} /><path d="M10 16h4" opacity=".7" /></>;
    case 'dice':
      return <><rect x="4" y="4" width="16" height="16" rx="4" stroke={accent} /><circle cx="9" cy="9" r="1.3" fill={accent} /><circle cx="15" cy="15" r="1.3" fill={accent} /><circle cx="12" cy="12" r="1.3" fill={accent} /></>;
    case 'execute':
      return <><path d="M6 4l12 16M18 4L6 20" stroke={accent} /><circle cx="12" cy="12" r="4" /></>;
    case 'spd':
      return <><path d="M3 8h12M3 12h16M3 16h10" stroke={accent} /><path d="M15 4l6 8-6 8" /></>;
    case 'sword':
      return <><path d="M14 3h7v7L11 20l-7-7L14 3Z" /><path d="M4 20l3-3" stroke={accent} /></>;
    case 'bow':
      return <><path d="M5 3c8 3 11 12 4 18" /><path d="M5 3l14 9L5 21" opacity=".55" /></>;
    case 'staff':
      return <><path d="M8 21L16 4" /><circle cx="17" cy="4" r="3" stroke={accent} /></>;
    case 'tome':
      return <><path d="M4 5h7v14H4zM13 5h7v14h-7z" /><path d="M11 5v14" stroke={accent} /></>;
    case 'orb':
      return <><circle cx="12" cy="12" r="6" stroke={accent} /><path d="M9 9c1 3 3 4 6 3" /></>;
    case 'target':
      return <><circle cx="12" cy="12" r="7.4" stroke={accent} /><circle cx="12" cy="12" r="2" fill={accent} /><path d="M12 1.6v3.4M12 19v3.4M1.6 12H5M19 12h3.4" /></>;
    case 'gear':
      return <><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>;
    case 'team':
      return <><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2-5 5-5s5 2 5 5" stroke={accent} /></>;
    case 'bag':
      return <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke={accent} /></>;
    case 'map':
      return <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" /><path d="M9 4v14M15 6v14" stroke={accent} /></>;
    case 'shop':
      return <><path d="M4 9h16l-1 11H5L4 9Z" stroke={accent} /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></>;
    case 'gem':
      return <><path d="M7 3h10l4 6-9 12L3 9l4-6Z" stroke={accent} /><path d="M3 9h18M9 3l3 18 3-18" opacity=".6" /></>;
    case 'coin':
      return <><circle cx="12" cy="12" r="8" stroke={accent} /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></>;
    case 'skull':
      return <><path d="M6 10a6 6 0 1 1 12 0v4l-2 1v3H8v-3l-2-1v-4Z" /><circle cx="9.5" cy="10" r="1.4" fill={accent} /><circle cx="14.5" cy="10" r="1.4" fill={accent} /></>;
    case 'skullDark':
      return <><path d="M6 10a6 6 0 1 1 12 0v4l-2 1v3H8v-3l-2-1v-4Z" stroke={accent} /><path d="M9 10l1.5 1.5L9 13M15 10l-1.5 1.5L15 13" /></>;
    case 'lock':
      return <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke={accent} /></>;
    case 'sound':
      return <><path d="M4 9h4l4-4v14l-4-4H4z" /><path d="M16 9a4 4 0 0 1 0 6" stroke={accent} /></>;
    case 'mute':
      return <><path d="M4 9h4l4-4v14l-4-4H4z" /><path d="M16 9l5 6M21 9l-5 6" stroke={accent} /></>;
    case 'back':
      return <><path d="M15 5l-7 7 7 7" stroke={accent} /></>;
    case 'next':
      return <><path d="M9 5l7 7-7 7" stroke={accent} /></>;
    case 'close':
      return <><path d="M6 6l12 12M18 6L6 18" stroke={accent} /></>;
    case 'plus':
      return <><path d="M12 5v14M5 12h14" stroke={accent} /></>;
    case 'minus':
      return <><path d="M5 12h14" stroke={accent} /></>;
    default:
      return <><circle cx="12" cy="12" r="7" stroke={accent} /></>;
  }
}

export function ElementBadge({ element, size = 22 }: { element: Element; size?: number }) {
  const map: Record<Element, string> = {
    fire: 'flame', ice: 'snow', thunder: 'bolt', nature: 'leaf', holy: 'sun', dark: 'moon', neutral: 'star',
  };
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border el-${element}`}
      style={{ width: size, height: size, borderColor: ELEMENT_COLOR[element], background: `${ELEMENT_COLOR[element]}22`, boxShadow: `0 0 8px ${ELEMENT_COLOR[element]}55 inset` }}
    >
      <Icon name={map[element]} size={size * 0.66} color={ELEMENT_COLOR[element]} />
    </span>
  );
}

export const ELEMENT_COLORS = ELEMENT_COLOR;
