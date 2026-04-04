// ============================================================
//  VoiceBill — Service Worker  v1.0
//  Caches app shell for offline use
// ============================================================

const CACHE_NAME = 'voicebill-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/config.js',
  '/settings.js',
  '/invoice.js',
  '/invoice-page.js',
  '/history.js',
  '/pay-menu.js',
  '/tax-modal.js',
  '/pin-auth.js',
  '/templates.js',
  '/pwa.js',
  '/app.js',
  '/manifest.json'
];

// Install: cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache first, fall back to network
// API calls always go to network
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always fetch API calls from network
  if (url.pathname.startsWith('/api')) {
    e.respondWith(fetch(e.request).catch(() =>
      new Response(JSON.stringify({ error: 'Offline — no internet connection' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // App shell: cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache new static assets
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
