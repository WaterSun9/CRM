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

self.addEventListener('fetch', event => {
    if (event.request.mode !== 'navigate') return;
    event.respondWith(fetch(event.request).catch(() => caches.match('offline.html')));
});
