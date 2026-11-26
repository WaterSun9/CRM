// Offline page only. This worker caches nothing but offline.html and its logo,
// and answers only when a page load fails because there is no connection.
// It never caches index.html or version.json, so UpdateChecker and instant
// updates keep working.
const CACHE = 'watersun-offline-v1';
const OFFLINE_FILES = ['offline.html', 'Watersun%20Blue%20Logo%20PNG.png'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(OFFLINE_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

// Opening the CRM always asks the server for the page (2026-11-27). GitHub Pages lets a phone keep
// the start page for 10 minutes; opening from the home-screen icon in that time ran the old version
// after a deploy (Mahvish: the refresh bar came and went in a second, still the old version).
// "no-store" skips that saved copy. With no internet: the offline page, as before.
self.addEventListener('fetch', event => {
    if (event.request.mode !== 'navigate') return;
    event.respondWith(fetch(new Request(event.request, { cache: 'no-store' })).catch(() => caches.match('offline.html')));
});
