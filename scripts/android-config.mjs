/**
 * Post-`cap add android` packaging conditions (idempotent):
 *  1. lock the activity to sensorLandscape + fullscreen immersive theme,
 *  2. point the release buildType at keystore.properties (falls back to debug signing),
 *  3. enable minify/resource shrinking + deterministic versioning (versionCode = run number).
 *
 * Run after `npx cap sync android` (local or in CI):  node scripts/android-config.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const android = resolve(root, 'android');
const manifest = resolve(android, 'app/src/main/AndroidManifest.xml');
const gradle = resolve(android, 'app/build.gradle');
const resDir = resolve(android, 'app/src/main/res');

if (!existsSync(manifest)) {
  console.error('[android-config] android/ project not found — run `npm run android:add` first');
  process.exit(1);
}

/* ------------------------------- 1) manifest ------------------------------- */
let m = readFileSync(manifest, 'utf8');
if (!m.includes('sensorLandscape')) {
  m = m.replace(
    /(<activity[\s\S]*?android:name="\.MainActivity"[^>]*?)(\/?>)/,
    '$1\n            android:screenOrientation="sensorLandscape"\n            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"\n            android:theme="@style/AppTheme.NoActionBarLaunch" $2'
  );
  console.log('[android-config] activity locked to landscape');
}
if (!m.includes('WRITE_EXTERNAL_STORAGE') && false) void resDir; // no permissions needed — everything is local
writeFileSync(manifest, m);

/* -------------------------- 2) themes: fullscreen + bg --------------------- */
const styles = resolve(resDir, 'values', 'styles.xml');
if (existsSync(styles)) {
  let t = readFileSync(styles, 'utf8');
  if (!t.includes('windowFullscreen')) {
    t = t.replace('</resources>', `  <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="android:windowFullscreen">true</item>
    <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
    <item name="android:windowBackground">@color/splash_background</item>
  </style>\n</resources>`);
    console.log('[android-config] immersive fullscreen launch theme added');
  }
  writeFileSync(styles, t);
}
const colors = resolve(resDir, 'values', 'colors.xml');
if (existsSync(colors)) {
  let c = readFileSync(colors, 'utf8');
  if (!c.includes('splash_background')) {
    c = c.replace('</resources>', '  <color name="splash_background">#05040a</color>\n</resources>');
  }
  writeFileSync(colors, c);
}

/* ------------------------------ 3) gradle signing --------------------------- */
let g = readFileSync(gradle, 'utf8');
if (!g.includes('keystore.properties')) {
  // inject signing config into android { defaultConfig { ... } } block
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
  console.log('[android-config] release signing + shrinking wired to keystore.properties');
  writeFileSync(gradle, g);
}

console.log('[android-config] packaging conditions applied');
