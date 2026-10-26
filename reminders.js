/**
 * IISER-K Timetable - class reminders (client side).
 *
 * Genuine background reminders need a Web Push service, and GitHub Pages is
 * static hosting, so the work is split:
 *
 *   this file + sw.js  (GitHub Pages)   decide WHAT to remind about and WHEN,
 *                                        encrypt every reminder for this device,
 *                                        show the notification when a push arrives.
 *   worker/            (Cloudflare)      stores opaque, already-encrypted
 *                                        reminders and relays each one to the
 *                                        browser's push service at its fire time.
 *
 * The device does the encryption (RFC 8291, aes128gcm) because Workers Free has
 * a 10 ms CPU cap per cron run - roughly six encrypted pushes - whereas relaying
 * a ready-made body is nearly free. As a bonus the backend never sees a course
 * code, room or time, only fire times.
 *
 * Everything here is plain ES2017, no dependencies, and has no direct access to
 * the DOM or the app's closures: app.js injects the timetable logic (deps) and
 * the platform (env), so the same code runs under Node for the unit tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IISERReminders = factory();
})(typeof globalThis !== 'undefined' ? globalThis : self, function () {
  'use strict';

  // ------------------------------------------------------------- constants

  var KEY_PREFS = 'iiserk.tt.reminders.v1';
  var KEY_PUSH = 'iiserk.tt.push.v1';

  var DEFAULT_LEAD = 5;                  // minutes before class
  var MIN_LEAD = 1;
  var MAX_LEAD = 180;
  var LEAD_PRESETS = [5, 10, 15, 30];

  var HORIZON_DAYS = 21;                 // how far ahead reminders are scheduled
  var MAX_ITEMS = 300;                   // per device; the Worker enforces the same cap
  var LATE_GRACE_MS = 90 * 1000;         // a reminder this overdue is still worth sending
  var SYNC_MAX_AGE_MS = 12 * 3600 * 1000;
  var MAX_CLASSES_PER_NOTIFICATION = 6;

  // ------------------------------------------------------------------ utils

  function isLead(n) {
    return typeof n === 'number' && Number.isInteger(n) && n >= MIN_LEAD && n <= MAX_LEAD;
  }

  /** 53-bit non-cryptographic string hash (cyrb53) - stable keys, change detection. */
  function hash53(str, seed) {
    var h1 = 0xdeadbeef ^ (seed || 0), h2 = 0x41c6ce57 ^ (seed || 0);
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  function b64uEncode(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64uDecode(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function concat() {
    var n = 0, i;
    for (i = 0; i < arguments.length; i++) n += arguments[i].length;
    var out = new Uint8Array(n), p = 0;
    for (i = 0; i < arguments.length; i++) { out.set(arguments[i], p); p += arguments[i].length; }
    return out;
  }

  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function subtle() {
    var c = (typeof globalThis !== 'undefined' ? globalThis : self).crypto;
    if (!c || !c.subtle) throw new Error('Web Crypto is unavailable');
    return c.subtle;
  }

  function utf8(s) { return new TextEncoder().encode(s); }

  async function sha256Hex(str) {
    var d = new Uint8Array(await subtle().digest('SHA-256', utf8(str)));
    var out = '';
    for (var i = 0; i < d.length; i++) out += (d[i] < 16 ? '0' : '') + d[i].toString(16);
    return out;
  }

  // ------------------------------------------------------------ preferences
  //
  // Shape: { version: 1, enabled: true, lead: 5, perClass: { <eventId>: {off:true} | {lead:n} } }
  //
  // A class with no perClass entry INHERITS the global default - changing the
  // default therefore never touches a class that has its own setting, and a
  // class added or restored later behaves exactly like every other one.

  function defaultPrefs() {
    return { version: 1, enabled: true, lead: DEFAULT_LEAD, perClass: {} };
  }

  function sanitizePrefs(raw) {
    var out = defaultPrefs();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    if (raw.enabled === false) out.enabled = false;
    if (isLead(raw.lead)) out.lead = raw.lead;
    var pc = raw.perClass;
    if (pc && typeof pc === 'object' && !Array.isArray(pc)) {
      Object.keys(pc).forEach(function (id) {
        var v = pc[id];
        if (!id || !v || typeof v !== 'object' || Array.isArray(v)) return;
        if (v.off === true) out.perClass[id] = { off: true };
        else if (isLead(v.lead)) out.perClass[id] = { lead: v.lead };
      });
    }
    return out;
  }

  /** What one class is set to, ignoring the global on/off: {mode, lead|null}. */
  function classSetting(prefs, id) {
    var pc = prefs.perClass[id];
    if (pc && pc.off) return { mode: 'off', lead: null };
    if (pc && isLead(pc.lead)) return { mode: 'custom', lead: pc.lead };
    return { mode: 'default', lead: prefs.lead };
  }

  /** Minutes before class a reminder fires, or null for "no reminder at all". */
  function resolveLead(prefs, id) {
    if (!prefs.enabled) return null;
    return classSetting(prefs, id).lead;
  }

  // -------------------------------------------------------------- schedule
  //
  // deps (supplied by app.js, so every rule the Today tab applies is applied here
  // too instead of being re-implemented):
  //   teachingDay(date)            'Monday'..'Friday' or null on weekends
  //   eventsFor(dayName)           the SELECTED courses' effective (edited, minus
  //                                removed) classes that day, in time order
  //   isOffDay(date)               holiday, or academic break for this selection
  //   midsemIntervalsOn(dateKey)   [{start,end}] minutes of the user's Mid-Sem exams
  //   overlaps(event, intervals)   true if the class collides with an exam
  //   localDateKey(date)           'YYYY-MM-DD' from LOCAL calendar fields

  function buildSchedule(deps, prefs, now, opts) {
    opts = opts || {};
    var horizon = opts.horizonDays || HORIZON_DAYS;
    if (!prefs.enabled) return [];
    var nowMs = now.getTime();
    var raw = [];

    for (var offset = 0; offset < horizon; offset++) {
      var day = new Date(nowMs);
      day.setDate(day.getDate() + offset);
      var dayName = deps.teachingDay(day);
      if (!dayName || deps.isOffDay(day)) continue;
      var intervals = deps.midsemIntervalsOn(deps.localDateKey(day));

      deps.eventsFor(dayName).forEach(function (e) {
        if (intervals.length && deps.overlaps(e, intervals)) return;
        var lead = resolveLead(prefs, e.id);
        if (lead === null) return;
        // setHours on a local Date: a DST jump inside the horizon is resolved by
        // the platform's own tz database, never by adding 24h blocks.
        var start = new Date(day.getTime());
        start.setHours(Math.floor(e.minutes / 60), e.minutes % 60, 0, 0);
        var startMs = start.getTime();
        var fireMs = startMs - lead * 60000;
        if (startMs <= nowMs) return;                   // already started
        if (fireMs < nowMs - LATE_GRACE_MS) return;     // its moment has passed
        raw.push({ e: e, startMs: startMs, fireMs: fireMs });
      });
    }

    // One notification per (start, fire) moment. Parallel sections of the same
    // course and type (e.g. a tutorial offered in two rooms) are one entry whose
    // rooms are joined, rather than two near-identical alerts.
    var groups = {};
    raw.forEach(function (r) {
      var g = groups[r.startMs + '|' + r.fireMs] ||
        (groups[r.startMs + '|' + r.fireMs] = { startMs: r.startMs, fireMs: r.fireMs, events: [] });
      g.events.push(r.e);
    });

    var items = Object.keys(groups).map(function (gk) {
      var g = groups[gk];
      var byClass = {}, order = [];
      g.events.forEach(function (e) {
        var ck = e.course + '|' + e.type;
        if (!byClass[ck]) {
          byClass[ck] = { c: e.course, t: e.type, n: e.name || '', rooms: [] };
          order.push(ck);
        }
        if (e.room && byClass[ck].rooms.indexOf(e.room) < 0) byClass[ck].rooms.push(e.room);
      });
      var classes = order.slice(0, MAX_CLASSES_PER_NOTIFICATION).map(function (ck) {
        var c = byClass[ck];
        return { c: c.c, t: c.t, r: c.rooms.join(' / ').slice(0, 80), n: c.n.slice(0, 60) };
      });
      var ids = g.events.map(function (e) { return e.id; }).sort();
      var startMin = Math.floor(g.startMs / 60000);
      var key = startMin + '.' + hash53(ids.join('|')).toString(36);
      return {
        key: key,
        startMs: g.startMs,
        fireMs: g.fireMs,
        payload: { v: 1, k: key, s: Math.floor(g.startMs / 1000), i: classes }
      };
    });

    items.sort(function (a, b) { return a.fireMs - b.fireMs || (a.key < b.key ? -1 : 1); });
    return items.slice(0, MAX_ITEMS);
  }

  // ------------------------------------------------------------ encryption
  //
  // RFC 8291 (Web Push message encryption) with the aes128gcm coding of
  // RFC 8188, as a single record. Only the browser's PUBLIC key and auth secret
  // are needed - both are available to the page via PushSubscription.toJSON() -
  // so the page can play the "application server" role for its own device.

  async function hkdf(salt, ikm, info, length) {
    var k = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    var bits = await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: info }, k, length * 8);
    return new Uint8Array(bits);
  }

  /**
   * @param plaintext   Uint8Array
   * @param uaPublic    Uint8Array(65)  subscription p256dh
   * @param authSecret  Uint8Array(16)  subscription auth
   * @param test        optional {salt, ephemeralJwk} to reproduce the RFC's fixed vector
   * @returns Uint8Array  the complete aes128gcm body (header + ciphertext)
   */
  async function encryptPayload(plaintext, uaPublic, authSecret, test) {
    var s = subtle();
    var ecdh = { name: 'ECDH', namedCurve: 'P-256' };
    var uaKey = await s.importKey('raw', uaPublic, ecdh, false, []);

    var asPrivate, asPublic;
    if (test && test.ephemeralJwk) {
      asPrivate = await s.importKey('jwk', test.ephemeralJwk, ecdh, false, ['deriveBits']);
      asPublic = concat(new Uint8Array([4]), b64uDecode(test.ephemeralJwk.x), b64uDecode(test.ephemeralJwk.y));
    } else {
      var pair = await s.generateKey(ecdh, true, ['deriveBits']);
      asPrivate = pair.privateKey;
      asPublic = new Uint8Array(await s.exportKey('raw', pair.publicKey));
    }

    var secret = new Uint8Array(await s.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256));
    var ikm = await hkdf(authSecret, secret, concat(utf8('WebPush: info\0'), uaPublic, asPublic), 32);
    var salt = (test && test.salt) || globalThis.crypto.getRandomValues(new Uint8Array(16));
    var cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
    var nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);

    var aes = await s.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    // 0x02 marks the final (here: only) record.
    var cipher = new Uint8Array(await s.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))));

    var header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic);
    return concat(header, cipher);
  }

  // -------------------------------------------------------------- controller

  function defaultEnv(g) {
    return {
      now: function () { return new Date(); },
      fetch: function (u, o) { return g.fetch(u, o); },
      notification: g.Notification,
      serviceWorker: g.navigator && g.navigator.serviceWorker,
      hasPush: function () {
        return !!(g.navigator && 'serviceWorker' in g.navigator && g.PushManager && g.Notification);
      },
      iosInstallNeeded: function () { return false; },
      online: function () { return g.navigator ? g.navigator.onLine !== false : true; },
      tz: function () {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
      },
      setTimeout: function (fn, ms) { return g.setTimeout(fn, ms); },
      clearTimeout: function (t) { g.clearTimeout(t); }
    };
  }

  /**
   * opts: { store:{get,set,remove}, config:{apiBase}, deps, env?, onChange? }
   * The VAPID public key is NOT configured by hand: the service returns it, and
   * the page refuses a subscription whose key it cannot confirm with the service.
   */
  function createController(opts) {
    var g = typeof globalThis !== 'undefined' ? globalThis : self;
    var store = opts.store;
    var config = opts.config || {};
    var deps = opts.deps;
    var env = Object.assign(defaultEnv(g), opts.env || {});
    var onChange = opts.onChange || function () {};

    var prefs = loadPrefs();
    var st = loadPush();
    var lastError = null;
    var busy = false;
    var syncTimer = null, retryTimer = null, retryCount = 0;
    var running = null, rerun = false;

    // -- persistence

    function loadPrefs() {
      var raw = store.get(KEY_PREFS), parsed = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
      return sanitizePrefs(parsed);
    }

    function savePrefs() {
      // Defaults are never written, so a user who never touches reminders has no
      // stored key at all and always follows whatever the current default is.
      var untouched = prefs.enabled === true && prefs.lead === DEFAULT_LEAD &&
        !Object.keys(prefs.perClass).length;
      if (untouched) return store.remove(KEY_PREFS);
      return store.set(KEY_PREFS, JSON.stringify(prefs));
    }

    function emptyPush() {
      return { id: null, token: null, endpoint: null, keyFp: null, vapid: null, lastHash: null, lastSyncAt: 0, dirty: false };
    }

    function loadPush() {
      var out = emptyPush(), raw = store.get(KEY_PUSH), p = null;
      try { p = raw ? JSON.parse(raw) : null; } catch (e) { p = null; }
      if (p && typeof p === 'object') {
        ['id', 'token', 'endpoint', 'keyFp', 'vapid', 'lastHash'].forEach(function (k) {
          if (typeof p[k] === 'string') out[k] = p[k];
        });
        if (typeof p.lastSyncAt === 'number') out.lastSyncAt = p.lastSyncAt;
        out.dirty = p.dirty === true;
      }
      return out;
    }

    function savePush() { return store.set(KEY_PUSH, JSON.stringify(st)); }
    function clearRegistration() {
      var dirty = st.dirty, vapid = st.vapid;
      st = emptyPush();
      st.dirty = dirty;
      st.vapid = vapid;
      savePush();
    }

    function emit() { try { onChange(); } catch (e) { /* UI errors must not break syncing */ } }

    // -- environment

    function isConfigured() {
      return typeof config.apiBase === 'string' &&
        /^https:\/\/[^/\s]+|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(config.apiBase);
    }
    function url(path) { return config.apiBase.replace(/\/+$/, '') + path; }
    function permission() { return env.notification ? env.notification.permission : 'denied'; }

    function describe(err) {
      if (!err) return 'Unknown error';
      if (err.network) return 'Could not reach the reminder service';
      return String(err.message || err);
    }

    // -- status (what the Settings sheet shows)

    function status() {
      if (!prefs.enabled) return { code: 'off' };
      if (!isConfigured()) return { code: 'unconfigured' };
      if (!env.hasPush()) return { code: env.iosInstallNeeded() ? 'ios-install' : 'unsupported' };
      var perm = permission();
      if (perm === 'denied') return { code: 'denied' };
      if (perm !== 'granted') return { code: 'needs-permission' };
      if (busy && !st.id) return { code: 'working' };
      if (lastError) return { code: 'error', message: lastError, pending: st.dirty };
      if (!st.id) return { code: 'working' };
      return { code: 'active', pending: st.dirty };
    }

    // -- network

    async function api(method, path, body, token) {
      var headers = { 'Accept': 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers['Authorization'] = 'Bearer ' + token;
      var res;
      try {
        res = await env.fetch(url(path), {
          method: method, headers: headers, mode: 'cors', credentials: 'omit', cache: 'no-store',
          body: body === undefined ? undefined : JSON.stringify(body)
        });
      } catch (e) {
        var ne = new Error('network'); ne.network = true; throw ne;
      }
      var json = null;
      try { json = await res.json(); } catch (e) { json = null; }
      return { status: res.status, json: json };
    }

    function failure(res, what) {
      var e = new Error(what + ' failed (' + res.status + ')');
      e.status = res.status;
      return e;
    }

    // -- push subscription

    async function getRegistration() {
      var sw = env.serviceWorker;
      if (!sw) throw new Error('Service worker unavailable');
      var timer;
      var timeout = new Promise(function (_, reject) {
        timer = env.setTimeout(function () { reject(new Error('Service worker is not ready')); }, 8000);
      });
      try { return await Promise.race([sw.ready, timeout]); }
      finally { env.clearTimeout(timer); }
    }

    async function ensureSubscription(reg, vapidKey) {
      var key = b64uDecode(vapidKey);
      var sub = await reg.pushManager.getSubscription();
      if (sub && sub.options && sub.options.applicationServerKey) {
        if (!sameBytes(new Uint8Array(sub.options.applicationServerKey), key)) {
          await sub.unsubscribe();           // created for a different service
          sub = null;
        }
      }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      return sub;
    }

    /** The service's VAPID public key (fetched once, then cached with the registration). */
    async function ensureVapid(refresh) {
      if (st.vapid && !refresh) return st.vapid;
      var cfg = await api('GET', '/v1/config');
      if (cfg.status !== 200 || !cfg.json || typeof cfg.json.vapidPublicKey !== 'string' || !cfg.json.vapidPublicKey) {
        throw failure(cfg, 'Configuration');
      }
      st.vapid = cfg.json.vapidPublicKey;
      savePush();
      return st.vapid;
    }

    /** Make sure this device is registered with the service. */
    async function ensureRegistered(sub) {
      var json = sub.toJSON();
      var keys = json.keys || {};
      if (!json.endpoint || !keys.p256dh || !keys.auth) throw new Error('Incomplete push subscription');
      var fp = hash53(json.endpoint + '|' + keys.p256dh + '|' + keys.auth).toString(36);
      if (st.id && st.token && st.endpoint === json.endpoint && st.keyFp === fp) return;

      var oldId = st.id, oldToken = st.token;
      var proof = await sha256Hex('iiserk-reminders-proof:' + keys.auth);
      var res = await api('POST', '/v1/subscribe', { endpoint: json.endpoint, proof: proof });
      if (res.status !== 200 && res.status !== 201) throw failure(res, 'Registration');
      if (!res.json || !res.json.id || !res.json.token) throw new Error('Unexpected reply from the reminder service');
      var vapid = st.vapid;
      st = { id: res.json.id, token: res.json.token, endpoint: json.endpoint, keyFp: fp, vapid: vapid,
             lastHash: null, lastSyncAt: 0, dirty: true };
      savePush();
      if (typeof res.json.vapid === 'string' && res.json.vapid && res.json.vapid !== vapid) {
        // The subscription was made against a stale key: remember the service's real one and redo it.
        st.vapid = res.json.vapid; savePush();
        try { await sub.unsubscribe(); } catch (e) { /* recreated below */ }
        var re = new Error('The reminder service key changed'); re.resubscribe = true; throw re;
      }
      if (oldId && oldToken && oldId !== st.id) {
        // Best effort: the old endpoint would be pruned on its first 404/410 anyway.
        api('DELETE', '/v1/subscriptions/' + encodeURIComponent(oldId), undefined, oldToken).catch(function () {});
      }
    }

    // -- scheduling + sync

    function scheduleItems() { return buildSchedule(deps, prefs, env.now()); }

    async function syncOnce(force) {
      var reg = await getRegistration();
      var sub = await reg.pushManager.getSubscription();
      if (!sub) throw new Error('Push subscription missing');
      var json = sub.toJSON(), keys = json.keys;

      var now = env.now();
      var items = scheduleItems();
      var tz = env.tz();
      var digest = hash53(JSON.stringify(items.map(function (i) { return [i.key, i.fireMs, i.payload]; })) + '|' + tz).toString(36);

      var age = now.getTime() - st.lastSyncAt;
      if (!force && !st.dirty && st.lastHash !== null && age < SYNC_MAX_AGE_MS) return 'fresh';
      if (!force && st.dirty && st.lastHash === digest && age < SYNC_MAX_AGE_MS) {
        st.dirty = false; savePush();                 // a change that did not alter any reminder
        return 'unchanged';
      }

      var ua = b64uDecode(keys.p256dh), auth = b64uDecode(keys.auth);
      var wire = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var plain = JSON.stringify(it.payload);
        var body = await encryptPayload(utf8(plain), ua, auth);
        wire.push({
          k: it.key,
          f: Math.floor(it.fireMs / 1000),
          s: Math.floor(it.startMs / 1000),
          t: 'r' + hash53(it.key).toString(36),
          h: hash53(plain).toString(36),
          b: b64uEncode(body)
        });
      }

      var res = await api('PUT', '/v1/subscriptions/' + encodeURIComponent(st.id) + '/schedule',
        { items: wire, tz: tz }, st.token);

      if (res.status === 401 || res.status === 403 || res.status === 404) {
        clearRegistration();                          // the service no longer knows this device
        var e = new Error('registration lost'); e.reregister = true; throw e;
      }
      if (res.status !== 200) throw failure(res, 'Sync');

      st.lastHash = digest;
      st.lastSyncAt = now.getTime();
      st.dirty = false;
      savePush();
      return 'synced';
    }

    function scheduleRetry() {
      if (retryTimer) env.clearTimeout(retryTimer);
      var delay = Math.min(5 * 60000, 15000 * Math.pow(2, retryCount));
      retryCount++;
      retryTimer = env.setTimeout(function () { retryTimer = null; return reconcile(); }, delay);
    }

    /**
     * Bring this device into the desired state: subscribed, registered and in
     * sync. Never prompts for permission - that is enable()'s job, on a tap.
     */
    function reconcile(o) {
      if (running) { rerun = true; return running; }
      running = (async function () {
        do {
          rerun = false;
          if (!prefs.enabled || !isConfigured() || !env.hasPush() || permission() !== 'granted') break;
          busy = true; emit();
          try {
            var reg = await getRegistration();
            for (var attempt = 0; attempt < 3; attempt++) {
              try {
                var vapid = await ensureVapid(false);
                var sub = await ensureSubscription(reg, vapid);
                await ensureRegistered(sub);
                await syncOnce(!!(o && o.force));
                lastError = null; retryCount = 0;
                break;
              } catch (err) {
                if ((err.reregister || err.resubscribe) && attempt < 2) continue;
                throw err;
              }
            }
          } catch (err) {
            lastError = describe(err);
            if (!(err && err.network) || env.online()) scheduleRetry(); else retryCount = 0;
          } finally {
            busy = false; emit();
          }
        } while (rerun);
      })().finally(function () { running = null; });
      return running;
    }

    // -- user actions

    function setEnabledFlag(on) {
      prefs.enabled = !!on;
      savePrefs();
    }

    function requestPermission() {
      return new Promise(function (resolve) {
        try {
          var r = env.notification.requestPermission(resolve);   // old callback form
          if (r && typeof r.then === 'function') r.then(resolve, function () { resolve('denied'); });
        } catch (e) { resolve('denied'); }
      });
    }

    /** The explicit "turn reminders on" action - the only place permission is requested. */
    async function enable() {
      setEnabledFlag(true);
      lastError = null;
      emit();
      if (!isConfigured() || !env.hasPush()) return status();
      var perm = permission();
      if (perm === 'default') {
        perm = await requestPermission();   // first await: stays inside the tap's user gesture
        emit();
      }
      if (perm === 'granted') await reconcile();
      return status();
    }

    async function disable() {
      var id = st.id, token = st.token;
      setEnabledFlag(false);
      if (syncTimer) { env.clearTimeout(syncTimer); syncTimer = null; }
      if (retryTimer) { env.clearTimeout(retryTimer); retryTimer = null; }
      lastError = null;
      var vapidKept = st.vapid;
      st = emptyPush(); st.vapid = vapidKept; savePush();
      emit();
      // Unsubscribe locally first so no push can arrive even if the service is unreachable;
      // the service also prunes the endpoint itself on the next 404/410.
      try {
        if (env.hasPush() && env.serviceWorker) {
          var reg = await getRegistration();
          var sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
        }
      } catch (e) { /* nothing to unsubscribe */ }
      if (id && token && isConfigured()) {
        try { await api('DELETE', '/v1/subscriptions/' + encodeURIComponent(id), undefined, token); } catch (e) { /* retried by pruning */ }
      }
      emit();
    }

    function setDefaultLead(n) {
      if (!isLead(n)) return false;
      if (prefs.lead === n) return true;
      prefs.lead = n;                       // per-class entries are untouched
      savePrefs();
      markChanged();
      emit();
      return true;
    }

    /** setting: 'default' | 'off' | minutes. Returns false for an invalid value. */
    function setClassSetting(id, setting) {
      if (!id) return false;
      var before = JSON.stringify(prefs.perClass[id] || null);
      if (setting === 'default' || setting === null || setting === undefined) delete prefs.perClass[id];
      else if (setting === 'off') prefs.perClass[id] = { off: true };
      else if (isLead(setting)) prefs.perClass[id] = { lead: setting };
      else return false;
      if (JSON.stringify(prefs.perClass[id] || null) === before) return true;   // nothing changed
      savePrefs();
      markChanged();
      emit();
      return true;
    }

    /** Drop settings for classes that no longer exist in the published timetable. */
    function pruneClasses(validIds) {
      var changed = false;
      Object.keys(prefs.perClass).forEach(function (id) {
        if (!validIds[id]) { delete prefs.perClass[id]; changed = true; }
      });
      if (changed) savePrefs();
      return changed;
    }

    /** Something the schedule depends on changed (courses, edits, exams, settings). */
    function markChanged() {
      if (!st.id) return;                   // not registered yet: enable() will sync from scratch
      st.dirty = true; savePush();
      scheduleSync(1500);
    }

    /** Prefetch the service's public key so a later tap can subscribe without waiting on the network. */
    function warm() {
      if (!prefs.enabled || !isConfigured() || st.vapid || !env.online()) return Promise.resolve();
      return ensureVapid(false).catch(function () {});
    }

    function setEnabled(on) {
      if (on) return enable();
      return disable();
    }

    function scheduleSync(delay) {
      if (!prefs.enabled || !isConfigured()) return;
      if (syncTimer) env.clearTimeout(syncTimer);
      syncTimer = env.setTimeout(function () { syncTimer = null; return reconcile(); }, delay);
    }

    async function sendTest() {
      if (!st.id) return { ok: false, reason: 'not-registered' };
      var reg = await getRegistration();
      var sub = await reg.pushManager.getSubscription();
      if (!sub) return { ok: false, reason: 'no-subscription' };
      var keys = sub.toJSON().keys;
      var payload = { v: 1, k: 'test', test: 1, s: Math.floor(env.now().getTime() / 1000) + 300, i: [] };
      var body = await encryptPayload(utf8(JSON.stringify(payload)), b64uDecode(keys.p256dh), b64uDecode(keys.auth));
      var res = await api('POST', '/v1/subscriptions/' + encodeURIComponent(st.id) + '/test',
        { b: b64uEncode(body), t: 'rtest' }, st.token);
      if (res.status === 200) return { ok: true };
      if (res.status === 429) return { ok: false, reason: 'rate-limited' };
      if (res.status === 410) { clearRegistration(); return { ok: false, reason: 'gone' }; }
      return { ok: false, reason: 'error', status: res.status };
    }

    return {
      getPrefs: function () { return JSON.parse(JSON.stringify(prefs)); },
      getClassSetting: function (id) { return classSetting(prefs, id); },
      isEnabled: function () { return prefs.enabled; },
      resolveLead: function (id) { return resolveLead(prefs, id); },
      status: status,
      isConfigured: isConfigured,
      enable: enable,
      disable: disable,
      setEnabled: setEnabled,
      setDefaultLead: setDefaultLead,
      setClassSetting: setClassSetting,
      pruneClasses: pruneClasses,
      markChanged: markChanged,
      reconcile: reconcile,
      warm: warm,
      sendTest: sendTest,
      schedule: scheduleItems,
      pushState: function () { return JSON.parse(JSON.stringify(st)); }
    };
  }

  return {
    KEY_PREFS: KEY_PREFS,
    KEY_PUSH: KEY_PUSH,
    DEFAULT_LEAD: DEFAULT_LEAD,
    MIN_LEAD: MIN_LEAD,
    MAX_LEAD: MAX_LEAD,
    LEAD_PRESETS: LEAD_PRESETS,
    HORIZON_DAYS: HORIZON_DAYS,
    MAX_ITEMS: MAX_ITEMS,
    isLead: isLead,
    defaultPrefs: defaultPrefs,
    sanitizePrefs: sanitizePrefs,
    classSetting: classSetting,
    resolveLead: resolveLead,
    buildSchedule: buildSchedule,
    encryptPayload: encryptPayload,
    createController: createController,
    hash53: hash53,
    b64uEncode: b64uEncode,
    b64uDecode: b64uDecode
  };
});
