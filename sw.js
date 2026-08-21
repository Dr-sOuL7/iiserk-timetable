/**
 * Service worker: makes the app fully usable with no network.
 *
 * Strategy
 *   - Precache the whole app shell on install (it is small and fully static).
 *   - Navigations: network-first with a cache fallback, so a deployed update
 *     is picked up when online but the app still opens when offline.
 *   - Everything else: cache-first, since every asset is versioned by CACHE.
 *
 * Bump CACHE whenever any precached file changes.
 */
'use strict';

var CACHE = 'iiserk-timetable-v1';

var ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'data/timetable.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) {
        // cache.addAll() rejects the whole batch if one entry 404s; add each
        // asset individually so a single missing icon cannot break install.
        return Promise.all(ASSETS.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function (err) {
            console.warn('[sw] could not precache', url, err);
          });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // never touch cross-origin

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(CACHE).then(function (c) { c.put(request, copy); });
          return response;
        })
        .catch(function () {
          // caches.match() resolves to undefined on a miss, so chain the
          // fallbacks rather than using `||` on the promises themselves.
          return caches.match(request)
            .then(function (hit) { return hit || caches.match('index.html'); })
            .then(function (hit) { return hit || caches.match('./'); });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE).then(function (c) { c.put(request, copy); });
        }
        return response;
      });
    })
  );
});
