/** Renders the VAIN app icons (PNG) from an inline SVG using @resvg/resvg-js. */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outDir = resolve(import.meta.dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

function svg(size, { maskable = false, apple = false } = {}) {
  const pad = maskable ? 1.35 : 1;
  const S = (n) => (size / 2 + (n - size / 2) / pad).toFixed(1);
  const cx = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#2a1d4d"/><stop offset="55%" stop-color="#120c26"/><stop offset="100%" stop-color="#05040a"/>
    </radialGradient>
    <linearGradient id="gild" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffe9a8"/><stop offset="50%" stop-color="#f5c453"/><stop offset="100%" stop-color="#c08a1e"/>
    </linearGradient>
  </defs>
  ${maskable ? `<rect width="${size}" height="${size}" fill="#05040a"/>` : ''}
  <rect x="${S(6)}" y="${S(6)}" width="${S(size - 12) - S(6)}" height="${S(size - 12) - S(6)}" rx="${size * 0.18}" fill="url(#bg)" stroke="url(#gild)" stroke-width="${(size * 0.012).toFixed(1)}" opacity="${maskable ? '0' : '1'}"/>
  ${maskable ? `<circle cx="${cx}" cy="${cx}" r="${size * 0.47}" fill="url(#bg)"/>` : ''}
  <circle cx="${cx}" cy="${cx}" r="${size * 0.36 / pad}" fill="none" stroke="#a855f7" stroke-opacity=".5" stroke-width="${(size * 0.008).toFixed(1)}" stroke-dasharray="${(size * 0.02).toFixed(1)} ${(size * 0.045).toFixed(1)}"/>
  <circle cx="${cx}" cy="${cx}" r="${size * 0.28 / pad}" fill="none" stroke="#a855f7" stroke-opacity=".35" stroke-width="${(size * 0.005).toFixed(1)}"/>
  <path d="M ${S(size * 0.30)} ${S(size * 0.32)} L ${cx} ${S(size * 0.72)} L ${S(size * 0.70)} ${S(size * 0.32)}"
    fill="none" stroke="url(#gild)" stroke-width="${(size * 0.055).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${cx}" cy="${S(size * 0.78)}" r="${size * 0.022 / pad}" fill="#ff6b3d"/>
</svg>`;
}

function render(name, size, opts = {}) {
  const r = new Resvg(svg(size, opts), { fitTo: { mode: 'width', value: size } });
  const png = r.render().asPng();
  writeFileSync(resolve(outDir, name), png);
  console.log('[icons]', name, (png.length / 1024).toFixed(1) + ' KB');
}

render('icon-192.png', 192);
render('icon-512.png', 512);
render('icon-maskable-512.png', 512, { maskable: true });
render('apple-touch-icon.png', 180, { apple: true });

writeFileSync(resolve(outDir, 'icon.svg'), svg(512));
console.log('[icons] done');
