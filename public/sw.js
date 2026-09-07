/* VAIN offline service worker — app-shell precache + cache-first runtime.
   Web mode only: the Capacitor APK is fully local and never registers this. */
const VERSION = 'vain-v1';
const SHELL = [
  '/', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // every game mutation is POST — never cached
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // always live against the server

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      const fetch$ = fetch(req).then((res) => {
        if (res.ok && (url.pathname.startsWith('/_next/') || /\.(css|js|png|jpg|svg|webmanifest|woff2?)$/.test(url.pathname) || url.pathname.endsWith('/'))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
      // navigation: fall back to cached shell when offline
      return req.mode === 'navigate' ? fetch$.catch(() => caches.match('/')) : fetch$;
    })
  );
});
