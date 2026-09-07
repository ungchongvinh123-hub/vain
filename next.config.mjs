/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
const APK = process.env.BUILD_MODE === 'apk';

const nextConfig = {
  reactStrictMode: true,
  // NOTE: do NOT customize distDir in APK mode — with `output: 'export'`, Next writes
  // the static bundle INTO distDir when it's custom, skipping the conventional out/ dir.
  // APK mode = fully static export (no server needed; the IndexedDB local API takes over)
  // web mode = regular build; `next start` serves both pages and the Postgres-backed API.
  output: APK ? 'export' : undefined,
  trailingSlash: APK,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  // Asset prefix kept empty so the app also works when served from a nested origin (WebView)
  assetPrefix: process.env.ASSET_PREFIX || undefined,
  basePath: process.env.NEXT_BASE_PATH || undefined,
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
};

export default nextConfig;
