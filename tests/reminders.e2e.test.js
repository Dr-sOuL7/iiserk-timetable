#!/usr/bin/env node
/**
 * Browser integration tests for class reminders (development only).
 *
 * The real app runs in headless Chromium and talks to the REAL Worker code
 * (worker/src) over a routed fake origin, backed by SQLite standing in for D1,
 * with a fake push service behind it. Only what headless Chromium cannot do is
 * stubbed: the permission prompt and the browser's own push subscription.
 *
 * Run: node tests/reminders.e2e.test.js
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { decrypt, b64u } = require('./helpers/webpush-ua.js');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml'
};

let passed = 0, failed = 0;
function check(name, ok, detail) {
  (ok ? passed++ : failed++);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`);
}
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  check(name, a === e, a === e ? String(a).slice(0, 100) : `got ${a}, want ${e}`);
};

function startServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

/** Freeze the page clock (same approach as tests/app.test.js). */
const clockScript = (iso) => `(() => {
  const FIXED = new Date(${JSON.stringify(iso)}).getTime();
  const RealDate = Date;
  class MockDate extends RealDate { constructor(...a) { super(...(a.length ? a : [FIXED])); } static now() { return FIXED; } }
  window.Date = MockDate;
})()`;

// ------------------------------------------------------------------ page-side stubs

/** Notification permission + the browser's push subscription, persisted across reloads like the real thing. */
function browserStubs(o) {
  const stub = (cfg) => {
    // permission
    const saved = sessionStorage.getItem('__perm');
    const state = { permission: saved || cfg.permission, requests: Number(sessionStorage.getItem('__permRequests') || 0) };
    window.__notif = state;
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => state.permission });
    Notification.requestPermission = function (cb) {
      state.requests++;
      sessionStorage.setItem('__permRequests', String(state.requests));
      state.permission = cfg.grant ? 'granted' : 'denied';
      sessionStorage.setItem('__perm', state.permission);
      if (cb) cb(state.permission);
      return Promise.resolve(state.permission);
    };

    // reminder service location, immune to the config file assigning it afterwards
    if (cfg.apiBase) {
      Object.defineProperty(window, 'REMINDER_CONFIG', { configurable: true, get: () => ({ apiBase: cfg.apiBase }), set() {} });
    }

    if (cfg.noPush) { delete window.PushManager; return; }

    const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const counters = { subscribed: 0, unsubscribed: 0 };
    window.__push = counters;

    function build(rec) {
      return {
        endpoint: rec.endpoint,
        options: { applicationServerKey: unb64(rec.vapid).buffer },
        toJSON: () => ({ endpoint: rec.endpoint, keys: { p256dh: rec.pub, auth: rec.auth } }),
        unsubscribe: async () => { counters.unsubscribed++; sessionStorage.removeItem('__fakeSub'); return true; }
      };
    }
    window.__push.device = () => JSON.parse(sessionStorage.getItem('__fakeSub'));
    const PM = window.PushManager.prototype;
    PM.getSubscription = async function () {
      const raw = sessionStorage.getItem('__fakeSub');
      return raw ? build(JSON.parse(raw)) : null;
    };
    PM.subscribe = async function (opts) {
      counters.subscribed++;
      const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
      const rec = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/fake-' + Math.random().toString(36).slice(2),
        vapid: b64(opts.applicationServerKey),
        pub: b64(await crypto.subtle.exportKey('raw', pair.publicKey)),
        auth: b64(crypto.getRandomValues(new Uint8Array(16))),
        jwk: await crypto.subtle.exportKey('jwk', pair.privateKey)
      };
      sessionStorage.setItem('__fakeSub', JSON.stringify(rec));
      return build(rec);
    };
  };
  return { fn: stub, arg: o };
}

// ------------------------------------------------------------------ main

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const origin = base;
  // The full ("new headless") Chromium honours notification permission grants, which the service-worker checks need.
  const browser = await chromium.launch({ channel: 'chromium' }).catch(() => chromium.launch());
  const errors = [];

  const { createD1 } = await import('./helpers/d1-shim.mjs');
  const relayMod = await import('../worker/src/index.js');
  const { b64uEncode, b64uDecode } = await import('../worker/src/util.js');

  const vkeys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const vjwk = await crypto.subtle.exportKey('jwk', vkeys.privateKey);
  const VAPID_PUB = b64uEncode(new Uint8Array([4, ...b64uDecode(vjwk.x), ...b64uDecode(vjwk.y)]));

  /** The reminder service for one test: real Worker code, SQLite for D1, a recording push service. */
  function makeRelay(clockIso) {
    const relay = {
      env: { DB: createD1(), VAPID_PUBLIC_KEY: VAPID_PUB, VAPID_PRIVATE_KEY: vjwk.d, VAPID_SUBJECT: 'mailto:ops@example.com', ALLOWED_ORIGINS: origin },
      down: false, requests: [], pushes: [], pushStatus: 201,
      now: () => Math.floor(new Date(clockIso).getTime() / 1000)
    };
    relay.pushFetch = async (url, init) => {
      relay.pushes.push({ url, headers: init.headers, body: init.body });
      return new Response(null, { status: relay.pushStatus });
    };
    relay.handle = async (route) => {
      const req = route.request();
      relay.requests.push({ method: req.method(), path: new URL(req.url()).pathname, down: relay.down });
      if (relay.down) return route.abort('internetdisconnected');
      const headers = await req.allHeaders();
      const r = await relayMod.handleRequest(
        new Request(req.url(), { method: req.method(), headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method()) ? undefined : req.postData() }),
        relay.env, { now: relay.now(), fetchFn: relay.pushFetch });
      return route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: await r.text() });
    };
    relay.rows = () => relay.env.DB.rows('SELECT sub_id, key, fire_at, start_at, state, body FROM reminders ORDER BY start_at, key');
    relay.subs = () => relay.env.DB.rows('SELECT id FROM subscriptions');
    return relay;
  }

  /**
   * One isolated browser context + page, the service wired in, the app opened with courses selected.
   * o: { clock, courses, permission, grant, config (false = not set up), noPush, ios, notifications }
   */
  async function open(o) {
    const clock = o.clock || '2026-10-26T07:00:00';
    const ctx = await browser.newContext({
      viewport: { width: 412, height: 915 }, timezoneId: 'Asia/Kolkata',
      permissions: []
    });
    if (o.notifications) await ctx.grantPermissions(['notifications'], { origin });
    const relay = makeRelay(clock + '+05:30');
    await ctx.route('https://relay.test/**', relay.handle);
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (/googletagmanager\.com/.test(m.location().url) && /^Failed to load resource/.test(m.text())) return;
      if (/relay\.test|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text() + m.location().url) && o.tolerateNetworkErrors) return;
      errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    const stubs = browserStubs({
      permission: o.permission || 'default', grant: o.grant !== false, noPush: !!o.noPush,
      apiBase: o.config === false ? '' : 'https://relay.test'
    });
    await page.addInitScript(stubs.fn, stubs.arg);
    await page.addInitScript(clockScript(clock));
    if (o.ios !== undefined) await page.addInitScript(`Object.defineProperty(navigator, 'standalone', { value: ${JSON.stringify(o.ios)}, configurable: true })`);

    await page.goto(base + '/');
    await page.evaluate(({ codes, extra }) => {
      localStorage.setItem('iiserk.tt.courses.v1', JSON.stringify(codes));
      Object.keys(extra || {}).forEach((k) => localStorage.setItem(k, extra[k]));
    }, { codes: o.courses || ['PH3104'], extra: o.storage });
    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    return { ctx, page, relay };
  }

  const settle = async (page) => {
    await page.evaluate(() => window.__tt.reminders().reconcile());
    await page.evaluate(() => window.__tt.reminders().reconcile());
  };
  const status = (page) => page.evaluate(() => window.__tt.reminders().status());
  const openSettings = async (page) => { if (await page.isVisible('#settings-sheet')) return; await page.click('#open-settings'); await page.waitForSelector('#settings-sheet:not([hidden])'); };
  const closeSettings = async (page) => { await page.click('#close-settings'); await page.waitForSelector('#settings-sheet', { state: 'hidden' }); };
  const statusText = async (page) => (await page.textContent('#remind-status-text')).trim();
  const clockOf = (sec) => new Date(sec * 1000).toLocaleString('sv', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T').slice(0, 16);

  /** Every stored reminder, decrypted with the device's key: [{start, fire, courses:[..], payload}] */
  async function decoded(page, relay) {
    const device = await page.evaluate(() => window.__push.device());
    const out = [];
    for (const r of relay.rows()) {
      const payload = await decrypt(r.body, device);
      out.push({ key: r.key, state: r.state, start: clockOf(r.start_at), fire: clockOf(r.fire_at), leadMin: (r.start_at - r.fire_at) / 60,
        classes: payload.i.map((c) => `${c.c} ${c.t}`), rooms: payload.i.map((c) => c.r), payload });
    }
    return out;
  }
  const classRows = (dec, cls) => dec.filter((d) => d.classes.includes(cls));

  async function enableViaSettings(page) {
    await openSettings(page);
    await page.click('#remind-cta');
    await page.waitForFunction(() => { const s = window.__tt.reminders().status(); return s.code === 'active' && !s.pending; });
  }

  async function openEdit(page, n) {
    await page.locator('#today-list .evt-menu').nth(n).click();
    await page.waitForSelector('#event-sheet:not([hidden])');
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
  }

  // ============================================================ 1. defaults + explicit opt-in
  {
    const { ctx, page, relay } = await open({ permission: 'default' });
    eq('startup with reminders default-on never asks for permission', await page.evaluate(() => window.__notif.requests), 0);
    eq('...and does not touch the network at all', relay.requests.length, 0);
    eq('...nor creates a subscription', await page.evaluate(() => window.__push.subscribed), 0);
    check('no preference is stored for an untouched user (so the default can still evolve)', await page.evaluate(() => localStorage.getItem('iiserk.tt.reminders.v1')) === null);

    await openSettings(page);
    eq('Settings: reminders are On by default', await page.getAttribute('#remind-enabled-seg [data-remind-enabled="on"]', 'aria-pressed'), 'true');
    eq('...the default time is 5 min before', await page.inputValue('#remind-lead'), '5');
    eq('...custom time box is hidden for a preset', await page.isVisible('#remind-lead-custom'), false);
    eq('an undecided permission asks the user to allow it', await statusText(page), 'Allow notifications to get reminders even when the app is closed.');
    eq('...with a single clear action', (await page.textContent('#remind-cta')).trim(), 'Allow notifications');
    await page.waitForFunction(() => window.__tt.reminders().pushState().vapid);
    eq('opening Settings prefetched only the public key', relay.requests.map((r) => r.method + ' ' + r.path), ['GET /v1/config']);
    eq('...and still no permission prompt', await page.evaluate(() => window.__notif.requests), 0);

    await page.click('#remind-cta');
    await page.waitForFunction(() => window.__tt.reminders().status().code === 'active');
    eq('tapping Allow prompts exactly once', await page.evaluate(() => window.__notif.requests), 1);
    eq('...subscribes this browser once', await page.evaluate(() => window.__push.subscribed), 1);
    eq('...and registers one device with the service', relay.subs().length, 1);
    eq('status now reads active', (await statusText(page)).startsWith('Reminders are on. You will be notified 5 min before each class'), true);
    check('test-notification link appears once active', await page.isVisible('#remind-test'));

    const dec = await decoded(page, relay);
    eq('PH3104 over the next 3 weeks: 4 classes/week with Mon 08:00+08:55 -> 12 reminders', dec.length, 12);
    eq('the first reminder is for Monday\'s 08:00 tutorial, 5 minutes before', [dec[0].start, dec[0].fire, dec[0].classes], ['2026-10-26T08:00', '2026-10-26T07:55', ['PH3104 Tutorial']]);
    eq('...carrying the room', dec[0].rooms, ['G08']);
    check('everything the service stores is ciphertext', !JSON.stringify(relay.rows()).includes('PH3104') && !JSON.stringify(relay.rows()).includes('G08'));
    check('every reminder is exactly 5 minutes before its class', dec.every((d) => d.leadMin === 5));
    await ctx.close();
  }

  // ============================================================ 2. denied / unsupported / iOS / unconfigured
  {
    const { ctx, page, relay } = await open({ permission: 'default', grant: false });
    await openSettings(page);
    await page.click('#remind-cta');
    await page.waitForFunction(() => window.__tt.reminders().status().code === 'denied');
    eq('refusing the prompt is explained, not nagged', (await statusText(page)).startsWith('Notifications are blocked for this site.'), true);
    eq('...no action button is offered', await page.isVisible('#remind-cta'), false);
    eq('...nothing was subscribed or sent', [await page.evaluate(() => window.__push.subscribed), relay.subs().length], [0, 0]);
    await page.reload(); await page.waitForSelector('#screen-app:not([hidden])');
    await openSettings(page);
    eq('after a reload the blocked state is still shown and the prompt is not repeated', [(await statusText(page)).startsWith('Notifications are blocked'), await page.evaluate(() => window.__notif.requests)], [true, 1]);
    eq('the On/Off switch still works while blocked', await page.getAttribute('#remind-enabled-seg [data-remind-enabled="on"]', 'aria-pressed'), 'true');
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ noPush: true });
    await openSettings(page);
    eq('a browser without push says so plainly', await statusText(page), 'This browser cannot show notifications while the app is closed.');
    eq('...and offers no dead button', await page.isVisible('#remind-cta'), false);
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ noPush: true, ios: false });
    await openSettings(page);
    eq('iPhone/iPad Safari tab: explains the Home Screen requirement', (await statusText(page)).startsWith('On iPhone and iPad, add this app to your Home Screen first'), true);
    eq('...with a button to the install steps', (await page.textContent('#remind-cta')).trim(), 'Show me how');
    await page.click('#remind-cta');
    await page.waitForSelector('#ios-install-sheet:not([hidden])');
    eq('...which opens the existing install instructions and closes Settings', await page.isVisible('#settings-sheet'), false);
    await ctx.close();
  }
  {
    const { ctx, page, relay } = await open({ config: false });
    await openSettings(page);
    eq('no backend configured: Settings says delivery is not set up', await statusText(page), 'Reminder delivery is not set up for this app yet.');
    await page.click('#remind-enabled-seg [data-remind-enabled="off"]');
    await page.click('#remind-enabled-seg [data-remind-enabled="on"]');
    eq('toggling works and never prompts or calls out', [await page.evaluate(() => window.__notif.requests), relay.requests.length], [0, 0]);
    await ctx.close();
  }

  // ============================================================ 3. global switch + default time
  {
    const { ctx, page, relay } = await open({});
    await enableViaSettings(page);
    const idsBefore = relay.rows().map((r) => r.key);

    await page.click('#remind-enabled-seg [data-remind-enabled="off"]');
    await page.waitForFunction(() => window.__tt.reminders().status().code === 'off');
    eq('turning reminders Off removes the device and all its reminders from the service', [relay.subs().length, relay.rows().length], [0, 0]);
    eq('...and unsubscribes the browser', await page.evaluate(() => window.__push.unsubscribed), 1);
    eq('the default-time row hides while Off', await page.isVisible('#remind-lead-row'), false);
    eq('the choice is stored', JSON.parse(await page.evaluate(() => localStorage.getItem('iiserk.tt.reminders.v1'))).enabled, false);
    await page.reload(); await page.waitForSelector('#screen-app:not([hidden])');
    await settle(page);
    eq('Off survives a reload and stays silent', [(await status(page)).code, relay.subs().length], ['off', 0]);

    await openSettings(page);
    await page.click('#remind-enabled-seg [data-remind-enabled="on"]');
    await page.waitForFunction(() => window.__tt.reminders().status().code === 'active');
    eq('turning On again does not prompt a second time', await page.evaluate(() => window.__notif.requests), 1);
    eq('...and re-creates the same schedule', relay.rows().map((r) => r.key).sort(), idsBefore.sort());
    await ctx.close();
  }
  {
    const { ctx, page, relay } = await open({});
    await enableViaSettings(page);
    const keys = relay.rows().map((r) => r.key).sort();

    await page.selectOption('#remind-lead', '15');
    await settle(page);
    let dec = await decoded(page, relay);
    check('choosing 15 min moves every reminder to 15 minutes before', dec.length === 12 && dec.every((d) => d.leadMin === 15));
    eq('...as updates to the same reminders (no duplicates, nothing orphaned)', relay.rows().map((r) => r.key).sort(), keys);
    eq('the default is stored', JSON.parse(await page.evaluate(() => localStorage.getItem('iiserk.tt.reminders.v1'))).lead, 15);
    eq('the status line reflects it', (await statusText(page)).includes('15 min before each class'), true);

    await page.selectOption('#remind-lead', 'custom');
    eq('"Custom…" reveals a minutes box', await page.isVisible('#remind-lead-custom'), true);
    await page.fill('#remind-lead-custom', '45'); await page.press('#remind-lead-custom', 'Tab');
    await settle(page);
    dec = await decoded(page, relay);
    check('a custom 45-minute default applies', dec.every((d) => d.leadMin === 45));
    eq('...and the box stays visible with its value after a reload', await (async () => { await page.reload(); await page.waitForSelector('#screen-app:not([hidden])'); await openSettings(page); return [await page.inputValue('#remind-lead'), await page.inputValue('#remind-lead-custom')]; })(), ['custom', '45']);

    await page.fill('#remind-lead-custom', '0'); await page.press('#remind-lead-custom', 'Tab');
    eq('an invalid time (0) is refused with a hint and reverts', [(await page.textContent('#toast')).includes('between 1 and 180'), await page.inputValue('#remind-lead-custom')], [true, '45']);
    await page.fill('#remind-lead-custom', '181'); await page.press('#remind-lead-custom', 'Tab');
    eq('...181 too', await page.inputValue('#remind-lead-custom'), '45');
    await page.selectOption('#remind-lead', '5');
    eq('picking a preset hides the box again', await page.isVisible('#remind-lead-custom'), false);
    await ctx.close();
  }

  // ============================================================ 4. per-class settings
  {
    const { ctx, page, relay } = await open({});
    await enableViaSettings(page); await closeSettings(page);
    const classId = 'mon-0855-ph3104-theory-g08';
    await page.waitForSelector('#today-list .event');
    const monTheoryIdx = 1;   // Monday list: 08:00 tutorial, 08:55 theory

    await openEdit(page, monTheoryIdx);
    eq('the reminder field starts on "Default" and names it', [await page.inputValue('#f-remind'), (await page.locator('#f-remind option').first().textContent())], ['default', 'Default · 5 min before']);
    eq('...the hint says it is inherited', (await page.textContent('#f-remind-hint')).trim(), 'Uses your default: 5 min before class.');
    eq('...and is not styled as custom', await page.locator('#f-remind-hint').evaluate((el) => el.classList.contains('is-custom')), false);

    await page.selectOption('#f-remind', 'off');
    eq('choosing Off updates the hint', (await page.textContent('#f-remind-hint')).trim(), 'No reminder for this class.');
    eq('...and marks it custom', await page.locator('#f-remind-hint').evaluate((el) => el.classList.contains('is-custom')), true);
    await page.click('#edit-save');
    eq('saving only a reminder choice says so (the class itself is unchanged)', (await page.textContent('#toast')).trim(), 'Reminder saved');
    eq('...and does NOT mark the class as edited', await page.locator('#today-list .event').nth(monTheoryIdx).locator('.edited-flag').count(), 0);
    eq('the row shows a quiet "No reminder" pill', (await page.locator('#today-list .event').nth(monTheoryIdx).locator('.remind-flag').textContent()).trim(), 'No reminder');
    await settle(page);
    let dec = await decoded(page, relay);
    eq('the service no longer holds any reminder for that class (3 Mondays gone)', [classRows(dec, 'PH3104 Theory').filter((d) => d.start.endsWith('08:55')).length, dec.length], [0, 9]);
    check('other classes are untouched', classRows(dec, 'PH3104 Tutorial').length === 3 && classRows(dec, 'PH3104 Theory').length === 6);
    eq('the timetable itself still lists the class', await page.locator('#today-list .event').count(), 2);

    // custom, via preset
    await openEdit(page, monTheoryIdx);
    eq('reopening shows the saved choice', await page.inputValue('#f-remind'), 'off');
    await page.selectOption('#f-remind', '10');
    eq('a preset reveals no minutes box', await page.isVisible('#f-remind-custom'), false);
    eq('...hint: "Custom: 10 min before class. Your default is 5 min."', (await page.textContent('#f-remind-hint')).trim(), 'Custom: 10 min before class. Your default is 5 min.');
    await page.click('#edit-save');
    eq('row pill reads "10 min reminder"', (await page.locator('#today-list .event').nth(monTheoryIdx).locator('.remind-flag').textContent()).trim(), '10 min reminder');
    await settle(page);
    dec = await decoded(page, relay);
    eq('that class now fires 10 minutes early, the others still 5', [classRows(dec, 'PH3104 Theory').filter((d) => d.start.endsWith('08:55')).map((d) => d.leadMin), dec.filter((d) => !d.start.endsWith('08:55')).every((d) => d.leadMin === 5)], [[10, 10, 10], true]);

    // changing the global default must not override the class
    await openSettings(page);
    await page.selectOption('#remind-lead', '30');
    await closeSettings(page);
    await settle(page);
    dec = await decoded(page, relay);
    eq('after the default becomes 30: the custom class keeps 10', classRows(dec, 'PH3104 Theory').filter((d) => d.start.endsWith('08:55')).map((d) => d.leadMin), [10, 10, 10]);
    check('...while every class that inherits follows the new default', dec.filter((d) => !d.start.endsWith('08:55')).every((d) => d.leadMin === 30));
    await openEdit(page, monTheoryIdx);
    eq('the dialog distinguishes: custom class shows its own time', [await page.inputValue('#f-remind'), (await page.textContent('#f-remind-hint')).trim()], ['10', 'Custom: 10 min before class. Your default is 30 min.']);
    eq('...while the "Default" option now names 30', await page.locator('#f-remind option').first().textContent(), 'Default · 30 min before');

    // custom value validation
    await page.selectOption('#f-remind', 'custom');
    eq('Custom… reveals the minutes box', await page.isVisible('#f-remind-custom'), true);
    await page.fill('#f-remind-custom', '0');
    await page.click('#edit-save');
    eq('an invalid custom time blocks saving with a clear message', [(await page.textContent('#edit-error')).trim(), await page.isVisible('#edit-sheet')], ['Enter a reminder time between 1 and 180 minutes.', true]);
    eq('...flagging the field', await page.getAttribute('#f-remind-custom', 'aria-invalid'), 'true');
    await page.fill('#f-remind-custom', '45');
    await page.click('#edit-save');
    eq('45 min saves as a custom value', (await page.locator('#today-list .event').nth(monTheoryIdx).locator('.remind-flag').textContent()).trim(), '45 min reminder');

    // back to default
    await openEdit(page, monTheoryIdx);
    await page.selectOption('#f-remind', 'default');
    await page.click('#edit-save');
    eq('returning to Default removes the pill', await page.locator('#today-list .event').nth(monTheoryIdx).locator('.remind-flag').count(), 0);
    await settle(page);
    dec = await decoded(page, relay);
    check('...and the class follows the default (30) again', classRows(dec, 'PH3104 Theory').filter((d) => d.start.endsWith('08:55')).every((d) => d.leadMin === 30));
    eq('settings are keyed by class id in the existing storage layer, separate from timetable edits',
      [await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1')), JSON.parse(await page.evaluate(() => localStorage.getItem('iiserk.tt.reminders.v1'))).perClass], [null, {}]);

    // global off hides pills and disables everything, per-class settings are remembered
    await openEdit(page, monTheoryIdx);
    await page.selectOption('#f-remind', '15');
    await page.click('#edit-save');
    await openSettings(page);
    await page.click('#remind-enabled-seg [data-remind-enabled="off"]');
    await page.waitForFunction(() => window.__tt.reminders().status().code === 'off');
    await closeSettings(page);
    eq('with reminders Off, row pills are hidden', await page.locator('.remind-flag').count(), 0);
    await openEdit(page, monTheoryIdx);
    eq('...but the class\'s own setting is remembered', await page.inputValue('#f-remind'), '15');
    check('...and the dialog says reminders are off globally', (await page.textContent('#f-remind-hint')).includes('Reminders are off in Settings.'));
    await page.click('#edit-cancel');
    await ctx.close();
  }

  // ============================================================ 5. schedule accuracy: edits, removals, courses
  {
    const { ctx, page, relay } = await open({});
    await enableViaSettings(page); await closeSettings(page);

    await openEdit(page, 1);
    await page.fill('#f-time', '09:15');
    await page.fill('#f-room', 'New Room');
    await page.click('#edit-save');
    await settle(page);
    let dec = await decoded(page, relay);
    const mons = classRows(dec, 'PH3104 Theory').filter((d) => d.start.startsWith('2026-10-26'));
    eq('editing a class moves its reminder to the new time and room', [mons.map((d) => d.start), mons[0].rooms], [['2026-10-26T09:15'], ['New Room']]);
    check('...with no leftover reminder at the old time', !dec.some((d) => d.start === '2026-10-26T08:55'));
    eq('(the edit is flagged as usual)', await page.locator('#today-list .event .edited-flag').count(), 1);

    await page.locator('#today-list .evt-menu').nth(0).click();
    await page.click('#event-remove');
    await page.click('#confirm-ok');
    await settle(page);
    dec = await decoded(page, relay);
    check('removing a class removes its reminders', !dec.some((d) => d.classes.includes('PH3104 Tutorial')) && dec.length === 9);

    // restore both
    await page.evaluate(() => { document.querySelector('#today-list .evt-menu'); });
    await openSettings(page);
    await page.click('#reset-changes-btn');
    await page.click('#confirm-ok');
    await settle(page);
    dec = await decoded(page, relay);
    eq('"Reset timetable changes" brings the original reminders back', dec.length, 12);
    await ctx.close();
  }
  {
    const { ctx, page, relay } = await open({ courses: ['PH3104'] });
    await enableViaSettings(page);
    await page.click('#change-courses');
    await page.waitForSelector('#screen-setup:not([hidden])');
    await page.click('[data-code="LS2101"]');
    await page.click('#continue-btn');
    await page.waitForSelector('#screen-app:not([hidden])');
    await settle(page);
    let dec = await decoded(page, relay);
    check('selecting another course adds its reminders', classRows(dec, 'LS2101 Theory').length > 0 && classRows(dec, 'LS2101 Tutorial').length > 0);
    await openSettings(page);
    await page.click('#change-courses');
    await page.click('[data-code="PH3104"]');
    await page.click('#continue-btn');
    await settle(page);
    dec = await decoded(page, relay);
    check('deselecting a course removes its reminders', !dec.some((d) => d.classes.some((c) => c.startsWith('PH3104'))) && dec.length > 0);
    await ctx.close();
  }

  // ============================================================ 6. holidays, breaks, Mid-Sem
  {
    const { ctx, page, relay } = await open({ clock: '2026-10-01T07:00:00' });
    await enableViaSettings(page);
    const days = new Set((await decoded(page, relay)).map((d) => d.start.slice(0, 10)));
    eq('Gandhi Jayanti (Fri 2 Oct) has no reminder', days.has('2026-10-02'), false);
    check('ordinary days around it do', days.has('2026-10-05') && days.has('2026-10-09') && days.has('2026-10-06'));
    eq('Autumn Break: no reminders from 17 Oct (Dussehra days included)', ['2026-10-19', '2026-10-20'].some((d) => days.has(d)), false);
    await ctx.close();
  }
  {
    const { ctx, page, relay } = await open({ clock: '2026-10-15T07:00:00' });
    await enableViaSettings(page);
    const days = new Set((await decoded(page, relay)).map((d) => d.start.slice(0, 10)));
    check('right up to the break (Fri 16 Oct) there are reminders', days.has('2026-10-16'));
    eq('nothing inside the break (17-25 Oct)', [...days].filter((d) => d >= '2026-10-17' && d <= '2026-10-25'), []);
    check('they resume the Monday after (26 Oct)', days.has('2026-10-26'));
    await ctx.close();
  }
  {
    const override = JSON.stringify({ version: 1, overrides: { 'midsem-ch2102': { date: '2026-10-26' } } });
    const { ctx, page, relay } = await open({
      courses: ['PH3104', 'PH3102', 'CH4104', 'PH4104', 'CH2102'], storage: { 'iiserk.tt.midsem.v1': override }
    });
    await enableViaSettings(page);
    const dec = await decoded(page, relay);
    const monday = dec.filter((d) => d.start.startsWith('2026-10-26')).map((d) => d.start.slice(11) + ' ' + d.classes[0]);
    eq('a Mid-Sem exam (10:00-11:30) suppresses only the classes it overlaps', monday,
      ['08:00 PH3104 Tutorial', '08:55 PH3104 Theory', '11:40 PH4104 Theory', '16:15 CH2102 Theory']);
    check('the same classes keep their reminders on other Mondays', dec.some((d) => d.start === '2026-11-02T10:45' && d.classes[0] === 'CH4104 Theory'));
    await ctx.close();
  }

  // ============================================================ 7. refresh, reconnect, duplicates, offline
  {
    const { ctx, page, relay } = await open({});
    await enableViaSettings(page);
    const snapshot = relay.rows().map((r) => `${r.sub_id}|${r.key}|${r.fire_at}`);
    const id0 = relay.subs()[0].id;
    for (let n = 0; n < 3; n++) { await page.reload(); await page.waitForSelector('#screen-app:not([hidden])'); await settle(page); }
    eq('three refreshes: still one device, identical reminders (no duplicates)', [relay.subs().map((s) => s.id), relay.rows().map((r) => `${r.sub_id}|${r.key}|${r.fire_at}`)], [[id0], snapshot]);
    eq('...the browser subscription was reused, not recreated', await page.evaluate(() => window.__push.subscribed), 0);
    const puts = relay.requests.filter((r) => r.method === 'PUT').length;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await settle(page);
    eq('a reconnect with nothing new uploads nothing', relay.requests.filter((r) => r.method === 'PUT').length, puts);
    await ctx.close();
  }
  {
    const { ctx, page, relay } = await open({ tolerateNetworkErrors: true });
    await enableViaSettings(page);
    await ctx.setOffline(true);
    relay.down = true;
    await openSettings(page);
    await page.selectOption('#remind-lead', '10');
    await page.evaluate(() => window.__tt.reminders().reconcile());
    eq('offline: the setting still saves locally', JSON.parse(await page.evaluate(() => localStorage.getItem('iiserk.tt.reminders.v1'))).lead, 10);
    eq('...the status reports the problem without losing anything', [(await status(page)).code, (await status(page)).pending], ['error', true]);
    eq('...in words', (await statusText(page)), 'Could not reach the reminder service. Retrying automatically.');
    eq('the service still holds the old schedule', (await decoded(page, relay)).every((d) => d.leadMin === 5), true);
    relay.down = false;
    await ctx.setOffline(false);
    await page.waitForFunction(() => window.__tt.reminders().status().code === 'active' && !window.__tt.reminders().status().pending, null, { timeout: 15000 });
    check('back online the pending change is delivered', (await decoded(page, relay)).every((d) => d.leadMin === 10));
    eq('...as a single upload', relay.requests.filter((r) => r.method === 'PUT' && !r.down).length, 2);

    // the app itself keeps working offline, reminders UI included
    await ctx.setOffline(true); relay.down = true;
    await page.reload(); await page.waitForSelector('#screen-app:not([hidden])');
    await openSettings(page);
    eq('an offline reload opens Settings with the saved choice', [await page.inputValue('#remind-lead'), await page.getAttribute('#remind-enabled-seg [data-remind-enabled="on"]', 'aria-pressed')], ['10', 'true']);
    await ctx.setOffline(false);
    await ctx.close();
  }

  // ============================================================ 8. test notification
  {
    const { ctx, page, relay } = await open({ tolerateNetworkErrors: true });   // the 429 below is expected
    await enableViaSettings(page);
    await page.click('#remind-test');
    await page.waitForSelector('#toast:not([hidden])');
    eq('"Send a test notification" is relayed to the push service', [(await page.textContent('#toast')).trim(), relay.pushes.length], ['Test sent - it should arrive in a few seconds', 1]);
    const device = await page.evaluate(() => window.__push.device());
    const msg = await decrypt(b64u(relay.pushes[0].body), device);
    eq('...as an encrypted test message the device can read', [msg.test, relay.pushes[0].url === device.endpoint], [1, true]);
    await page.evaluate(() => { document.getElementById('toast').setAttribute('hidden', ''); document.getElementById('toast').textContent = ''; });
    await page.click('#remind-test');
    await page.waitForFunction(() => document.getElementById('toast').textContent.trim() !== '');
    eq('a second test within 30 s is politely refused', (await page.textContent('#toast')).trim(), 'Please wait a moment before sending another test');
    await ctx.close();
  }

  // ============================================================ 9. delivery -> notification (service worker)
  {
    const { ctx, page, relay } = await open({ notifications: true, permission: 'granted' });
    await settle(page);                    // permission already granted: the app reconciles itself
    await page.waitForFunction(() => { const s = window.__tt.reminders().status(); return s.code === 'active' && !s.pending; });
    await page.evaluate(() => navigator.serviceWorker.ready);

    const cdp = await ctx.newCDPSession(page);
    let regs = [];
    cdp.on('ServiceWorker.workerRegistrationUpdated', (ev) => { regs = ev.registrations; });
    await cdp.send('ServiceWorker.enable');
    for (let n = 0; n < 50 && !regs.length; n++) await new Promise((r) => setTimeout(r, 100));
    const registrationId = regs[0].registrationId;
    const deliver = (data) => cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId, data: typeof data === 'string' ? data : JSON.stringify(data) });
    const shown = () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag })));
    const waitFor = async (pred) => { for (let n = 0; n < 50; n++) { const s = await shown(); if (pred(s)) return s; await new Promise((r) => setTimeout(r, 100)); } return shown(); };

    // Run the real relay's cron against a stored reminder, "decrypt in the browser", hand it to the service worker.
    const nowS = Math.floor(Date.now() / 1000);
    const device = await page.evaluate(() => window.__push.device());
    const row = relay.rows()[0];
    relay.env.DB.db.prepare('UPDATE reminders SET fire_at = ?, start_at = ?').run(Math.floor(relay.now() / 60) * 60, relay.now() + 300);
    const tick = await relayMod.runTick(relay.env, { now: relay.now(), fetchFn: relay.pushFetch });
    eq('the relay\'s cron sends the first due reminder to this device\'s endpoint', [tick.sent >= 1, relay.pushes[0].url === device.endpoint], [true, true]);
    const plain = await decrypt(b64u(relay.pushes[0].body), device);
    // The stored payload's start is the real class time; point it at "5 minutes from now" in the service worker's real clock.
    plain.s = nowS + 5 * 60 + 20;
    await deliver(plain);
    let list = await waitFor((s) => s.length === 1);
    eq('the notification says what and when', [list.length, list[0].title, list[0].body.includes(plain.i[0].r)], [1, 'PH3104 ' + plain.i[0].t + ' starts in 5 min', true]);
    eq('...tagged with the reminder key so duplicates replace it', list[0].tag, plain.k);

    await deliver(plain);
    await new Promise((r) => setTimeout(r, 400));
    eq('delivering the same reminder again does not stack a second notification', (await shown()).length, 1);

    const late = Object.assign({}, plain, { k: 'late', s: nowS - 30 });
    await deliver(late);
    list = await waitFor((s) => s.length === 2);
    eq('a late delivery reads "is starting now", not a wrong countdown', list.find((n) => n.tag === 'late').title, 'PH3104 ' + plain.i[0].t + ' is starting now');

    await deliver({ v: 1, k: 'multi', s: nowS + 10 * 60 + 20, i: [{ c: 'AA1101', t: 'Theory', r: 'R1' }, { c: 'BB1101', t: 'Lab', r: 'Lab 2' }] });
    list = await waitFor((s) => s.length === 3);
    const multi = list.find((n) => n.tag === 'multi');
    eq('simultaneous classes become one notification', [multi.title, multi.body.includes('AA1101 Theory · R1') && multi.body.includes('BB1101 Lab · Lab 2')], ['2 classes start in 10 min', true]);

    await deliver('this is not json');
    list = await waitFor((s) => s.some((n) => n.tag === 'reminder-generic'));
    eq('an unreadable message still shows something (browsers require it)', list.find((n) => n.tag === 'reminder-generic').title, 'Class reminder');

    await deliver({ v: 1, test: 1 });
    list = await waitFor((s) => s.some((n) => n.tag === 'reminder-test'));
    eq('the test message is recognisable', list.find((n) => n.tag === 'reminder-test').title, 'Reminders are on');
    await ctx.close();
  }

  // ============================================================ 10. nothing broke elsewhere
  check('no uncaught browser errors during any of the above', errors.length === 0, errors.join(' | ').slice(0, 300) || 'clean');

  await browser.close();
  server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
