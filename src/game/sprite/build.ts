import type { SpriteSpec } from '../types';

/**
 * Procedural 2D sprite factory.
 * Produces ONE rigged, layered SVG per character/monster; combat poses
 * (idle / attack / skill / hit / dead) are animated by CSS rig classes
 * (see src/styles/sprite.css) so we never ship image binaries at all.
 *
 * Coordinate system: viewBox 0 0 260 430, feet at y=404, facing RIGHT.
 */

const W = 260, H = 430, GROUND = 404;

const shade = (hex: string, amt: number): string => {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(n.slice(0, 6), 16);
  let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  if (amt >= 0) { r = r + (255 - r) * amt; g = g + (255 - g) * amt; b = b + (255 - b) * amt; }
  else { const k = 1 + amt; r *= k; g *= k; b *= k; }
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
};

const n2 = (x: number) => Math.round(x * 100) / 100;

let RIG_ON = true;
/** wrap a rig part so CSS can animate it (transform-box: fill-box) */
const g = (id: string, attrs: string, inner: string) =>
  `<g${RIG_ON ? ` class="rig-${id}" data-part="${id}"` : ''}${attrs ? ` ${attrs}` : ''}>${inner}</g>`;

export interface SpriteOpts { rig?: boolean; shadow?: boolean; }

export function buildSpriteSVG(sp: SpriteSpec, opts: SpriteOpts = {}): string {
  const rig = opts.rig !== false;
  const bulk = sp.bulk ?? 1;
  const height = sp.height ?? 1;
  const o = sp.outfit;
  const isWaifu = sp.body === 'waifu';
  const floaty = sp.body === 'wraith' || sp.body === 'construct';
  const skin = sp.skin;
  const skinD = shade(skin, -0.28);
  const hair = sp.hair.color, hairD = sp.hair.shade;
  const pri = o.primary, sec = o.secondary, acc = o.accent;
  const priD = shade(pri, -0.3), priL = shade(pri, 0.22);

  // ---- key anchor points (scaled by bulk/height around the feet) ----
  const cx = 120;
  const feetY = GROUND;
  const hipY = feetY - 150 * height;
  const waistY = hipY - 44 * height;
  const chestY = waistY - 46 * height;
  const neckY = chestY - 20 * height;
  const shoulderY = neckY + 8;
  const headR = 27 * (isWaifu ? 1 : 1.02);
  const headCY = neckY - headR * 0.92;
  const shW = (isWaifu ? 21 : 30) * bulk;
  const hipW = (isWaifu ? 19 : 22) * bulk;
  const waistW = (isWaifu ? 12.5 : 20) * bulk;
  const chestW = (isWaifu ? 17 : 26) * bulk;
  const limbW = isWaifu ? 11.5 : 15 * bulk;

  RIG_ON = rig;
  const P: string[] = [];

  /* ---------------------------- glow / wings / cape ---------------------------- */
  if (sp.trim?.aura) {
    P.push(`<g class="rig-aura"><ellipse cx="${cx}" cy="${n2(headCY + 40)}" rx="74" ry="112" fill="url(#aura)" opacity=".5"/></g>`);
  }
  if (sp.trim?.wings) {
    const wc = shade(acc, -0.12);
    P.push(g('wings', `opacity=".95"`,
      `<path d="M${cx - 12} ${n2(chestY)} C ${cx - 74} ${n2(chestY - 66)}, ${cx - 96} ${n2(chestY + 26)}, ${cx - 40} ${n2(hipY + 18)} C ${cx - 60} ${n2(chestY + 6)}, ${cx - 44} ${n2(chestY - 26)}, ${cx - 12} ${n2(chestY - 6)} Z" fill="${wc}" opacity=".85"/>
       <path d="M${cx + 10} ${n2(chestY)} C ${cx + 66} ${n2(chestY - 74)}, ${cx + 96} ${n2(chestY + 18)}, ${cx + 44} ${n2(hipY + 22)} C ${cx + 62} ${n2(chestY + 4)}, ${cx + 46} ${n2(chestY - 28)}, ${cx + 10} ${n2(chestY - 8)} Z" fill="${shade(wc, -0.18)}" opacity=".9"/>`));
  }

  /* -------------------------------- hair back -------------------------------- */
  const hb = hairBack(sp, cx, headCY, headR, hipY, chestY, height);
  P.push(hb);

  /* ---------------------------------- cape ---------------------------------- */
  if (sp.trim?.cape) {
    P.push(g('cape', '',
      `<path d="M${cx - shW + 2} ${n2(shoulderY)} C ${cx - shW - 30} ${n2(chestY + 40)}, ${cx - shW - 24} ${n2(hipY + 60)}, ${cx - 26} ${n2(feetY - 6)} L ${cx + 18} ${n2(feetY - 10)} C ${cx + 8} ${n2(hipY + 20)}, ${cx + 12} ${n2(chestY + 30)}, ${cx + shW - 4} ${n2(shoulderY + 4)} Z" fill="${shade(sec, -0.35)}" opacity=".92"/>
       <path d="M${cx - shW + 6} ${n2(shoulderY + 6)} C ${cx - shW - 18} ${n2(chestY + 50)}, ${cx - 20} ${n2(hipY + 70)}, ${cx - 6} ${n2(feetY - 14)}" fill="none" stroke="${acc}" stroke-width="2.5" opacity=".5"/>`));
  }
  if (sp.trim?.scarf) {
    P.push(g('scarfBack', '', `<path d="M${cx - 6} ${n2(shoulderY + 4)} C ${cx - 46} ${n2(chestY + 70)}, ${cx - 30} ${n2(hipY + 60)}, ${cx - 60} ${n2(feetY - 10)} L ${cx - 22} ${n2(feetY - 16)} C ${cx - 18} ${n2(hipY + 30)}, ${cx + 4} ${n2(chestY + 30)}, ${cx + 10} ${n2(shoulderY)} Z" fill="${acc}" opacity=".85"/>`));
  }

  /* ----------------------------- left (back) arm ----------------------------- */
  const lArmX = cx - shW + 3, lHandY = waistY + 12;
  P.push(g('armL', '',
    `<path d="M${n2(lArmX)} ${n2(shoulderY)} Q ${n2(lArmX - 8)} ${n2(chestY + 14)} ${n2(lArmX - 4)} ${n2(lHandY)}" fill="none" stroke="${sleeveColor(o.kind, skin, pri, sec, false)}" stroke-width="${n2(limbW * (o.kind === 'robe' || o.kind === 'kimono' ? 1.7 : 1))}" stroke-linecap="round"/>
     <circle cx="${n2(lArmX - 4)}" cy="${n2(lHandY + 2)}" r="${n2(limbW * 0.46)}" fill="${skinD}"/>`));

  /* --------------------------------- legs --------------------------------- */
  const legKind = o.kind;
  const coverLegs = legKind === 'armor' ? 0.42 : legKind === 'husk' || legKind === 'hide' ? 1 : legKind === 'catsuit' ? 0.99 : 0;
  const bootsTo = n2(feetY - 74 * height);
  P.push(g('legB', '', legPath(cx - hipW * 0.55, hipY, cx - hipW * 0.9, feetY, limbW, skin, coverLegs > 0.5 ? shade(pri, -0.22) : (coverLegs > 0 ? shade(sec, -0.1) : null), bootsTo, isWaifu, o.kind)));
  P.push(g('legF', '', legPath(cx + hipW * 0.72, hipY, cx + hipW * 1.05, feetY, limbW, skin, coverLegs > 0.5 ? pri : (coverLegs > 0 ? sec : null), bootsTo, isWaifu, o.kind)));

  /* ------------------------------- skirt / coat ------------------------------- */
  const skirt = skirtLayer(sp, cx, hipY, waistY, hipW, feetY, height, isWaifu);
  if (skirt) P.push(g('skirt', '', skirt));

  /* --------------------------------- torso --------------------------------- */
  const torsoPath = `M${n2(cx - shW)} ${n2(shoulderY)} L${n2(cx + shW)} ${n2(shoulderY - 2)} L${n2(cx + chestW + 2)} ${n2(chestY + 6)} L${n2(cx + waistW)} ${n2(waistY)} L${n2(cx + hipW)} ${n2(hipY + 10)} L${n2(cx - hipW)} ${n2(hipY + 12)} L${n2(cx - waistW - 1)} ${n2(waistY - 2)} L${n2(cx - chestW - 2)} ${n2(chestY + 4)} Z`;
  const baseFill = o.kind === 'husk' ? '#5a5560'
    : o.kind === 'hide' ? shade(skin, -0.1)
      : sp.body === 'waifu' ? 'url(#cloth)'
        : o.primary;
  P.push(g('torso', '', `<path d="${torsoPath}" fill="${baseFill}"/>` + torsoDetail(sp, cx, shoulderY, chestY, waistY, hipY, shW, chestW, waistW, hipW, isWaifu)));

  /* ---------------------------------- head ---------------------------------- */
  P.push(g('head', '', headLayer(sp, cx, headCY, neckY, headR, isWaifu, neckY, shoulderY, height)));

  /* ------------------------- right (front) arm + weapon ------------------------- */
  const rShX = cx + shW - 2;
  const rHandX = cx + shW + 12, rHandY = waistY + 2;
  P.push(g('armR', '', armAndWeapon(sp, rShX, shoulderY, rHandX, rHandY, limbW, o.kind, skin, pri, sec, acc, isWaifu, bulk, height)));

  /* ------------------------------ fx (pose-driven) ------------------------------ */
  P.push(g('fx', '', fxLayer(sp, cx, chestY, headCY, feetY)));

  const defs = `<defs>
    <radialGradient id="aura" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="${sp.trim?.aura ?? acc}" stop-opacity=".55"/>
      <stop offset="70%" stop-color="${sp.trim?.aura ?? acc}" stop-opacity=".08"/>
      <stop offset="100%" stop-color="${sp.trim?.aura ?? acc}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f2f6ff"/><stop offset="45%" stop-color="#b9c6db"/><stop offset="100%" stop-color="#6b7a94"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="${priL}"/><stop offset="100%" stop-color="${priD}"/>
    </linearGradient>
    <linearGradient id="cloth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${priL}"/><stop offset="55%" stop-color="${pri}"/><stop offset="100%" stop-color="${priD}"/>
    </linearGradient>
  </defs>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMax meet">
  ${defs}
  ${opts.shadow === false ? '' : `<ellipse class="ground" cx="${cx}" cy="${feetY + 6}" rx="${n2(52 * bulk)}" ry="9" fill="#000" opacity=".45"/>`}
  <g class="rig-root">${P.join('\n  ')}</g>
</svg>`;
}

/* ---------------------------------------------------------------- helpers */

function sleeveColor(kind: string, skin: string, pri: string, sec: string, front: boolean): string {
  if (kind === 'robe' || kind === 'kimono') return kind === 'robe' ? pri : sec;
  if (kind === 'gown') return front ? skin : skin;
  if (kind === 'prayer') return skin;
  if (kind === 'husk') return '#6a6470';
  if (kind === 'hide') return shade(skin, -0.15);
  return pri;
}

function legPath(x1: number, y1: number, x2: number, y2: number, w: number, skin: string, cover: string | null, bootsTo: number, fem: boolean, outfit: string): string {
  const kX = (x1 + x2) / 2 + (fem ? -4 : 2), kY = (y1 + y2) / 2 + 6;
  const leg = `<path d="M${n2(x1)} ${n2(y1)} Q ${n2(kX)} ${n2(kY)} ${n2(x2)} ${n2(y2 - 16)}" fill="none" stroke="${cover ?? skin}" stroke-width="${n2(w * 1.08)}" stroke-linecap="round"/>`;
  const foot = `<path d="M${n2(x2 - w * 0.5)} ${n2(y2 - 12)} L ${n2(x2 + w * 0.4)} ${n2(y2 - 12)} L ${n2(x2 + w * 1.5)} ${n2(y2)} L ${n2(x2 - w * 0.6)} ${n2(y2)} Z" fill="${cover ? shade(cover, -0.3) : '#2a2230'}"/>`;
  const boot = cover ? `<path d="M${n2(x1)} ${n2(y1)} Q ${n2(kX)} ${n2(kY)} ${n2(x2)} ${n2(y2 - 16)}" fill="none" stroke="${cover}" stroke-width="${n2(w * 1.24)}" stroke-linecap="round" opacity="${outfit === 'catsuit' ? 1 : 0.95}"/>` : '';
  const bootTop = cover && outfit !== 'catsuit' ? `<path d="M${n2(x2 - w * 0.75)} ${n2(bootsTo)} L ${n2(x2 + w * 0.75)} ${n2(bootsTo)}" stroke="${shade(cover, 0.25)}" stroke-width="3" fill="none"/>` : '';
  return leg + boot + bootTop + foot;
}

function skirtLayer(sp: SpriteSpec, cx: number, hipY: number, waistY: number, hipW: number, feetY: number, height: number, fem: boolean): string {
  const o = sp.outfit;
  const k = o.kind;
  const swing = fem ? 1 : 0.7;
  if (k === 'gown') {
    const hem = feetY - 6;
    return `<path d="M${n2(cx - hipW - 3)} ${n2(hipY - 22)} Q ${n2(cx - hipW * 3.4 * swing)} ${n2((hipY + hem) / 2 + 18)} ${n2(cx - 62)} ${n2(hem)} Q ${cx} ${n2(hem + 12)} ${n2(cx + 58)} ${n2(hem)} Q ${n2(cx + hipW * 3.2 * swing)} ${n2((hipY + hem) / 2 + 12)} ${n2(cx + hipW + 3)} ${n2(hipY - 24)} Z" fill="url(#cloth)"/>
      <path d="M${n2(cx + 6)} ${n2(hipY - 14)} Q ${n2(cx + 40)} ${n2((hipY + hem) / 2)} ${n2(cx + 52)} ${n2(hem - 4)} L ${n2(cx + 30)} ${n2(hem - 2)} Q ${n2(cx + 16)} ${n2(hipY + 30)} ${n2(cx + 2)} ${n2(hipY - 10)} Z" fill="${sp.skin}" opacity=".96"/>
      <path d="M${n2(cx - 40)} ${n2(hipY + 40)} Q ${n2(cx - 24)} ${n2(feetY - 30)} ${n2(cx - 18)} ${n2(feetY - 8)}" fill="none" stroke="${shade(o.primary, 0.3)}" stroke-width="2" opacity=".5"/>`;
  }
  if (k === 'armor') {
    const seg: string[] = [];
    for (let i = -2; i <= 2; i++) {
      const x = cx + i * (hipW * 0.62);
      seg.push(`<path d="M${n2(x - hipW * 0.34)} ${n2(hipY - 8)} L ${n2(x + hipW * 0.34)} ${n2(hipY - 8)} L ${n2(x + hipW * 0.42)} ${n2(hipY + 104)} L ${n2(x - hipW * 0.42)} ${n2(hipY + 104)} Z" fill="${i % 2 ? o.secondary : o.primary}" stroke="${shade(o.secondary, -0.3)}" stroke-width="1.4"/>`);
    }
    return seg.join('');
  }
  if (k === 'robe' || k === 'prayer' || k === 'kimono') {
    const hem = feetY - (k === 'kimono' ? 30 : 4);
    return `<path d="M${n2(cx - hipW - 6)} ${n2(hipY - 26)} Q ${n2(cx - hipW * 2.9)} ${n2(hipY + 60)} ${n2(cx - 50)} ${n2(hem)} L ${n2(cx + 48)} ${n2(hem)} Q ${n2(cx + hipW * 2.9)} ${n2(hipY + 56)} ${n2(cx + hipW + 6)} ${n2(hipY - 28)} Q ${cx} ${n2(hipY - 6)} ${n2(cx - hipW - 6)} ${n2(hipY - 26)} Z" fill="url(#cloth)"/>
      <path d="M${n2(cx - 4)} ${n2(hipY - 20)} L ${n2(cx + 10)} ${n2(hem - 2)} L ${n2(cx - 14)} ${n2(hem - 2)} Z" fill="${sp.skin}" opacity=".9"/>
      <path d="M${n2(cx - 50)} ${n2(hem - 8)} L ${n2(cx + 48)} ${n2(hem - 8)}" stroke="${o.accent}" stroke-width="4" opacity=".8"/>`;
  }
  if (k === 'rags') {
    return `<path d="M${n2(cx - hipW - 6)} ${n2(hipY - 16)} L ${n2(cx + hipW + 6)} ${n2(hipY - 16)} L ${n2(cx + 30)} ${n2(hipY + 70)} L ${n2(cx + 10)} ${n2(hipY + 40)} L ${n2(cx - 4)} ${n2(hipY + 78)} L ${n2(cx - 22)} ${n2(hipY + 44)} L ${n2(cx - 34)} ${n2(hipY + 72)} Z" fill="${shade(o.primary, -0.1)}"/>`;
  }
  if (k === 'husk') {
    const seg: string[] = [];
    for (let i = -1; i <= 1; i++) {
      const x = cx + i * (hipW * 0.8);
      seg.push(`<rect x="${n2(x - hipW * 0.44)}" y="${n2(hipY - 6)}" width="${n2(hipW * 0.88)}" height="52" rx="4" fill="#5a5560" stroke="#2b2833" stroke-width="2"/>`);
    }
    return seg.join('');
  }
  return '';
}

function torsoDetail(sp: SpriteSpec, cx: number, shoulderY: number, chestY: number, waistY: number, hipY: number, shW: number, chestW: number, waistW: number, hipW: number, fem: boolean): string {
  const o = sp.outfit, k = o.kind, acc = o.accent;
  const d: string[] = [];
  const chestCx = cx + chestW * 0.18;
  if (k === 'catsuit') {
    d.push(`<path d="M${n2(cx - shW)} ${n2(shoulderY)} L ${n2(cx + shW)} ${n2(shoulderY - 2)} L ${n2(cx + chestW + 2)} ${n2(chestY + 6)} L ${n2(cx + waistW)} ${n2(waistY)} L ${n2(cx + hipW)} ${n2(hipY + 10)} L ${n2(cx - hipW)} ${n2(hipY + 12)} L ${n2(cx - waistW - 1)} ${n2(waistY - 2)} L ${n2(cx - chestW - 2)} ${n2(chestY + 4)} Z" fill="url(#cloth)"/>`);
    d.push(`<path d="M${n2(cx + 2)} ${n2(shoulderY + 6)} Q ${n2(cx + 6)} ${n2(chestY + 10)} ${n2(cx + 2)} ${n2(hipY + 6)}" fill="none" stroke="${acc}" stroke-width="2.2" opacity=".9"/>`);
    if (fem) {
      d.push(`<path d="M${n2(cx - chestW + 2)} ${n2(chestY - 6)} Q ${cx} ${n2(chestY + 16)} ${n2(cx + chestW - 2)} ${n2(chestY - 8)} Q ${cx} ${n2(chestY + 2)} ${n2(cx - chestW + 2)} ${n2(chestY - 6)} Z" fill="${sp.skin}" opacity=".95"/>`);
      d.push(`<ellipse cx="${n2(chestCx - 6)}" cy="${n2(chestY + 2)}" rx="9" ry="7.5" fill="none" stroke="${shade(o.primary, 0.3)}" stroke-width="1.6" opacity=".7"/>`);
    }
    d.push(`<path d="M${n2(cx - waistW)} ${n2(waistY + 2)} L ${n2(cx + waistW)} ${n2(waistY)}" stroke="${shade(o.primary, 0.35)}" stroke-width="1.6" opacity=".55"/>`);
  } else if (k === 'gown') {
    d.push(`<path d="M${n2(cx - chestW - 4)} ${n2(chestY + 2)} Q ${cx} ${n2(chestY + 26)} ${n2(cx + chestW + 4)} ${n2(chestY)} L ${n2(cx + waistW + 2)} ${n2(waistY)} Q ${cx} ${n2(waistY + 8)} ${n2(cx - waistW - 2)} ${n2(waistY - 2)} Z" fill="url(#cloth)"/>`);
    if (fem) {
      d.push(`<path d="M${n2(cx - chestW - 6)} ${n2(shoulderY - 4)} Q ${cx} ${n2(chestY - 2)} ${n2(cx + chestW + 6)} ${n2(shoulderY - 6)}" fill="none" stroke="${sp.skin}" stroke-width="${n2(5)}" opacity=".9"/>`);
      d.push(`<ellipse cx="${n2(chestCx - 5)}" cy="${n2(chestY - 2)}" rx="8.5" ry="7" fill="${sp.skin}"/>`);
      d.push(`<ellipse cx="${n2(chestCx + 8)}" cy="${n2(chestY - 3)}" rx="7.5" ry="6.4" fill="${sp.skin}"/>`);
      d.push(`<path d="M${n2(cx - chestW - 4)} ${n2(chestY + 2)} Q ${cx} ${n2(chestY + 22)} ${n2(cx + chestW + 4)} ${n2(chestY)} Q ${cx} ${n2(chestY + 12)} ${n2(cx - chestW - 4)} ${n2(chestY + 2)} Z" fill="${shade(skinOf(sp), -0.06)}" opacity=".9"/>`);
    }
    d.push(`<path d="M${n2(cx - waistW - 2)} ${n2(waistY - 1)} L ${n2(cx + waistW + 2)} ${n2(waistY)}" stroke="${acc}" stroke-width="3.4" opacity=".95"/>`);
  } else if (k === 'armor') {
    d.push(`<path d="M${n2(cx - chestW - 3)} ${n2(chestY - 4)} Q ${cx} ${n2(chestY + 20)} ${n2(cx + chestW + 3)} ${n2(chestY - 6)} L ${n2(cx + waistW + 1)} ${n2(waistY + 2)} Q ${cx} ${n2(waistY + 10)} ${n2(cx - waistW - 1)} ${n2(waistY)} Z" fill="${o.primary}"/>`);
    d.push(`<path d="M${n2(cx - 6)} ${n2(chestY - 2)} L ${n2(cx + 14)} ${n2(chestY + 16)}" stroke="${shade(o.primary, -0.4)}" stroke-width="2.4"/>`);
    d.push(`<ellipse cx="${n2(cx - shW + 1)}" cy="${n2(shoulderY - 2)}" rx="${n2(shW * 0.55)}" ry="9" fill="${o.secondary}" stroke="${shade(o.secondary, -0.4)}" stroke-width="1.6"/>`);
    d.push(`<ellipse cx="${n2(cx + shW - 1)}" cy="${n2(shoulderY - 4)}" rx="${n2(shW * 0.6)}" ry="10" fill="${o.secondary}" stroke="${shade(o.secondary, -0.4)}" stroke-width="1.6"/>`);
    d.push(`<path d="M${n2(cx - 3)} ${n2(chestY + 6)} L ${n2(cx + 3)} ${n2(chestY + 6)} L ${n2(cx + 3)} ${n2(waistY + 2)} L ${n2(cx - 3)} ${n2(waistY + 2)} Z" fill="${acc}" opacity=".85"/>`);
  } else if (k === 'robe' || k === 'prayer' || k === 'kimono') {
    const cloth = k === 'prayer' ? o.primary : o.primary;
    d.push(`<path d="M${n2(cx - chestW - 3)} ${n2(chestY - 6)} L ${n2(cx + chestW + 3)} ${n2(chestY - 8)} L ${n2(cx + waistW + 3)} ${n2(waistY + 4)} L ${n2(cx - waistW - 3)} ${n2(waistY + 4)} Z" fill="${cloth}"/>`);
    if (fem && k !== 'prayer') {
      d.push(`<path d="M${n2(cx - 12)} ${n2(chestY - 6)} Q ${n2(cx + 1)} ${n2(chestY + 18)} ${n2(cx + 14)} ${n2(chestY - 8)} Q ${n2(cx + 2)} ${n2(chestY + 2)} ${n2(cx - 12)} ${n2(chestY - 6)} Z" fill="${sp.skin}"/>`);
    }
    if (k === 'kimono') d.push(`<path d="M${n2(cx - chestW - 3)} ${n2(chestY - 6)} L ${n2(cx + 10)} ${n2(waistY)} L ${n2(cx + chestW + 3)} ${n2(chestY - 8)} Z" fill="${o.secondary}" opacity=".9"/>`);
    d.push(`<path d="M${n2(cx - waistW - 4)} ${n2(waistY - 2)} L ${n2(cx + waistW + 4)} ${n2(waistY - 4)} L ${n2(cx + waistW + 3)} ${n2(waistY + 12)} L ${n2(cx - waistW - 3)} ${n2(waistY + 14)} Z" fill="${acc}" opacity="${k === 'kimono' ? 1 : 0.9}"/>`);
    if (k === 'prayer') d.push(`<path d="M${cx} ${n2(chestY - 2)} m -4 0 h 8 m -4 -4 v 14" stroke="${o.secondary}" stroke-width="2.6" fill="none"/>`);
  } else if (k === 'rags') {
    d.push(`<path d="M${n2(cx - chestW)} ${n2(chestY)} l 10 8 l -8 10 l 12 6" fill="none" stroke="${shade(o.primary, -0.3)}" stroke-width="3"/>`);
    d.push(`<path d="M${n2(cx - 14)} ${n2(shoulderY)} L ${n2(cx + 16)} ${n2(chestY + 4)}" stroke="${o.secondary}" stroke-width="7" opacity=".85"/>`);
  } else if (k === 'husk') {
    for (let i = 0; i < 3; i++) {
      const y = chestY - 10 + i * 26;
      d.push(`<rect x="${n2(cx - chestW - 2 + i)}" y="${n2(y)}" width="${n2(chestW * 2 + 4 - i * 2)}" height="18" rx="4" fill="#575163" stroke="#2b2833" stroke-width="2"/>`);
    }
    d.push(`<path d="M${n2(cx - 6)} ${n2(chestY - 4)} L ${n2(cx + 2)} ${n2(waistY + 8)}" stroke="${acc}" stroke-width="2.6" opacity=".9"/>`);
  } else if (k === 'hide') {
    d.push(`<path d="M${n2(cx - shW - 4)} ${n2(shoulderY - 6)} Q ${cx} ${n2(chestY - 4)} ${n2(cx + shW + 4)} ${n2(shoulderY - 8)} L ${n2(cx + shW + 2)} ${n2(chestY + 6)} Q ${cx} ${n2(chestY + 16)} ${n2(cx - shW - 2)} ${n2(chestY + 8)} Z" fill="${o.secondary}"/>`);
    d.push(`<path d="M${n2(cx - chestW)} ${n2(chestY + 6)} Q ${cx} ${n2(chestY + 14)} ${n2(cx + chestW)} ${n2(chestY + 4)}" fill="none" stroke="${shade(skinOf(sp), -0.4)}" stroke-width="2"/>`);
  }
  return d.join('');
}

function skinOf(sp: SpriteSpec) { return sp.skin; }

function headLayer(sp: SpriteSpec, cx: number, cy: number, neckY: number, r: number, fem: boolean, _a: number, _b: number, height: number): string {
  const skin = sp.skin, skinD = shade(skin, -0.25);
  const hx = cx + 3;
  const o: string[] = [];
  o.push(`<path d="M${n2(cx - 6)} ${n2(neckY - 2)} L ${n2(cx + 8)} ${n2(neckY - 2)} L ${n2(cx + 7)} ${n2(cy + r * 0.6)} L ${n2(cx - 5)} ${n2(cy + r * 0.62)} Z" fill="${skinD}"/>`);
  o.push(`<ellipse cx="${n2(hx)}" cy="${n2(cy)}" rx="${n2(r * 0.94)}" ry="${n2(r * 1.04)}" fill="${skin}"/>`);
  // jaw / chin
  o.push(`<path d="M${n2(hx - r * 0.8)} ${n2(cy + r * 0.3)} Q ${n2(hx + r * 0.25)} ${n2(cy + r * 1.5)} ${n2(hx + r * 0.82)} ${n2(cy + r * 0.2)}" fill="${skin}"/>`);
  if (sp.body === 'wraith') o.push(`<path d="M${n2(hx - r)} ${n2(cy - r * 0.2)} Q ${hx} ${n2(cy + r * 0.9)} ${n2(hx + r)} ${n2(cy - r * 0.2)}" fill="${sp.outfit.primary}"/>`);
  // eyes (looking right)
  const ey = cy + r * 0.14;
  if (sp.body === 'waifu' || sp.body === 'brute') {
    o.push(eyePath(hx + r * 0.5, ey, fem ? 7.6 : 5.6, sp.eyes.color, fem));
    o.push(eyePath(hx - r * 0.44, ey + 1.5, fem ? 6 : 4.4, sp.eyes.color, fem));
    if (fem) o.push(`<path d="M${n2(hx + r * 0.2)} ${n2(ey + r * 0.72)} q 3 2 6 0" fill="none" stroke="${shade(skin, -0.5)}" stroke-width="1.4" opacity=".7"/>`);
    o.push(`<path d="M${n2(hx + r * 0.9)} ${n2(cy + r * 0.16)} q 3 3 -1 5" fill="none" stroke="${skinD}" stroke-width="1.6" opacity=".8"/>`);
    if (fem) o.push(`<ellipse cx="${n2(hx - r * 0.5)}" cy="${n2(ey + 8)}" rx="5" ry="3" fill="#ff8fa3" opacity=".35"/>`);
  } else {
    const gc = sp.outfit.accent;
    o.push(`<ellipse cx="${n2(hx + r * 0.44)}" cy="${n2(ey)}" rx="5.2" ry="3.6" fill="${gc}"/><ellipse cx="${n2(hx + r * 0.46)}" cy="${n2(ey)}" rx="1.5" ry="3.2" fill="#12080f"/><ellipse cx="${n2(hx - r * 0.4)}" cy="${n2(ey)}" rx="4.6" ry="3.2" fill="${gc}" opacity=".92"/><ellipse cx="${n2(hx - r * 0.38)}" cy="${n2(ey)}" rx="1.3" ry="2.8" fill="#12080f"/>`);
  }
  // mouth
  o.push(`<path d="M${n2(hx + r * 0.3)} ${n2(cy + r * 0.6)} q 3 2 6 -1" fill="none" stroke="${shade(skin, -0.55)}" stroke-width="1.6" stroke-linecap="round"/>`);
  // hair front
  o.push(hairFront(sp, hx, cy, r, fem));
  // ears / horns / halo
  if (sp.trim?.ears === 'cat') o.push(`<path d="M${n2(hx - r * 0.7)} ${n2(cy - r * 0.9)} l 8 -12 l 6 12 Z M${n2(hx + r * 0.45)} ${n2(cy - r * 1)} l 7 -12 l 7 11 Z" fill="${sp.hair.color}"/>`);
  if (sp.trim?.ears === 'elf') o.push(`<path d="M${n2(hx - r * 0.95)} ${n2(cy + 2)} l -12 -6 l 11 11 Z" fill="${skin}"/>`);
  if (sp.hair.style === 'horns' || sp.trim?.crown) o.push(`<path d="M${n2(hx - r * 0.66)} ${n2(cy - r * 0.95)} q -10 -22 6 -26 q -4 16 4 22 Z" fill="#3a2f3a"/><path d="M${n2(hx + r * 0.7)} ${n2(cy - r * 1)} q 12 -20 -2 -25 q 2 15 -6 21 Z" fill="#463846"/>`);
  if (sp.trim?.crown) o.push(`<path d="M${n2(hx - 16)} ${n2(cy - r * 1.15)} l 5 -12 l 6 8 l 6 -12 l 6 12 l 6 -8 l 5 12 Z" fill="#f5c453" stroke="#8a6d21" stroke-width="1.4"/>`);
  if (sp.trim?.halo) o.push(`<ellipse cx="${n2(hx + 1)}" cy="${n2(cy - r * 1.8)}" rx="21" ry="6" fill="none" stroke="#ffe9a8" stroke-width="3.4" opacity=".95"/>`);
  if (sp.trim?.mask) o.push(`<path d="M${n2(hx - r * 0.95)} ${n2(cy + r * 0.34)} q ${n2(r * 0.95)} ${n2(r * 0.7)} ${n2(r * 1.9)} 0 l 0 12 q ${n2(-r * 1)} ${n2(r * 0.5)} ${n2(-r * 1.9)} 0 Z" fill="${shade(sp.outfit.primary, 0.1)}" opacity=".95"/>`);
  // hood
  if (sp.trim?.hood || sp.hair.style === 'hood') {
    o.push(`<path d="M${n2(hx - r * 1.35)} ${n2(cy + r * 0.5)} Q ${n2(hx - r * 0.4)} ${n2(cy - r * 2.15)} ${n2(hx + r * 1.3)} ${n2(cy - r * 0.1)} Q ${n2(hx + r * 0.5)} ${n2(cy - r * 0.55)} ${n2(hx + r * 0.1)} ${n2(cy - r * 0.1)} Q ${n2(hx - r * 0.75)} ${n2(cy + r * 0.35)} ${n2(hx - r * 1.35)} ${n2(cy + r * 0.5)} Z" fill="${sp.outfit.primary}" stroke="${shade(sp.outfit.primary, -0.35)}" stroke-width="1.6"/>`);
  }
  void height;
  return o.join('');
}

function eyePath(x: number, y: number, r: number, color: string, fem: boolean): string {
  return `<g><ellipse cx="${n2(x)}" cy="${n2(y)}" rx="${n2(r)}" ry="${n2(r * (fem ? 1.28 : 1.05))}" fill="#fff"/>
  <ellipse cx="${n2(x + r * 0.22)}" cy="${n2(y + r * 0.1)}" rx="${n2(r * 0.72)}" ry="${n2(r * 0.9)}" fill="${color}"/>
  <ellipse cx="${n2(x + r * 0.26)}" cy="${n2(y + r * 0.3)}" rx="${n2(r * 0.34)}" ry="${n2(r * 0.42)}" fill="#160f1e"/>
  <ellipse cx="${n2(x + r * 0.55)}" cy="${n2(y - r * 0.5)}" rx="${n2(r * 0.3)}" ry="${n2(r * 0.26)}" fill="#fff" opacity=".95"/>
  ${fem ? `<path d="M${n2(x - r)} ${n2(y - r * 1.15)} q ${n2(r)} ${n2(-r * 0.75)} ${n2(r * 2.1)} ${n2(r * 0.1)}" fill="none" stroke="#241a2c" stroke-width="2.1" stroke-linecap="round"/>` : ''}</g>`;
}

function hairBack(sp: SpriteSpec, cx: number, cy: number, r: number, hipY: number, chestY: number, height: number): string {
  const c = sp.hair.color, s = sp.hair.shade, st = sp.hair.style;
  const long = st === 'long' || st === 'braid' || st === 'twin' || st === 'pony' || st === 'wild';
  const back: string[] = [];
  const cap = `<path d="M${n2(cx - r * 1.12)} ${n2(cy + r * 0.1)} Q ${n2(cx - r * 1.15)} ${n2(cy - r * 1.55)} ${cx} ${n2(cy - r * 1.45)} Q ${n2(cx + r * 1.2)} ${n2(cy - r * 1.5)} ${n2(cx + r * 1.12)} ${n2(cy + r * 0.25)} Q ${cx} ${n2(cy - r * 0.4)} ${n2(cx - r * 1.12)} ${n2(cy + r * 0.1)} Z" fill="${s}"/>`;
  back.push(cap);
  if (long) {
    const len = st === 'long' ? 150 : st === 'wild' ? 110 : 120;
    back.push(`<path d="M${n2(cx - r * 1.05)} ${n2(cy - r * 0.2)} C ${n2(cx - r * 2.5)} ${n2(cy + len * 0.5)}, ${n2(cx - r * 1.6)} ${n2(hipY + 30)} ${n2(cx - 10)} ${n2(hipY + 46)} C ${n2(cx + r * 0.4)} ${n2(hipY + 24)} ${n2(cx + r * 1.4)} ${n2(cy + len * 0.35)} ${n2(cx + r * 0.9)} ${n2(cy - r * 0.4)} Z" fill="${c}"/>`);
    back.push(`<path d="M${n2(cx - r * 0.7)} ${n2(cy + r * 0.4)} C ${n2(cx - r * 1.7)} ${n2(cy + len * 0.6)}, ${n2(cx - r * 0.9)} ${n2(hipY + 20)} ${n2(cx - 14)} ${n2(hipY + 40)}" fill="none" stroke="${s}" stroke-width="3" opacity=".65"/>`);
  }
  if (st === 'twin') {
    for (const dir of [-1, 1]) {
      back.push(`<path d="M${n2(cx + dir * r * 1.02)} ${n2(cy - r * 0.35)} q ${dir * 22} -6 ${dir * 24} 26 q 4 60 -${dir * 6} 116 q -${dir * 14} -46 -${dir * 10} -96 q -2 -30 -${dir * 8} -46 Z" fill="${c}"/>`);
      back.push(`<circle cx="${n2(cx + dir * r * 1.15)}" cy="${n2(cy - r * 0.2)}" r="6" fill="${sp.outfit.accent}"/>`);
    }
  }
  if (st === 'pony') {
    back.push(`<path d="M${n2(cx - r * 0.95)} ${n2(cy - r * 0.5)} q -30 6 -34 44 q -6 66 14 108 q 6 -60 16 -92 q 8 -26 18 -34 Z" fill="${c}"/>`);
    back.push(`<circle cx="${n2(cx - r * 0.95)}" cy="${n2(cy - r * 0.4)}" r="6.5" fill="${sp.outfit.accent}"/>`);
  }
  if (st === 'braid') {
    back.push(`<g>${[0, 1, 2, 3, 4, 5].map((i) => `<ellipse cx="${n2(cx - r * 0.62 - i * 1.6)}" cy="${n2(cy + r * 1.35 + i * 19)}" rx="${n2(11 - i)}" ry="9" fill="${i % 2 ? c : s}" stroke="${shade(s, -0.2)}" stroke-width="1"/>`).join('')}</g>`);
  }
  if (st === 'wild') {
    for (let i = 0; i < 7; i++) {
      const a = -2.5 + i * 0.42;
      back.push(`<path d="M${n2(cx + Math.cos(a) * r * 0.9)} ${n2(cy + Math.sin(a) * r * 0.9)} l ${n2(Math.cos(a) * 30)} ${n2(Math.sin(a) * 26 - 10)} l ${n2(-Math.cos(a) * 8)} ${n2(10)} Z" fill="${i % 2 ? c : s}"/>`);
    }
  }
  void chestY; void height;
  return g('hairBack', '', back.join(''));
}

function hairFront(sp: SpriteSpec, hx: number, cy: number, r: number, fem: boolean): string {
  const c = sp.hair.color, s = sp.hair.shade, st = sp.hair.style;
  if (st === 'bald' || st === 'horns') return `<path d="M${n2(hx - r * 0.95)} ${n2(cy - r * 0.5)} Q ${hx} ${n2(cy - r * 1.35)} ${n2(hx + r * 0.95)} ${n2(cy - r * 0.5)}" fill="none" stroke="${s}" stroke-width="3" opacity=".8"/>`;
  if (st === 'hood') return '';
  const fringe: string[] = [];
  fringe.push(`<path d="M${n2(hx - r * 1.08)} ${n2(cy - r * 0.25)} Q ${n2(hx - r * 0.9)} ${n2(cy - r * 1.6)} ${n2(hx + r * 0.15)} ${n2(cy - r * 1.5)} Q ${n2(hx + r * 1.15)} ${n2(cy - r * 1.3)} ${n2(hx + r * 1.1)} ${n2(cy - r * 0.15)} Q ${n2(hx + r * 0.62)} ${n2(cy - r * 0.55)} ${n2(hx + r * 0.35)} ${n2(cy - r * 0.05)} Q ${n2(hx - r * 0.1)} ${n2(cy - r * 0.72)} ${n2(hx - r * 0.45)} ${n2(cy + r * 0.05)} Q ${n2(hx - r * 0.72)} ${n2(cy - r * 0.5)} ${n2(hx - r * 1.08)} ${n2(cy - r * 0.25)} Z" fill="${c}"/>`);
  fringe.push(`<path d="M${n2(hx - r * 0.5)} ${n2(cy - r * 1.35)} Q ${n2(hx - r * 0.2)} ${n2(cy - r * 0.5)} ${n2(hx - r * 0.42)} ${n2(cy - r * 0.1)}" fill="none" stroke="${shade(c, 0.28)}" stroke-width="2" opacity=".7"/>`);
  fringe.push(`<path d="M${n2(hx - r * 0.35)} ${n2(cy - r * 1.28)} Q ${n2(hx + r * 0.35)} ${n2(cy - r * 1.5)} ${n2(hx + r * 0.85)} ${n2(cy - r * 0.9)}" fill="none" stroke="${shade(c, 0.42)}" stroke-width="3.4" opacity=".75" stroke-linecap="round"/>`);
  if (fem) {
    fringe.push(`<path d="M${n2(hx + r * 1.02)} ${n2(cy - r * 0.2)} q 6 34 -2 62 q -8 -30 -6 -52 Z" fill="${c}"/>`);
    fringe.push(`<path d="M${n2(hx - r * 1.0)} ${n2(cy - r * 0.15)} q -7 30 0 56 q 8 -28 6 -48 Z" fill="${s}"/>`);
  }
  if (st === 'short') fringe.push(`<path d="M${n2(hx - r * 1.05)} ${n2(cy - r * 0.3)} Q ${hx} ${n2(cy - r * 1.5)} ${n2(hx + r * 1.05)} ${n2(cy - r * 0.3)} Z" fill="${c}"/>`);
  return fringe.join('');
}

function armAndWeapon(sp: SpriteSpec, sx: number, sy: number, hx: number, hy: number, limbW: number, kind: string, skin: string, pri: string, sec: string, acc: string, fem: boolean, bulk: number, height: number): string {
  const o = sp.outfit;
  const sleeve = kind === 'robe' ? o.primary : kind === 'kimono' ? o.secondary : kind === 'catsuit' ? o.primary : kind === 'husk' ? '#5a5560' : null;
  const upper = `<path d="M${n2(sx)} ${n2(sy)} Q ${n2((sx + hx) / 2 + 4)} ${n2((sy + hy) / 2 + 8)} ${n2(hx)} ${n2(hy)}" fill="none" stroke="${sleeve ?? skin}" stroke-width="${n2(limbW * (kind === 'robe' || kind === 'kimono' ? 1.9 : 1))}" stroke-linecap="round"/>`;
  const wide = kind === 'robe' || kind === 'kimono' ? `<path d="M${n2(sx - 4)} ${n2(sy + 2)} q 22 10 26 34 l -16 6 q -6 -22 -18 -28 Z" fill="${sleeve}" opacity=".95"/>` : '';
  const glove = kind === 'catsuit' || kind === 'armor' || kind === 'husk';
  const hand = `<circle cx="${n2(hx + 1)}" cy="${n2(hy + 1)}" r="${n2(limbW * 0.5)}" fill="${glove ? shade(o.primary, -0.1) : skin}"/>`;
  const w = weapon(sp, hx, hy, acc, bulk, height, fem);
  return upper + wide + hand + g('weapon', '', w);
}

function weapon(sp: SpriteSpec, x: number, y: number, acc: string, bulk: number, _h: number, fem: boolean): string {
  const k = (sp.trim?.weapon as string) || (sp.body === 'waifu' ? 'sword' : 'claw');
  const steel = 'url(#steel)';
  const gl = fem ? 1 : 1.25;
  switch (k) {
    case 'katana':
      return `<g transform="rotate(-24 ${n2(x)} ${n2(y)})">
        <rect x="${n2(x - 3)}" y="${n2(y - 6)}" width="6" height="20" rx="2" fill="#2b2233"/>
        <rect x="${n2(x - 9)}" y="${n2(y - 10)}" width="18" height="5" rx="2" fill="${acc}"/>
        <path d="M${n2(x - 2.6)} ${n2(y - 10)} L ${n2(x + 2.6)} ${n2(y - 10)} L ${n2(x + 3.4)} ${n2(y - 96 * gl)} Q ${n2(x)} ${n2(y - 104 * gl)} ${n2(x - 3.2)} ${n2(y - 94 * gl)} Z" fill="${steel}" stroke="#5c6a80" stroke-width="1"/>
        <path d="M${n2(x)} ${n2(y - 12)} L ${n2(x + 0.4)} ${n2(y - 96 * gl)}" stroke="#fff" stroke-width="1.4" opacity=".85"/>
      </g>`;
    case 'blade':
      return `<g transform="rotate(-16 ${n2(x)} ${n2(y)})">
        <rect x="${n2(x - 3)}" y="${n2(y - 4)}" width="6" height="16" rx="2" fill="#31263b"/>
        <path d="M${n2(x - 3)} ${n2(y - 4)} L ${n2(x + 3)} ${n2(y - 4)} L ${n2(x + 22)} ${n2(y - 14)} L ${n2(x + 26)} ${n2(y - 4)} L ${n2(x + 4)} ${n2(y + 6)} Z" fill="${acc}" opacity=".25"/>
        <path d="M${n2(x - 2.4)} ${n2(y - 6)} L ${n2(x + 2.4)} ${n2(y - 6)} L ${n2(x + 3)} ${n2(y - 62 * gl)} Q ${n2(x)} ${n2(y - 74 * gl)} ${n2(x - 3)} ${n2(y - 60 * gl)} Z" fill="${steel}" stroke="#5c6a80" stroke-width="1"/>
      </g>`;
    case 'sword':
      return `<g transform="rotate(-14 ${n2(x)} ${n2(y)})">
        <rect x="${n2(x - 3.2)}" y="${n2(y - 4)}" width="6.4" height="18" rx="2.4" fill="#2c2338"/>
        <path d="M${n2(x - 12)} ${n2(y - 6)} q 12 -6 24 0" fill="none" stroke="${acc}" stroke-width="4"/>
        <path d="M${n2(x - 3.6)} ${n2(y - 8)} L ${n2(x + 3.6)} ${n2(y - 8)} L ${n2(x + 4)} ${n2(y - 76 * gl)} L ${n2(x)} ${n2(y - 86 * gl)} L ${n2(x - 4)} ${n2(y - 76 * gl)} Z" fill="${steel}" stroke="#5c6a80"/>
      </g>`;
    case 'greatsword':
      return `<g transform="rotate(-10 ${n2(x)} ${n2(y)})">
        <rect x="${n2(x - 4)}" y="${n2(y - 6)}" width="8" height="24" rx="3" fill="#2c2338"/>
        <path d="M${n2(x - 18)} ${n2(y - 8)} q 18 -8 36 0" fill="none" stroke="${acc}" stroke-width="5"/>
        <path d="M${n2(x - 8)} ${n2(y - 10)} L ${n2(x + 8)} ${n2(y - 10)} L ${n2(x + 10)} ${n2(y - 92 * bulk)} L ${n2(x)} ${n2(y - 106 * bulk)} L ${n2(x - 10)} ${n2(y - 92 * bulk)} Z" fill="${steel}" stroke="#4d5a70" stroke-width="1.6"/>
      </g>`;
    case 'shield':
      return `<g transform="translate(${n2(x - 4)} ${n2(y + 6)})">
        <path d="M-24 -46 q 24 -12 48 0 q 4 44 -24 68 q -28 -24 -24 -68 Z" fill="${shade(sp.outfit.primary, -0.05)}" stroke="${acc}" stroke-width="3.4"/>
        <path d="M-24 -46 q 24 -12 48 0 l -2 18 q -22 -10 -44 0 Z" fill="${sp.outfit.secondary}"/>
        <path d="M0 -32 l 0 40 M-14 -18 l 28 0" stroke="${acc}" stroke-width="3" opacity=".9"/>
        <circle cx="0" cy="-16" r="5" fill="${acc}"/>
      </g>`;
    case 'bow':
      return `<g transform="rotate(8 ${n2(x)} ${n2(y)})">
        <path d="M${n2(x + 2)} ${n2(y - 62)} Q ${n2(x + 34)} ${n2(y)} ${n2(x + 2)} ${n2(y + 62)}" fill="none" stroke="${shade(sp.outfit.secondary, 0.1)}" stroke-width="6" stroke-linecap="round"/>
        <path d="M${n2(x + 2)} ${n2(y - 62)} L ${n2(x + 2)} ${n2(y + 62)}" stroke="#e8e3f5" stroke-width="1.6"/>
        <path d="M${n2(x + 2)} ${n2(y - 30)} q 6 30 0 60" fill="none" stroke="${acc}" stroke-width="4" opacity=".8"/>
      </g>`;
    case 'staff':
      return `<g transform="rotate(-8 ${n2(x)} ${n2(y)})">
        <rect x="${n2(x - 2.6)}" y="${n2(y - 96)}" width="5.2" height="140" rx="2.6" fill="#6b4f38"/>
        <path d="M${n2(x - 2.6)} ${n2(y + 40)} q 3 8 6 0" fill="none" stroke="#4a3626" stroke-width="2"/>
        <circle cx="${n2(x)}" cy="${n2(y - 104)}" r="13" fill="none" stroke="${acc}" stroke-width="4"/>
        <circle cx="${n2(x)}" cy="${n2(y - 104)}" r="7" fill="${acc}" opacity=".9"/>
        <path d="M${n2(x - 16)} ${n2(y - 104)} h -8 M${n2(x + 16)} ${n2(y - 104)} h 8" stroke="${acc}" stroke-width="2.6" opacity=".8"/>
      </g>`;
    case 'tome':
      return `<g transform="translate(${n2(x + 6)} ${n2(y - 6)}) rotate(-12)">
        <path d="M-18 -12 h 36 v 30 h -36 Z" fill="${shade(sp.outfit.secondary, -0.1)}" stroke="${acc}" stroke-width="2"/>
        <path d="M0 -12 v 30" stroke="${acc}" stroke-width="1.6" opacity=".8"/>
        <path d="M-18 -12 q -8 12 0 30 M18 -12 q 8 12 0 30" fill="none" stroke="${acc}" stroke-width="2"/>
        <circle cx="0" cy="2" r="4.6" fill="${acc}"/>
      </g>`;
    case 'orb':
      return `<g><circle cx="${n2(x + 8)}" cy="${n2(y - 6)}" r="14" fill="${acc}" opacity=".28"/><circle cx="${n2(x + 8)}" cy="${n2(y - 6)}" r="9.5" fill="url(#aura)"/><circle cx="${n2(x + 5)}" cy="${n2(y - 10)}" r="3" fill="#fff" opacity=".85"/></g>`;
    case 'claw':
      return `<g transform="translate(${n2(x + 2)} ${n2(y)})">
        ${[0, 1, 2, 3].map((i) => `<path d="M${i * 5 - 6} -2 q ${5 + i} -${16 + i * 3} ${9 + i} -${26 + i * 4}" fill="none" stroke="#e8e4d8" stroke-width="${3.4 - i * 0.2}" stroke-linecap="round"/>`).join('')}
      </g>`;
    default:
      return '';
  }
}

function fxLayer(sp: SpriteSpec, cx: number, chestY: number, headCY: number, feetY: number): string {
  const acc = sp.outfit.accent;
  const el = sp.element;
  const glyph = elementGlyph(el, cx, chestY - 60, acc);
  return `<g class="slash" opacity="0"><path d="M${cx - 78} ${n2(chestY + 40)} Q ${cx + 10} ${n2(chestY - 46)} ${cx + 88} ${n2(chestY + 26)}" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M${cx - 70} ${n2(chestY + 52)} Q ${cx + 14} ${n2(chestY - 24)} ${cx + 82} ${n2(chestY + 44)}" fill="none" stroke="${acc}" stroke-width="4" stroke-linecap="round"/></g>
  <g class="burst" opacity="0">${glyph}</g>
  <g class="chain" opacity="0"><path d="M${cx - 40} ${n2(feetY - 130)} q 40 26 80 -6" fill="none" stroke="${acc}" stroke-width="3" stroke-dasharray="6 8"/></g>
  <g class="auraFx" opacity="0"><circle cx="${cx}" cy="${n2(chestY)}" r="70" fill="url(#aura)"/></g>
  <g class="sweat" opacity="0"><path d="M${n2(cx + 26)} ${n2(headCY - 30)} q 6 10 0 14 q -6 -6 0 -14" fill="#8fd8ff"/></g>`;
}

function elementGlyph(el: string, x: number, y: number, color: string): string {
  const at = (d: string) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" transform="translate(${n2(x)} ${n2(y)})"/>`;
  switch (el) {
    case 'fire': return at('M0 16 q -16 -8 -8 -24 q 2 8 8 8 q 10 -14 4 -26 q 20 14 12 34 q -4 10 -16 8 Z');
    case 'ice': return `<g transform="translate(${n2(x)} ${n2(y)})" stroke="${color}" stroke-width="3" stroke-linecap="round">${[0, 60, 120].map((a) => `<line x1="0" y1="-20" x2="0" y2="20" transform="rotate(${a})"/>`).join('')}</g>`;
    case 'thunder': return at('M4 -22 L -10 2 L 2 2 L -4 22 L 14 -6 L 2 -6 Z');
    case 'nature': return at('M0 18 q -20 -6 -18 -24 q 22 -4 26 14 q 6 -18 22 -16 q 2 22 -18 26 Z');
    case 'holy': return `<g transform="translate(${n2(x)} ${n2(y)})" stroke="${color}" stroke-width="3" stroke-linecap="round"><circle r="14" fill="none"/>${[0, 45, 90, 135].map((a) => `<line x1="0" y1="-22" x2="0" y2="22" transform="rotate(${a})"/>`).join('')}</g>`;
    case 'dark': return at('M6 -20 a 20 20 0 1 0 0 40 a 15 15 0 1 1 0 -40 Z');
    default: return at('M0 -20 L 6 -6 L 20 -4 L 10 6 L 13 20 L 0 13 L -13 20 L -10 6 L -20 -4 L -6 -6 Z');
  }
}

export const SPRITE_VIEW = { w: W, h: H, ground: GROUND };
