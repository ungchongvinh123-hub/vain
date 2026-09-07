# VAIN — Gacha Waifu Tactics

Offline-capable 2D **gacha turn-based RPG** — Next.js 15 (App Router) + PostgreSQL + Drizzle, Tailwind + Framer Motion,
**Web Audio API synth only** (zero audio files), procedurally drawn SVG sprites (zero image binaries), landscape 16:9,
packable as an **Android APK** via Capacitor with a GitHub Actions workflow included.

---

## Game systems

| Rule | Implementation |
|---|---|
| 30 waifu characters, 10 per role, **4 R / 4 SR / 2 SSR** each | `src/game/data/characters.ts` |
| Roles: Tank (high HP/DEF, aggro ×3.2) · Attacker (crit) · Support (heal/cleanse/buff) — **all three have damaging skills** | `AGGRO`, skill factory per role |
| **Exactly 20 skills per character** (12 active incl. free basic + 8 passives), generated **deterministically from the character seed** | `src/game/data/skillFactory.ts` (`seedRng(char.seed ^ hashStr(id))`) |
| Skill levels 1–5, cost = SP + gold; prerequisites & level gates | `repo.upgradeSkill` / mirrored offline |
| ≤ 6 skills brought to battle; basic attack is always equipped (0 mana) | `setLoadout` rules |
| **No mana pool** — at every turn start the acting unit auto-rolls a **6-face die**: rolled points = that turn's mana (gear can add +1 face, hard cap 6) | `rollDice`, `mods.diceBonus` |
| Skill costs spread over 1–6 (+0 basic) so a low roll is never a dead turn | cost ladders |
| Elements Fire/Ice/Thunder/Nature/Holy/Dark/Neutral; counters Fire↔Ice, Thunder↔Nature, Holy↔Dark = **×1.5** + on-screen “Khắc Chế” banner | `elementMult`, clash FX |
| Burn (strong DoT), Freeze (skip turn), Poison (DoT + stat-down), Shock (skills locked, basic only), heals/Regen/Cleanse/Shield/Taunt/Revive/splash ±1 | `src/game/engine/battle.ts` |
| Turn order = **team formation order** (fixed slots #1–#5) | queue builder |
| Monsters: no dice/mana, scripted AI — healers save allies, tanks taunt, everyone prioritises your Tank | `foeChoose` |
| Gacha 3% SSR / 17% SR / 80% R; 10-pull guarantees ≥1 SR+; duplicates become **independent roster copies** (never merged, 40-gem refund) | `systems/gacha.ts`, `doPull` |
| Characters to Lv.50 via EXP (+2 SP per level, +3 every 5th); dead members still gain 60% EXP | `completeStage` |
| 3 gear slots; class-gated weapons (Shield→Tank, Staff→Support, Sword/Bow/Katana→Attacker, accessories shared); 45 items R/SR/SSR; SR/SSR carry **multiple passives** (execute, heal-on-kill, elemental proc, +1 dice…) + substats | `data/gear.ts`, `equipGear` |
| +0→+15, each + = +15% base; **unequipped capped +3**, equipped ≤ that hero's level | `upgradeGear` |
| 10 stages / 3 regions, rising drop rates; Mystic Shop sells SSR gear & gem chests at brutal gold prices | `data/stages.ts` |

### Battle presentation (Darkest Dungeon style)

Side-by-side formation on element-tinted magic circles → on attack the stage **dims** and both fighters zoom into a
**50/50 split foreground at equal size** — *no text, no skill names* during the clash: weapon swing + slash VFX on the
attacker, flinch + floating damage numbers on the victim. Buff/heal zooms show only the acting side.
Action bar = square icon-only buttons; press & hold pops the description.
**QTEs** appear mid-zoom, frameless, unobtrusive and skill-appropriate: power-focus timing / connect-3-dots / tap ×10;
perfect = full damage, sloppy = reduced. Incoming heavy hits offer a fast, unpredictable power-focus **block**
(perfect = zero damage).

### Art & audio — 100% procedural

* Full-body standing sprites (idle/attack/skill/hit/dead) rendered from `src/game/sprite/build.ts` rigs,
  compiled once with `npx tsx scripts/generate-sprites.ts` into a pure-data TS module (`sprite/generated.ts`).
* Music + all SFX synthesized at runtime by `src/game/audio/synth.ts` (Web Audio). No files anywhere.

---

## Quick start (Web + Postgres)

```bash
npm install
# Point at any Postgres 15+:
export DATABASE_URL=postgres://user:pass@127.0.0.1:5432/vain

npm run db:generate     # emit drizzle migrations (already committed under drizzle/)
npm run setup           # migrate + seed content & demo save
npm run dev             # http://localhost:3000
```

New saves start with 5 low-rank heroes so stage 1 is immediately playable; `POST /api/save {action:"switchSave"}`
(dev) or the Settings screen switches save slots via the `vain_save` cookie.

## Scripts

| | |
|---|---|
| `npm run dev / build:web / start` | next dev server & production web build (server + Postgres) |
| `npm run typecheck` / `lint` | strict tsc, next lint (flat .eslintrc) |
| `npm run db:migrate / db:seed / db:reset` | drizzle migrate, seed, destructive reset |
| `npx tsx scripts/test-battle.ts` | headless engine battle simulation with assertions |
| `npm run sprites` (`generate-sprites.ts`) · `npm run icons` | regenerate art payloads |
| `npm run build:apk-web` | static offline export → `out/` (API routes stashed, IndexedDB mode baked in) |
| `npm run android:add / android:sync / android:open / android:apk[:debug]` | Capacitor lifecycle |

## Offline mode & the APK

The APK never talks to a server. `src/game/offline/localApi.ts` implements the **exact same HTTP contract**
(`/api/save`, `pull`, `team`, `loadout`, `skill`, `gear`, `shop`, `stage`, `stage/complete`, `battle/*`)
against **IndexedDB** using the same pure game systems, and the server battle-replay/anti-cheat is mirrored locally.

* `NEXT_PUBLIC_OFFLINE=1` (baked by `build:apk-web`) → every request goes local, always.
* In the web build the same adapter activates **automatically when the server is unreachable** — an offline
  PWA keeps playing and later can be migrated by re-loading the save.
* The service worker (`public/sw.js`) precaches the shell; it is skipped inside the APK (already local).

### Build the APK locally

```bash
npm run android:add      # build:apk-web + cap add android + sync + packaging patch
npm run android:apk       # ./gradlew assembleRelease (uses android/keystore.properties if present)
```

`node scripts/android-config.mjs` (called automatically) applies the packaging conditions:
`sensorLandscape` + fullscreen/cutout theme, keystore.properties-driven release signing, R8 shrinking.

### CI: `.github/workflows/android.yml`

Runs on push to `main`, PRs and `workflow_dispatch` (choice: release/debug):
typecheck/lint/sim → static export artifact → `cap add android` → gradle assemble → **uploadable APK artifacts**
(`vain-debug.apk`, `vain-release.apk`, proguard mapping).
No debug device is bricked without secrets: if no keystore is configured the release build falls back to
deterministic CI debug signing. For store builds add repo secrets:
`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
(`base64 your.keystore | pbcopy`).

## Layout & tech notes

* Fixed 1600×900 design stage (`src/components/Stage.tsx`) letterboxed to any device — landscape first,
  touch-friendly inside the WebView.
* Vietnamese UI microcopy throughout; fonts are the system stack so the bundle works with no network fetches.
* `next.config.mjs`: `output:'export'` only in APK mode — the web app keeps full server rendering + API.
* Everything reproducible: characters, skill trees, sprite drawings and shop stock are pure functions of committed seeds.
