/**
 * APK web build: fully static `next export` (output: export) with the offline flag.
 * The Next server API routes are stashed during the build — in APK mode every
 * request is answered by the IndexedDB local API (src/game/offline/localApi.ts),
 * so the exported bundle is 100% static and works with no server at all.
 *
 *   node scripts/build-apk.mjs   →   ./out  (Capacitor webDir)
 */
import { renameSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apiDir = resolve(root, 'src/app/api');
const stash = resolve(root, 'src/_api_stash');

if (existsSync(apiDir)) renameSync(apiDir, stash);
let failed = false;
try {
  const bin = resolve(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  const r = spawnSync(process.execPath, [bin, 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, BUILD_MODE: 'apk', NEXT_PUBLIC_OFFLINE: '1', NODE_ENV: 'production' },
  });
  if (r.error) { console.error('[build-apk] spawn failed:', r.error.message); failed = true; }
  else failed = r.status !== 0;
} finally {
  if (existsSync(stash)) renameSync(stash, apiDir);
}
if (failed) { console.error('[build-apk] export failed'); process.exit(1); }

// mark the bundle so the WebView shows nothing but the game
writeFileSync(resolve(root, 'out/.gitkeep'), 'static export — capacitor webDir\n');
console.log('[build-apk] out/ ready (offline bundle, NEXT_PUBLIC_OFFLINE baked in)');
