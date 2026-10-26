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

var CACHE = 'iiserk-timetable-v22';

var ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'data/timetable.js',
  'data/holidays.js',
  'data/midsem.js',
  'data/reminders-config.js',
  'reminders.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/upi-qr.svg'
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

// ------------------------------------------------------------------ reminders
//
// Class reminders arrive as Web Push messages, so they can show while the app is
// closed. Each message was encrypted on the device itself (see reminders.js) and
// carries only what to display; the wording is built HERE, at display time, so
// the "starts in N min" text is right even if the push service delivered late.
//
//   { v: 1, k: <dedupe key>, s: <class start, unix s>,
//     i: [{ c: code, t: type, r: room, n: course name }, ...] }
//   { v: 1, test: 1, ... }   the Settings "send a test" message

var NOTIFY_ICON = 'icons/icon-192.png';

function clockLabel(ms) {
  var d = new Date(ms);
  return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
}

function reminderContent(data, nowMs) {
  var base = { icon: NOTIFY_ICON, renotify: false };
  var generic = {
    title: 'Class reminder',
    options: Object.assign({ body: 'Open the timetable to see your next class.', tag: 'reminder-generic' }, base)
  };
  if (!data || typeof data !== 'object' || data.v !== 1) return generic;

  if (data.test) {
    return {
      title: 'Reminders are on',
      options: Object.assign({ body: 'This is a test. Class reminders will arrive like this, even when the app is closed.', tag: 'reminder-test' }, base)
    };
  }

  var items = Array.isArray(data.i) ? data.i : [];
  if (!items.length || typeof data.s !== 'number') return generic;

  var startMs = data.s * 1000;
  var mins = Math.round((startMs - nowMs) / 60000);
  var when = mins >= 1 ? 'in ' + mins + ' min' : 'now';
  var clock = clockLabel(startMs);
  var title, body;

  if (items.length === 1) {
    var c = items[0];
    title = String(c.c || 'Class') + ' ' + String(c.t || '') + (mins >= 1 ? ' starts ' + when : ' is starting now');
    title = title.replace(/\s+/g, ' ').trim();
    body = [c.n ? String(c.n) : '', [clock, c.r ? String(c.r) : ''].filter(Boolean).join(' · ')]
      .filter(Boolean).join('\n');
  } else {
    title = items.length + (mins >= 1 ? ' classes start ' + when : ' classes are starting now');
    body = ['Starts at ' + clock].concat(items.map(function (c) {
      return [String(c.c || '') + ' ' + String(c.t || ''), c.r ? String(c.r) : ''].map(function (x) { return x.trim(); })
        .filter(Boolean).join(' · ');
    })).join('\n');
  }

  return {
    title: title,
    options: Object.assign({
      body: body,
      // Same tag = same notification: a duplicate delivery replaces, never stacks.
      tag: typeof data.k === 'string' && data.k ? data.k : 'reminder',
      timestamp: startMs,
      data: { url: self.registration.scope }
    }, base)
  };
}

self.addEventListener('push', function (event) {
  var data = null;
  try { data = event.data ? event.data.json() : null; } catch (e) { data = null; }
  var content = reminderContent(data, Date.now());
  // A push must always end in a visible notification (userVisibleOnly), so even an
  // unreadable message shows the generic one rather than nothing.
  event.waitUntil(self.registration.showNotification(content.title, content.options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url && list[i].url.indexOf(target) === 0 && 'focus' in list[i]) return list[i].focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
