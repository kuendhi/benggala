const CACHE_NAME = 'benggala-os-v1';
const STATIC_ASSETS = [
  '/',
  '/static/assets/css/style.css',
  '/static/assets/js/coco_id.js',
  '/static/assets/js/cctv.js',
  '/static/assets/js/cockpit.js',
  '/static/assets/js/autolock.js',
  '/static/assets/js/missions.js',
  '/static/assets/js/dossier.js',
  '/static/assets/js/roadmap.js',
  '/static/assets/js/detector.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Non-critical cache error on install:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then((networkResponse) => {
        return networkResponse;
      });
    }).catch(() => {
      return caches.match('/');
    })
  );
});
