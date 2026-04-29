const CACHE_NAME = 'mentrily-pwa-v1';
const STATIC_ASSETS = ['/', '/manifest.json', '/logo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const shouldCacheRoute =
    url.pathname.startsWith('/dashboard/learner') ||
    url.pathname.startsWith('/exam') ||
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons') ||
    url.pathname === '/manifest.json';

  if (!shouldCacheRoute) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
