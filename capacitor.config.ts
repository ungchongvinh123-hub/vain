import type { CapacitorConfig } from '@capacitor/cli';

/**
 * VAIN ships as a fully offline APK: `out/` (see scripts/build-apk.mjs) contains a
 * static Next export whose data layer runs on IndexedDB — no server, no CDN,
 * no network permission required.
 */
const config: CapacitorConfig = {
  appId: 'app.vain.mobile',
  appName: 'VAIN',
  webDir: 'out',
  backgroundColor: '#05040a',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#05040a',
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#05040a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
