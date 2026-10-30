/* sw.js — offline support for the installed app.
   Everything the app needs is local (Chart.js is vendored), so one precache covers it.
   Bump CACHE whenever the files change: the old cache is deleted on activate. */
const CACHE = 'food-group-log-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './vendor/chart.umd.js',
  './js/core.js',
  './js/icons.js',
  './js/items.js',
  './js/dates.js',
  './js/store.js',
  './js/components/modal.js',
  './js/components/day-editor.js',
  './js/components/day-modal.js',
  './js/views/today.js',
  './js/views/calendar.js',
  './js/views/analytics.js',
  './js/views/settings.js',
  './js/app.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  /* navigations: serve the cached shell when the network is away */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   /* let fonts go straight to the network */

  /* stale-while-revalidate: instant from cache, refreshed in the background,
     so a new deploy is picked up on the next launch instead of sticking forever */
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request, { ignoreSearch: true }).then((hit) => {
        const network = fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => hit);
        return hit || network;
      })
    )
  );
});
