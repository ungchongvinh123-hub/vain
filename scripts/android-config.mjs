/**
 * Post-`cap add android` packaging conditions (idempotent, safe to run repeatedly):
 *  1. lock the launcher activity to sensorLandscape (theme already NoActionBarLaunch in template),
 *  2. override that launch theme: fullscreen + display-cutout shortEdges,
 *  3. provide the @color/splash_background the theme references,
 *  4. point release builds at keystore.properties (falls back to debug signing),
 *     enable R8 + resource shrinking, deterministic versionCode from CI run number.
 *
 * Run after `npx cap sync android` (local or in CI):  node scripts/android-config.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const android = resolve(root, 'android');
const manifest = resolve(android, 'app/src/main/AndroidManifest.xml');
const gradle = resolve(android, 'app/build.gradle');
const resDir = resolve(android, 'app/src/main/res');
const valuesDir = resolve(resDir, 'values');

if (!existsSync(manifest)) {
  console.error('[android-config] android/ project not found — run `npm run android:add` first');
  process.exit(1);
}

/* ------------------------------- 1) manifest -------------------------------- */
let m = readFileSync(manifest, 'utf8');
if (!m.includes('screenOrientation')) {
  // stay inside the MainActivity opening tag ([^>]* never crosses the closing '>')
  m = m.replace(
    /(<activity[^>]*?android:name="\.MainActivity"[^>]*?)(\/?>)/,
    '$1\n            android:screenOrientation="sensorLandscape" $2'
  );
  console.log('[android-config] activity locked to sensorLandscape');
}
writeFileSync(manifest, m);

/* ------------------------ 2) launch theme: fullscreen + cutout -------------- */
const LAUNCH_THEME = `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
        <item name="android:windowBackground">@color/splash_background</item>
    </style>`;
const styles = resolve(valuesDir, 'styles.xml');
if (existsSync(styles)) {
  let t = readFileSync(styles, 'utf8');
  if (/<style name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/.test(t)) {
    t = t.replace(/<style name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/, LAUNCH_THEME.trim());
    console.log('[android-config] launch theme overridden (fullscreen + cutout)');
  } else {
    t = t.replace('</resources>', `    ${LAUNCH_THEME}\n</resources>`);
    console.log('[android-config] launch theme added');
  }
  writeFileSync(styles, t);
}

/* -------------------------------- 3) colors --------------------------------- */
const colors = resolve(valuesDir, 'colors.xml');
if (existsSync(valuesDir)) {
  if (existsSync(colors)) {
    let c = readFileSync(colors, 'utf8');
    if (!c.includes('splash_background')) {
      c = c.replace('</resources>', '    <color name="splash_background">#05040a</color>\n</resources>');
      writeFileSync(colors, c);
    }
  } else {
    writeFileSync(colors, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="splash_background">#05040a</color>\n</resources>\n');
    console.log('[android-config] colors.xml created with splash_background');
  }
}

/* ---------------------------- 4) gradle signing + R8 ------------------------ */
let g = readFileSync(gradle, 'utf8');
if (!g.includes('keystore.properties')) {
  g = g.replace(
    /android \{/,
    `def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        config {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile rootProject.file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }`
  );
  g = g.replace(
    /buildTypes \{([\s\S]*?)release \{([\s\S]*?)\n(\s*)\}/,
    (full, bt, rel, indent) => `buildTypes {${bt}release {${rel}\n${indent}    signingConfig keystorePropertiesFile.exists() ? signingConfigs.config : signingConfigs.debug\n${indent}    minifyEnabled true\n${indent}    shrinkResources true\n${indent}    proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'\n${indent}  }`
  );
  // deterministic versionCode in CI (else keep template default)
  if (process.env.GITHUB_RUN_NUMBER) {
    const vc = process.env.GITHUB_RUN_NUMBER.padStart(2, '0');
    g = g.replace(/versionCode \d+/, `versionCode ${vc}`);
  }
  console.log('[android-config] release signing + shrinking wired to keystore.properties');
  writeFileSync(gradle, g);
}

console.log('[android-config] packaging conditions applied');
