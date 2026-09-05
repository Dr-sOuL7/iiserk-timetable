#!/usr/bin/env node
/**
 * End-to-end browser tests (development only).
 *
 * Serves the project over plain HTTP and drives it in headless Chromium, so
 * every check below runs against the real static site, service worker included.
 *
 * Run: node tests/app.test.js
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
};

let passed = 0, failed = 0;
const results = [];

function check(name, ok, detail) {
  (ok ? passed++ : failed++);
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`);
  console.log(results[results.length - 1]);
}
const eq = (name, actual, expected) =>
  check(name, JSON.stringify(actual) === JSON.stringify(expected),
    JSON.stringify(actual) === JSON.stringify(expected) ? String(actual)
      : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);

function startServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(fs.readFileSync(file));
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

/** Freeze the page clock at a fixed local date before any script runs. */
function clockScript(iso) {
  return `(() => {
    const FIXED = new Date(${JSON.stringify(iso)}).getTime();
    const RealDate = Date;
    class MockDate extends RealDate {
      constructor(...a) { super(...(a.length ? a : [FIXED])); }
      static now() { return FIXED; }
    }
    window.Date = MockDate;
  })()`;
}

(async () => {
  const server = await startServer();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];

  async function newPage(ctx, opts = {}) {
    const page = await ctx.newPage();
    page.on('console', (m) => {
      // A blocked/failed load of the Google tag (ad-blocker, offline, a
      // network-restricted CI sandbox) must never count as an app error -
      // it is a fire-and-forget external analytics script the app's own
      // functionality never depends on. The failing URL shows up in the
      // console message's location, not its text. Anything else - including
      // a real JS error thrown from a googletagmanager.com-hosted script -
      // still fails the check.
      if (m.type() !== 'error') return;
      if (/googletagmanager\.com/.test(m.location().url) &&
          /^Failed to load resource/.test(m.text())) return;
      errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    if (opts.clock) await page.addInitScript(clockScript(opts.clock));
    return page;
  }

  // Android-ish viewport for every context.
  const ctxOpts = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 };

  /**
   * Seed a saved selection the way a real user would leave one behind.
   * Deliberately NOT addInitScript: that re-runs on every navigation and would
   * silently re-create the selection after a Reset, hiding real bugs.
   */
  async function seed(page, codes) {
    await page.goto(base);
    await page.evaluate((c) => localStorage.setItem('iiserk.tt.courses.v1', JSON.stringify(c)), codes);
    await page.reload();
  }

  /** Read a rendered list as [time, code, type, room, isEdited] rows. */
  const listRows = (page, sel) => page.$$eval(`${sel} .event`, (els) => els.map((el) => [
    el.querySelector('.time').textContent.trim(),
    el.querySelector('.code').textContent.trim(),
    el.querySelector('.badge').textContent.trim(),
    el.querySelector('.room span').textContent.trim(),
    !!el.querySelector('.edited-flag'),
  ]));

  /** Open the "..." menu of the nth event in a list. */
  async function openMenu(page, sel, n) {
    await page.locator(`${sel} .evt-menu`).nth(n).click();
    await page.waitForSelector('#event-sheet:not([hidden])');
  }

  /** Read the full Mid-Sem schedule sheet's rows as [time, code, venue, isEdited]. */
  const midsemRows = (page) => page.$$eval('#midsem-list .event', (els) => els.map((el) => [
    el.querySelector('.time').textContent.trim(),
    el.querySelector('.code').textContent.trim(),
    el.querySelector('.room span').textContent.trim(),
    !!el.querySelector('.edited-flag'),
  ]));

  /** Open the edit dialog for the nth exam in the Mid-Sem full schedule sheet. */
  async function openMidsemEdit(page, n) {
    await page.locator('#midsem-list .evt-menu').nth(n).click();
    await page.waitForSelector('#midsem-edit-sheet:not([hidden])');
  }

  const editValues = (page) => page.evaluate(() =>
    ['f-day', 'f-time', 'f-course', 'f-name', 'f-type', 'f-duration', 'f-room']
      .map((id) => document.getElementById(id).value));

  /** The published event as TIMETABLE_DATA still holds it. */
  const publishedEvent = (page, id) => page.evaluate((eid) => {
    const e = window.TIMETABLE_DATA.events.find((x) => x.id === eid);
    return e ? [e.day, e.time, e.course, e.type, e.room] : null;
  }, id);

  const MON_PH3102 = 'mon-0950-ph3102-theory-g02';   // Monday 09:50 PH3102 Theory G02
  const MON_TUT = 'mon-0800-ph3104-tutorial-g08';    // Monday 08:00 PH3104 Tutorial G08

  // ============ 1. First launch shows the picker ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx);
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    check('first launch shows the course picker', await page.isVisible('#screen-setup'));
    check('first launch hides the timetable', !(await page.isVisible('#screen-app')));

    const rows = await page.locator('.course-row').count();
    eq('picker lists every timetabled course', rows, 131);
    eq('selected counter starts at zero',
      (await page.textContent('#sel-count')).trim(), '0 courses selected');

    // --- search
    await page.fill('#search', 'PH31');
    await page.waitForTimeout(60);
    const codes = await page.locator('.course-row .code').allTextContents();
    eq('search narrows to matching codes', codes, ['PH3101', 'PH3102', 'PH3103', 'PH3104', 'PH3105']);

    await page.fill('#search', 'quantum mech');
    await page.waitForTimeout(60);
    eq('search also matches course names',
      await page.locator('.course-row .code').allTextContents(), ['PH3102', 'PH4106']);

    await page.click('#search-clear');
    await page.waitForTimeout(60);
    eq('clearing search restores the full list', await page.locator('.course-row').count(), 131);

    // --- department filter
    await page.click('[data-dept="PH"]');
    await page.waitForTimeout(60);
    const phCodes = await page.locator('.course-row .code').allTextContents();
    check('department filter shows only that prefix',
      phCodes.length > 0 && phCodes.every((c) => c.startsWith('PH')), `${phCodes.length} PH courses`);
    await page.click('[data-dept="ALL"]');

    // --- select / deselect
    await page.fill('#search', 'PH3104');
    await page.waitForTimeout(60);
    await page.click('.course-row[data-code="PH3104"]');
    eq('selecting a course updates the counter',
      (await page.textContent('#sel-count')).trim(), '1 course selected');
    eq('selected row is marked pressed',
      await page.getAttribute('.course-row[data-code="PH3104"]', 'aria-pressed'), 'true');
    await page.click('.course-row[data-code="PH3104"]');
    eq('deselecting a course updates the counter',
      (await page.textContent('#sel-count')).trim(), '0 courses selected');

    // --- pick the spec's example set
    for (const code of ['PH3104', 'PH3102', 'MA3101']) {
      await page.fill('#search', code);
      await page.waitForTimeout(50);
      await page.click(`.course-row[data-code="${code}"]`);
    }
    eq('three courses selected', (await page.textContent('#sel-count')).trim(), '3 courses selected');

    await page.click('#continue-btn');
    await page.waitForSelector('#screen-app:not([hidden])');
    check('Continue opens the timetable', await page.isVisible('#screen-app'));

    // --- persistence
    const stored = await page.evaluate(() => localStorage.getItem('iiserk.tt.courses.v1'));
    eq('selection saved to localStorage', JSON.parse(stored), ['MA3101', 'PH3102', 'PH3104']);

    // --- reload: straight to the timetable, no picker
    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    check('reload skips the picker', !(await page.isVisible('#screen-setup')));
    check('reload restores the timetable', await page.isVisible('#screen-app'));

    // --- persistence across a brand-new page in the same profile
    const page2 = await newPage(ctx);
    await page2.goto(base);
    await page2.waitForSelector('#screen-app:not([hidden])');
    check('selection survives closing and reopening the app',
      !(await page2.isVisible('#screen-setup')));
    eq('restored selection is intact',
      await page2.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.courses.v1'))),
      ['MA3101', 'PH3102', 'PH3104']);
    await page2.close();
    await ctx.close();
  }

  // ============ 2. Course filtering + day correctness ============
  {
    const ctx = await browser.newContext(ctxOpts);
    // Monday 2026-08-24, 09:10 -> PH3104 Theory (08:55, G08) is in progress.
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102', 'MA3101']);
    await page.waitForSelector('#screen-app:not([hidden])');

    const shown = await page.locator('#today-list .event .code').allTextContents();
    check('only selected courses appear',
      shown.every((c) => ['PH3104', 'PH3102', 'MA3101'].includes(c)), shown.join(', '));
    eq('Monday list matches the source timetable', shown, ['PH3104', 'PH3104', 'PH3102']);

    const types = await page.locator('#today-list .event .badge').allTextContents();
    check('tutorials show alongside their course when selected',
      types.includes('Tutorial'), types.join(', '));
    eq('Monday 08:00 PH3104 is the tutorial, 08:55 is theory',
      await page.locator('#today-list .event').first().locator('.time, .badge').allTextContents(),
      ['08:00', 'Tutorial']);

    const rooms = await page.locator('#today-list .event .room span').allTextContents();
    eq('rooms preserved exactly', rooms, ['G08', 'G08', 'G02']);

    eq('day header counts the day\'s classes',
      (await page.textContent('#today-head')).trim(), 'Monday · 3 classes');

    // --- current + next detection
    const nowCard = await page.textContent('#now-card');
    check('current class is announced', /Current class/i.test(nowCard));
    check('current class is the right course', /PH3104/.test(nowCard));
    check('current class shows its room', /G08/.test(nowCard));
    eq('remaining time is computed exactly (50-minute class)',
      (await page.locator('.now-card.live .now-remain').textContent()).trim(),
      '35 minutes remaining');
    check('next class is announced', /Next/.test(nowCard));
    check('next class is the 09:50 PH3102', /09:50/.test(nowCard) && /PH3102/.test(nowCard));

    eq('exactly one event is flagged as running now',
      await page.locator('#today-list .event.is-now').count(), 1);
    eq('the running event is the 08:55 theory class',
      await page.locator('#today-list .event.is-now .time').textContent(), '08:55');
    eq('the earlier tutorial is dimmed as past',
      await page.locator('#today-list .event.is-past .time').allTextContents(), ['08:00']);
    eq('the following class is flagged as next',
      await page.locator('#today-list .event.is-next .time').allTextContents(), ['09:50']);

    // --- week view
    await page.click('.tab[data-view="week"]');
    await page.waitForSelector('#view-week:not([hidden])');
    eq('week view offers Monday-Friday with per-day counts',
      await page.locator('#day-chips .chip').allTextContents(),
      ['Mon3', 'Tue3', 'Wed1', 'Thu2', 'Fri3']);
    check('week view opens on today',
      await page.getAttribute('#day-chips [data-day="Monday"]', 'aria-selected') === 'true');

    await page.click('#day-chips [data-day="Wednesday"]');
    await page.waitForTimeout(60);
    eq('switching day re-filters the list',
      await page.locator('#week-list .event .code').allTextContents(), ['MA3101']);
    eq('Wednesday times come from the source',
      await page.locator('#week-list .event .time').allTextContents(), ['10:45']);

    /** Read the rendered list as [time, code, type, room] rows. */
    const rows = () => page.$$eval('#week-list .event', (els) => els.map((el) => [
      el.querySelector('.time').textContent.trim(),
      el.querySelector('.code').textContent.trim(),
      el.querySelector('.badge').textContent.trim(),
      el.querySelector('.room span').textContent.trim(),
    ]));

    await page.click('#day-chips [data-day="Tuesday"]');
    await page.waitForTimeout(60);
    eq('Tuesday renders the tutorial + theory pair and the second course',
      await rows(),
      [['08:00', 'PH3102', 'Tutorial', 'G02'],
       ['08:55', 'PH3102', 'Theory', 'G02'],
       ['11:40', 'PH3104', 'Theory', 'G08']]);

    await page.click('#day-chips [data-day="Friday"]');
    await page.waitForTimeout(60);
    eq('Friday keeps a course\'s theory and tutorial as separate events',
      await rows(),
      [['10:45', 'PH3104', 'Theory', 'G08'],
       ['16:15', 'MA3101', 'Theory', 'G09'],
       ['17:10', 'MA3101', 'Tutorial', 'G09']]);
    await ctx.close();
  }

  // ============ 3. Time-of-day edge cases ============
  {
    const cases = [
      { at: '2026-08-24T07:30:00', label: 'before the first class',
        want: (t) => !/Current class/.test(t) && /08:00/.test(t) && /Starts in 30 minutes/.test(t) },
      { at: '2026-08-24T18:30:00', label: 'after the last class of the day',
        want: (t) => !/Current class/.test(t) && /tomorrow/i.test(t) },
      { at: '2026-08-29T12:00:00', label: 'Saturday',
        want: (t) => /Next/.test(t) && /PH3104/.test(t) },
      { at: '2026-08-28T20:00:00', label: 'Friday night rolls over to Monday',
        want: (t) => /on Monday/.test(t) },
      { at: '2026-08-24T09:44:30', label: 'last 30 s of a class',
        want: (t) => /Current class/.test(t) && /less than a minute|1 minute/.test(t) },
      { at: '2026-08-24T09:47:00', label: 'during the 5-minute break between classes',
        want: (t) => !/Current class/.test(t) && /Starts in 3 minutes/.test(t) },
      { at: '2026-08-24T09:50:00', label: 'exactly on a class start',
        want: (t) => /Current class/.test(t) && /50 minutes remaining/.test(t) },
    ];

    for (const c of cases) {
      const ctx = await browser.newContext(ctxOpts);
      const page = await newPage(ctx, { clock: c.at });
      await seed(page, ['PH3104', 'PH3102', 'MA3101']);
      await page.waitForSelector('#screen-app:not([hidden])');
      const text = (await page.textContent('#now-card')).replace(/\s+/g, ' ');
      check(`now-card: ${c.label}`, c.want(text), text.slice(0, 90));
      await ctx.close();
    }

    // Weekend: Saturday and Sunday are holidays.
    // From Saturday the next class is "on Monday"; from Sunday it is "tomorrow".
    for (const [at, day, when] of [['2026-08-29T12:00:00', 'Saturday', 'Starts on Monday'],
                                   ['2026-08-30T12:00:00', 'Sunday', 'Starts tomorrow']]) {
      const ctx = await browser.newContext(ctxOpts);
      const page = await newPage(ctx, { clock: at });
      await seed(page, ['PH3104']);
      await page.waitForSelector('#screen-app:not([hidden])');
      const list = await page.textContent('#today-list');
      check(`${day} is a holiday with no classes`,
        /weekend/i.test(list) && new RegExp(day).test(list) &&
        (await page.locator('#today-list .event').count()) === 0);
      const card = await page.textContent('#now-card');
      check(`${day} still points at Monday's first class`,
        card.includes(when) && /PH3104/.test(card), when);
      await ctx.close();
    }
  }

  // ============ 4. No courses selected ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, []);
    await page.waitForSelector('#screen-app:not([hidden])');

    check('empty selection still opens the timetable', await page.isVisible('#screen-app'));
    check('empty selection explains what to do',
      /No courses selected/.test(await page.textContent('#today-list')));
    eq('empty selection renders no events', await page.locator('#today-list .event').count(), 0);
    eq('header reflects zero courses',
      (await page.textContent('#semester-label')).trim(), 'Autumn 2026 · 0 courses');

    // The empty-state CTA opens the picker.
    await page.click('#today-list [data-action="pick"]');
    await page.waitForSelector('#screen-setup:not([hidden])');
    check('empty-state button opens the picker', await page.isVisible('#screen-setup'));

    await ctx.close();
  }

  // ============ 5. Change courses + Reset ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    // --- change courses keeps existing picks and can be cancelled
    await page.click('#open-settings');
    await page.waitForSelector('#settings-sheet:not([hidden])');
    await page.click('#change-courses');
    await page.waitForSelector('#screen-setup:not([hidden])');
    eq('change-courses pre-selects the saved courses',
      (await page.textContent('#sel-count')).trim(), '1 course selected');
    eq('change-courses shows a Save button',
      (await page.textContent('#continue-btn')).trim(), 'Save');

    await page.fill('#search', 'MA3101');
    await page.waitForTimeout(60);
    await page.click('.course-row[data-code="MA3101"]');
    await page.click('#setup-cancel');
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('cancelling change-courses discards the edit',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.courses.v1'))), ['PH3104']);

    // --- change courses, saved
    await page.click('#open-settings');
    await page.click('#change-courses');
    await page.waitForSelector('#screen-setup:not([hidden])');
    await page.fill('#search', 'MA3101');
    await page.waitForTimeout(60);
    await page.click('.course-row[data-code="MA3101"]');
    await page.click('#continue-btn');
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('saving change-courses updates localStorage',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.courses.v1'))),
      ['MA3101', 'PH3104']);
    eq('timetable re-renders with the new course',
      await page.locator('#today-list .event .code').allTextContents(),
      ['PH3104', 'PH3104']);   // MA3101 does not meet on Monday

    // --- reset asks first, and cancel is safe
    await page.click('#open-settings');
    await page.click('#reset-btn');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    check('reset shows a confirmation dialog', await page.isVisible('#confirm-dialog'));
    check('confirmation warns before destroying the selection',
      /clears your saved course selection/i.test(await page.textContent('#confirm-body')));
    await page.click('#confirm-cancel');
    await page.waitForTimeout(60);
    eq('cancelling reset keeps the selection',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.courses.v1'))),
      ['MA3101', 'PH3104']);

    // --- reset, confirmed
    await page.click('#open-settings');
    await page.click('#reset-btn');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForSelector('#screen-setup:not([hidden])');
    check('reset returns to the course picker', await page.isVisible('#screen-setup'));
    eq('reset clears the saved selection',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.courses.v1')), null);
    eq('reset keeps the embedded timetable data intact',
      await page.evaluate(() => window.TIMETABLE_DATA.events.length), 482);
    eq('picker after reset starts empty',
      (await page.textContent('#sel-count')).trim(), '0 courses selected');

    // --- and a reload after reset lands on the picker again
    await page.reload();
    await page.waitForSelector('#screen-setup:not([hidden])');
    check('reload after reset shows the picker', await page.isVisible('#screen-setup'));
    await ctx.close();
  }

  // ============ 6. Theme ============
  {
    const ctx = await browser.newContext({ ...ctxOpts, colorScheme: 'light' });
    const page = await newPage(ctx);
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.click('#open-settings');
    await page.click('#theme-seg [data-theme="dark"]');
    await page.waitForTimeout(60);
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check('dark mode changes the page background', lightBg !== darkBg, `${lightBg} -> ${darkBg}`);
    eq('theme choice is persisted',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.theme.v1')), 'dark');

    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('theme survives a reload',
      await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
    await ctx.close();
  }

  // ============ 7. Offline via the service worker ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready,
      null, { timeout: 15000 });
    await page.evaluate(() => navigator.serviceWorker.ready);
    // Give the precache a moment to finish writing.
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      if (!keys.length) return false;
      const c = await caches.open(keys[0]);
      return (await c.keys()).length >= 9;
    }, null, { timeout: 15000 });

    const cached = await page.evaluate(async () => {
      const c = await caches.open((await caches.keys())[0]);
      return (await c.keys()).map((r) => new URL(r.url).pathname);
    });
    check('service worker precached the app shell',
      ['/index.html', '/style.css', '/app.js', '/data/timetable.js', '/manifest.json']
        .every((f) => cached.some((p) => p.endsWith(f))), cached.join(' '));

    // Select courses, then go offline for real.
    await page.fill('#search', 'PH3104');
    await page.waitForTimeout(60);
    await page.click('.course-row[data-code="PH3104"]');
    await page.click('#continue-btn');
    await page.waitForSelector('#screen-app:not([hidden])');

    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])', { timeout: 15000 });
    check('app loads with the network switched off', await page.isVisible('#screen-app'));
    eq('offline app still has the full dataset',
      await page.evaluate(() => window.TIMETABLE_DATA.events.length), 482);
    eq('offline app still shows the right classes',
      await page.locator('#today-list .event .code').allTextContents(), ['PH3104', 'PH3104']);
    check('offline app still detects the current class',
      /Current class/.test(await page.textContent('#now-card')));
    check('offline styling is intact',
      await page.evaluate(() => getComputedStyle(document.querySelector('.app-bar')).borderBottomWidth) === '1px');

    // A fresh tab (cold start) while still offline.
    const cold = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await cold.goto(base);
    await cold.waitForSelector('#screen-app:not([hidden])', { timeout: 15000 });
    check('a cold start works offline too', await cold.isVisible('#screen-app'));
    await ctx.setOffline(false);
    await ctx.close();
  }

  // ============ 8. Data integrity from inside the browser ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    const audit = await page.evaluate(() => {
      const D = window.TIMETABLE_DATA;
      const t = window.__tt;
      const all = new Set(D.courses.map((c) => c.code));
      const perDay = D.days.map((d) => t.eventsFor(d, all).length);
      const sortedOk = D.days.every((d) => {
        const evs = t.eventsFor(d, all);
        return evs.every((e, i) => i === 0 || evs[i - 1].minutes <= e.minutes);
      });
      // Filtering must be exact: nothing outside the chosen set survives.
      const pick = new Set(['PH3104', 'PH3102', 'MA3101']);
      const filtered = D.days.flatMap((d) => t.eventsFor(d, pick));
      return {
        total: D.events.length,
        courses: D.courses.length,
        perDay,
        sortedOk,
        filteredAllInSet: filtered.every((e) => pick.has(e.course)),
        filteredCount: filtered.length,
        expectedCount: D.events.filter((e) => pick.has(e.course)).length,
        types: [...new Set(D.events.map((e) => e.type))].sort(),
        emptyPick: t.eventsFor('Monday', new Set()).length,
      };
    });

    eq('dataset loaded in the browser', audit.total, 482);
    eq('course catalog loaded in the browser', audit.courses, 131);
    eq('per-day totals match the source', audit.perDay, [103, 94, 82, 104, 99]);
    check('every day list is chronologically sorted', audit.sortedOk);
    check('filtering never leaks an unselected course', audit.filteredAllInSet);
    eq('filtering returns every event of the chosen courses',
      audit.filteredCount, audit.expectedCount);
    eq('only three event types exist', audit.types, ['Lab', 'Theory', 'Tutorial']);
    eq('an empty selection yields no events', audit.emptyPick, 0);

    // A lab course renders as a Lab with its lab room.
    const lab = await page.evaluate(() => {
      const t = window.__tt;
      const evs = t.eventsFor('Monday', new Set(['PH2103']));
      return evs.map((e) => [e.time, e.type, e.room]);
    });
    eq('lab events keep their type and room', lab, [['13:30', 'Lab', 'DPS 2nd Year Lab']]);

    const durations = await page.evaluate(() => {
      const D = window.TIMETABLE_DATA;
      const by = {};
      D.events.forEach((e) => { (by[e.type] = by[e.type] || new Set()).add(e.duration); });
      return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, [...v]]));
    });
    // Theory carries two lengths: the standard 50, and the Wed 13:30 CS2102
    // duration exception at 160 (still typed Theory - see build-data.js).
    eq('classes are 50 minutes, labs 160, with CS2102\'s one documented exception',
      Object.keys(durations).sort().map((k) => [k, durations[k].sort((a, b) => a - b)]),
      [['Lab', [160]], ['Theory', [50, 160]], ['Tutorial', [50]]]);

    // The 55-minute slot step minus a 50-minute class is the 5-minute break.
    const gaps = await page.evaluate(() => {
      const t = window.__tt, D = window.TIMETABLE_DATA;
      const all = new Set(D.courses.map((c) => c.code));
      const starts = [...new Set(t.eventsFor('Monday', all)
        .filter((e) => e.type !== 'Lab').map((e) => e.minutes))].sort((a, b) => a - b);
      const out = [];
      for (let i = 1; i < starts.length; i++) {
        const gap = starts[i] - starts[i - 1] - 50;
        if (gap < 60) out.push(gap);   // ignore the long midday break
      }
      return [...new Set(out)];
    });
    eq('consecutive slots leave a 5-minute break', gaps, [5]);
    await ctx.close();
  }

  // ============ 9. Edit an individual event ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102', 'MA3101']);
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('baseline Monday list', await listRows(page, '#today-list'),
      [['08:00', 'PH3104', 'Tutorial', 'G08', false],
       ['08:55', 'PH3104', 'Theory', 'G08', false],
       ['09:50', 'PH3102', 'Theory', 'G02', false]]);

    eq('every event exposes a menu control',
      await page.locator('#today-list .evt-menu').count(), 3);

    await openMenu(page, '#today-list', 2);
    check('action sheet names the chosen event',
      (await page.textContent('#event-sheet-title')).includes('PH3102'));
    eq('action sheet describes the chosen event',
      (await page.textContent('#event-sheet-sub')).trim(),
      'Monday · 09:50 · PH3102 · Theory · G02');

    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    eq('edit dialog pre-fills the existing values', await editValues(page),
      ['Monday', '09:50', 'PH3102', 'Quantum Mechanics', 'Theory', '50', 'G02']);

    await page.fill('#f-time', '11:30');
    await page.fill('#f-room', 'G09');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    eq('edit applies immediately and re-sorts chronologically',
      await listRows(page, '#today-list'),
      [['08:00', 'PH3104', 'Tutorial', 'G08', false],
       ['08:55', 'PH3104', 'Theory', 'G08', false],
       ['11:30', 'PH3102', 'Theory', 'G09', true]]);

    eq('only the changed fields are persisted (sparse patch)',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.custom.v1')).overrides),
      { [MON_PH3102]: { time: '11:30', room: 'G09' } });

    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('edit survives a reload', await listRows(page, '#today-list'),
      [['08:00', 'PH3104', 'Tutorial', 'G08', false],
       ['08:55', 'PH3104', 'Theory', 'G08', false],
       ['11:30', 'PH3102', 'Theory', 'G09', true]]);

    eq('the published timetable is untouched by the edit',
      await publishedEvent(page, MON_PH3102), ['Monday', '09:50', 'PH3102', 'Theory', 'G02']);
    check('published data is frozen against writes', await page.evaluate(() => {
      const e = window.TIMETABLE_DATA.events[0];
      const before = e.room;
      try { e.room = 'HACKED'; } catch (err) { /* strict mode throws */ }
      return e.room === before;
    }));

    // --- editing type changes the duration
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.selectOption('#f-type', 'Lab');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });
    eq('changing the type updates the badge and the duration',
      await page.$$eval('#today-list .event', (els) => {
        const el = els[els.length - 1];
        return [el.querySelector('.badge').textContent.trim(),
                el.querySelector('.dur').textContent.trim()];
      }), ['Lab', '160 min']);

    // put it back to Theory for the checks that follow
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.selectOption('#f-type', 'Theory');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });
    await ctx.close();
  }

  // ============ 10. Cancelling an edit changes nothing ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-time', '06:00');
    await page.fill('#f-room', 'NOWHERE');
    await page.click('#edit-cancel');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    eq('cancelling an edit leaves the event untouched',
      await listRows(page, '#today-list'),
      [['08:00', 'PH3104', 'Tutorial', 'G08', false],
       ['08:55', 'PH3104', 'Theory', 'G08', false],
       ['09:50', 'PH3102', 'Theory', 'G02', false]]);
    eq('cancelling an edit writes nothing to storage',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1')), null);

    // --- an edit that restores every original value drops the override
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-room', 'G77');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-room', 'G02');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });
    eq('re-entering the original values clears the override',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1')), null);
    check('the event is no longer flagged as edited',
      (await listRows(page, '#today-list'))[2][4] === false);
    await ctx.close();
  }

  // ============ 11. Remove an individual event ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    // --- cancel is safe
    await openMenu(page, '#today-list', 0);
    await page.click('#event-remove');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    check('remove asks for confirmation first',
      /Remove this class/i.test(await page.textContent('#confirm-title')));
    check('the confirmation says the course stays selected',
      /stays selected/i.test(await page.textContent('#confirm-body')));
    await page.click('#confirm-cancel');
    await page.waitForTimeout(80);
    eq('cancelling remove keeps the event',
      (await listRows(page, '#today-list')).length, 3);
    eq('cancelling remove writes nothing',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1')), null);

    // --- confirmed
    await openMenu(page, '#today-list', 0);
    await page.click('#event-remove');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(120);

    eq('only the chosen event disappears', await listRows(page, '#today-list'),
      [['08:55', 'PH3104', 'Theory', 'G08', false],
       ['09:50', 'PH3102', 'Theory', 'G02', false]]);
    eq('removing one class does not deselect its course',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.courses.v1')).sort()),
      ['PH3102', 'PH3104']);
    eq('the course header still counts the course',
      (await page.textContent('#semester-label')).trim(), 'Autumn 2026 · 2 courses');

    const week = await page.evaluate(() => {
      const t = window.__tt;
      return t.eventsFor('Tuesday', new Set(['PH3104', 'PH3102'])).map((e) => e.time + ' ' + e.course);
    });
    eq('other events of the same course survive elsewhere in the week', week,
      ['08:00 PH3102', '08:55 PH3102', '11:40 PH3104']);

    eq('removal is persisted by id',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.custom.v1')).removed),
      [MON_TUT]);
    eq('the published timetable still contains the removed class',
      await publishedEvent(page, MON_TUT), ['Monday', '08:00', 'PH3104', 'Tutorial', 'G08']);
    await ctx.close();
  }

  // ============ 12. Day/time move + course-code edge case ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    // move Monday 09:50 PH3102 to Tuesday
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.selectOption('#f-day', 'Tuesday');
    await page.fill('#f-time', '15:00');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    eq('the moved event leaves its old day', await listRows(page, '#today-list'),
      [['08:00', 'PH3104', 'Tutorial', 'G08', false],
       ['08:55', 'PH3104', 'Theory', 'G08', false]]);

    await page.click('.tab[data-view="week"]');
    await page.click('#day-chips [data-day="Tuesday"]');
    await page.waitForTimeout(80);
    eq('the moved event arrives on its new day, correctly sorted',
      await listRows(page, '#week-list'),
      [['08:00', 'PH3102', 'Tutorial', 'G02', false],
       ['08:55', 'PH3102', 'Theory', 'G02', false],
       ['11:40', 'PH3104', 'Theory', 'G08', false],
       ['15:00', 'PH3102', 'Theory', 'G02', true]]);

    // edit a course code to one that is NOT selected
    await openMenu(page, '#week-list', 3);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-course', 'PH4101');
    await page.waitForTimeout(60);
    eq('typing a known code fills in its name',
      await page.inputValue('#f-name'), 'Condensed Matter Physics');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    const rows = await listRows(page, '#week-list');
    check('an event edited to an unselected course code stays visible',
      rows.some((r) => r[1] === 'PH4101' && r[4] === true), JSON.stringify(rows));
    eq('editing a course code does not change the course selection',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.courses.v1')).sort()),
      ['PH3102', 'PH3104']);
    await ctx.close();
  }

  // ============ 13. Current/next detection uses the modified timetable ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('baseline next class is the published 09:50',
      (await page.locator('.now-card:not(.live) .now-code').textContent()).trim(), '09:50');

    // move the next class later: it must stay next, with a new countdown
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-time', '10:00');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    eq('next class uses the edited start time',
      (await page.locator('.now-card:not(.live) .now-code').textContent()).trim(), '10:00');
    eq('the countdown is recomputed from the edited time',
      (await page.locator('.now-card:not(.live) .now-remain').textContent()).trim(),
      'Starts in 50 minutes');

    // remove the upcoming class: the next one must move on
    await openMenu(page, '#today-list', 2);
    await page.click('#event-remove');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(120);
    const card = (await page.textContent('#now-card')).replace(/\s+/g, ' ');
    check('a removed class is no longer offered as next',
      !/10:00/.test(card) && /tomorrow/i.test(card), card.slice(0, 90));

    // remove the class that is running right now
    await openMenu(page, '#today-list', 1);
    await page.click('#event-remove');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(120);
    check('a removed class stops counting as the current class',
      !/Current class/.test(await page.textContent('#now-card')));
    await ctx.close();
  }

  // ============ 14. Reset timetable changes ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    await page.click('#open-settings');
    await page.waitForSelector('#settings-sheet:not([hidden])');
    check('reset-changes is hidden when there is nothing to reset',
      await page.locator('#reset-changes-btn').isHidden());
    await page.click('#close-settings');

    // make one edit and one removal
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-room', 'G99');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });
    await openMenu(page, '#today-list', 0);
    await page.click('#event-remove');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(120);

    await page.click('#open-settings');
    check('reset-changes appears once changes exist',
      await page.locator('#reset-changes-btn').isVisible());
    check('reset-changes summarises what will be restored',
      /1 class edited · 1 class removed/.test(await page.textContent('#changes-summary')),
      (await page.textContent('#changes-summary')).trim());

    // cancel changes nothing
    await page.click('#reset-changes-btn');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    check('reset-changes asks for confirmation',
      /Reset all timetable changes/i.test(await page.textContent('#confirm-title')));
    await page.click('#confirm-cancel');
    await page.waitForTimeout(80);
    eq('cancelling reset-changes keeps the customisations',
      (await listRows(page, '#today-list')).length, 2);

    // confirmed
    await page.click('#open-settings');
    await page.click('#reset-changes-btn');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(150);

    eq('reset-changes restores every original event',
      await listRows(page, '#today-list'),
      [['08:00', 'PH3104', 'Tutorial', 'G08', false],
       ['08:55', 'PH3104', 'Theory', 'G08', false],
       ['09:50', 'PH3102', 'Theory', 'G02', false]]);
    eq('reset-changes clears the customisation entry',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1')), null);
    eq('reset-changes leaves the course selection alone',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.courses.v1')).sort()),
      ['PH3102', 'PH3104']);
    await ctx.close();
  }

  // ============ 15. Reset courses and customisations stay separate ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    await openMenu(page, '#today-list', 0);
    await page.click('#event-remove');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(120);

    await page.click('#open-settings');
    await page.click('#reset-btn');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForSelector('#screen-setup:not([hidden])');

    eq('reset courses still clears the selection',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.courses.v1')), null);
    eq('reset courses does NOT discard timetable customisations',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.custom.v1')).removed),
      [MON_TUT]);

    // re-pick the same course: the customisation is still in force
    await page.fill('#search', 'PH3104');
    await page.waitForTimeout(60);
    await page.click('.course-row[data-code="PH3104"]');
    await page.click('#continue-btn');
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('re-selecting a course restores its customisations too',
      await listRows(page, '#today-list'),
      [['08:55', 'PH3104', 'Theory', 'G08', false]]);
    await ctx.close();
  }

  // ============ 16. Malformed / missing storage ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await page.goto(base);
    await page.evaluate(() => {
      localStorage.setItem('iiserk.tt.courses.v1', JSON.stringify(['PH3104', 'PH3102']));
      localStorage.setItem('iiserk.tt.custom.v1', '{not valid json');
    });
    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('corrupt customisation data degrades to no customisations',
      (await listRows(page, '#today-list')).length, 3);

    await page.evaluate((id) => localStorage.setItem('iiserk.tt.custom.v1', JSON.stringify({
      version: 1,
      overrides: {
        [id]: { time: '25:99', day: 'Funday', type: 'Nonsense', room: 'G07' },
        'no-such-event-id': { room: 'X' },
        'bad-patch': 'not an object',
      },
      removed: ['no-such-event-either', 42, null],
    })), MON_PH3102);
    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('invalid fields are dropped but valid ones survive',
      await listRows(page, '#today-list'),
      [['08:00', 'PH3104', 'Tutorial', 'G08', false],
       ['08:55', 'PH3104', 'Theory', 'G08', false],
       ['09:50', 'PH3102', 'Theory', 'G07', true]]);
    check('unknown event ids are ignored rather than crashing',
      await page.isVisible('#screen-app'));
    await ctx.close();
  }

  // ============ 17. Offline cold start with customisations ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    // register + precache while online
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      if (!keys.length) return false;
      const c = await caches.open(keys[0]);
      return (await c.keys()).length >= 9;
    }, null, { timeout: 15000 });

    for (const code of ['PH3104', 'PH3102']) {
      await page.fill('#search', code);
      await page.waitForTimeout(50);
      await page.click(`.course-row[data-code="${code}"]`);
    }
    await page.click('#continue-btn');
    await page.waitForSelector('#screen-app:not([hidden])');

    // remove one event, edit another
    await openMenu(page, '#today-list', 0);
    await page.click('#event-remove');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(120);

    await openMenu(page, '#today-list', 1);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-time', '12:00');
    await page.fill('#f-room', 'G09');
    await page.fill('#f-duration', '80');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    const expected = [['08:55', 'PH3104', 'Theory', 'G08', false],
                      ['12:00', 'PH3102', 'Theory', 'G09', true]];
    eq('changes apply immediately', await listRows(page, '#today-list'), expected);

    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('changes survive a reload (still online)', await listRows(page, '#today-list'), expected);

    const page2 = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await page2.goto(base);
    await page2.waitForSelector('#screen-app:not([hidden])');
    eq('changes survive a fresh page', await listRows(page2, '#today-list'), expected);
    await page2.close();

    // ---- genuinely offline, cold start
    await ctx.setOffline(true);
    const cold = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await cold.goto(base);
    await cold.waitForSelector('#screen-app:not([hidden])', { timeout: 15000 });

    check('app cold-starts with no network', await cold.isVisible('#screen-app'));
    eq('offline cold start keeps the removal and the edit',
      await listRows(cold, '#today-list'), expected);
    eq('offline Today view reflects the modifications',
      await cold.locator('#today-list .event .time').allTextContents(), ['08:55', '12:00']);
    eq('offline cold start keeps the manually-edited duration too',
      await cold.locator('#today-list .event .dur').last().textContent(), '80 min');

    await cold.click('.tab[data-view="week"]');
    await cold.waitForSelector('#view-week:not([hidden])');
    eq('offline Week view reflects the modifications',
      await listRows(cold, '#week-list'), expected);
    eq('offline week counts reflect the modifications',
      await cold.locator('#day-chips .chip').allTextContents(),
      ['Mon2', 'Tue3', 'Wed0', 'Thu1', 'Fri1']);

    await cold.click('.tab[data-view="today"]');
    const offlineCard = (await cold.textContent('#now-card')).replace(/\s+/g, ' ');
    check('offline current-class detection still works',
      /Current class/.test(offlineCard) && /PH3104/.test(offlineCard), offlineCard.slice(0, 70));
    check('offline next-class detection uses the edited time',
      /12:00/.test(offlineCard), offlineCard.slice(0, 140));
    eq('offline app still holds the full published dataset',
      await cold.evaluate(() => window.TIMETABLE_DATA.events.length), 482);
    eq('offline published data is still unmodified',
      await publishedEvent(cold, MON_PH3102), ['Monday', '09:50', 'PH3102', 'Theory', 'G02']);

    await ctx.setOffline(false);
    await ctx.close();
  }

  // ============ 18. Data integrity after customisation ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-time', '08:55');
    await page.fill('#f-room', 'G08');
    await page.fill('#f-course', 'PH3104');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    const audit = await page.evaluate(() => {
      const D = window.TIMETABLE_DATA, t = window.__tt;
      const eff = t.effectiveEvents();
      const ids = eff.map((e) => e.id);
      return {
        published: D.events.length,
        effective: eff.length,
        uniqueIds: new Set(ids).size,
        publishedIdsUnique: new Set(D.events.map((e) => e.id)).size,
      };
    });
    eq('the published event count is unchanged at 482', audit.published, 482);
    eq('editing introduces no duplicate events', audit.uniqueIds, audit.effective);
    eq('published ids remain unique', audit.publishedIdsUnique, 482);
    check('an edit that collides with another class does not merge them',
      audit.effective === 482, `${audit.effective} effective events`);

    eq('two classes may now share a slot without being merged',
      (await listRows(page, '#today-list')).map((r) => r[0] + ' ' + r[1] + ' ' + r[3]),
      ['08:00 PH3104 G08', '08:55 PH3104 G08', '08:55 PH3104 G08']);
    await ctx.close();
  }

  // ============ 19. Layout, touch targets and hierarchy ============
  {
    // No horizontal overflow anywhere, at the narrowest supported phone width.
    for (const [w, h] of [[360, 800], [412, 915], [900, 1000]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
      const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
      await seed(page, ['PH3104', 'PH3102', 'MA3101', 'PH2103', 'CH3102']);
      await page.waitForSelector('#screen-app:not([hidden])');

      const overflow = () => page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);

      eq(`no horizontal overflow on Today at ${w}px`, await overflow(), 0);
      await page.click('.tab[data-view="week"]');
      await page.waitForSelector('#view-week:not([hidden])');
      eq(`no horizontal overflow on Week at ${w}px`, await overflow(), 0);
      await page.click('#open-settings');
      await page.waitForSelector('#settings-sheet:not([hidden])');
      eq(`no horizontal overflow with the sheet open at ${w}px`, await overflow(), 0);
      await ctx.close();
    }

    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102', 'MA3101', 'PH2103', 'CH3102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    // --- touch targets, including any invisible hit area
    const target = (sel) => page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      let h = r.height;
      const after = getComputedStyle(el, '::after');
      if (after && after.content === '""') {
        h += Math.abs(parseFloat(after.top) || 0) + Math.abs(parseFloat(after.bottom) || 0);
      }
      return [Math.round(r.width), Math.round(h)];
    }, sel);

    const big = (name, sel, min) => target(sel).then((t) =>
      check(name, t && t[0] >= min && t[1] >= min, t ? t.join('x') : 'missing'));

    await big('settings button is a 44px target', '#open-settings', 44);
    await big('bottom-nav tabs are large targets', '.tab', 44);
    await big('per-event menu is a 44px target', '#today-list .evt-menu', 44);

    // --- content is never hidden behind the bottom navigation
    const clearance = await page.evaluate(() => {
      const main = document.getElementById('main');
      const bar = document.querySelector('.tabbar');
      return Math.round(bar.getBoundingClientRect().top - main.getBoundingClientRect().bottom);
    });
    check('the scroll area ends above the bottom nav (no overlap)', clearance >= 0, clearance + 'px');

    // --- concurrent classes share one card instead of stacking full cards
    eq('clashing current classes render a single card',
      await page.locator('.now-card.live').count(), 1);
    eq('both clashing classes are listed inside it',
      await page.locator('.now-card.live .now-row-code').allTextContents(), ['CH3102', 'PH3104']);
    check('the next card is still rendered alongside them',
      await page.locator('.now-card:not(.live)').count() === 1);
    check('the next card stays within the first screen',
      await page.evaluate(() => {
        const el = document.querySelector('.now-card:not(.live)');
        return el.getBoundingClientRect().bottom <= window.innerHeight;
      }));

    // --- a next class today carries no day chip; one on another day does
    eq('a next class today shows no day chip',
      await page.locator('.now-card:not(.live) .now-day').count(), 0);
    await ctx.close();

    const ctx2 = await browser.newContext(ctxOpts);
    const page2 = await newPage(ctx2, { clock: '2026-08-29T12:00:00' });   // Saturday
    await seed(page2, ['PH3104']);
    await page2.waitForSelector('#screen-app:not([hidden])');
    eq('a next class on another day is labelled with that day',
      (await page2.locator('.now-day').textContent()).trim(), 'Monday');
    await ctx2.close();

    const ctx3 = await browser.newContext(ctxOpts);
    const page3 = await newPage(ctx3, { clock: '2026-08-24T18:30:00' });   // Monday evening
    await seed(page3, ['PH3104']);
    await page3.waitForSelector('#screen-app:not([hidden])');
    eq('a next class tomorrow is labelled Tomorrow',
      (await page3.locator('.now-day').textContent()).trim(), 'Tomorrow');
    await ctx3.close();

    // --- the week day selector stays pinned while the list scrolls
    const ctx4 = await browser.newContext(ctxOpts);
    const page4 = await newPage(ctx4, { clock: '2026-08-24T09:10:00' });
    await page4.goto(base);
    await page4.evaluate(() => {
      const D = window.TIMETABLE_DATA;
      const codes = [...new Set(D.events.filter((e) => e.day === 'Monday').map((e) => e.course))].slice(0, 14);
      localStorage.setItem('iiserk.tt.courses.v1', JSON.stringify(codes));
    });
    await page4.reload();
    await page4.waitForSelector('#screen-app:not([hidden])');
    await page4.click('.tab[data-view="week"]');
    await page4.waitForSelector('#view-week:not([hidden])');

    const yBefore = await page4.evaluate(() => document.getElementById('day-chips').getBoundingClientRect().top);
    const scrolled = await page4.evaluate(() => {
      const m = document.getElementById('main');
      m.scrollTop = 400;
      return m.scrollTop;
    });
    await page4.waitForTimeout(120);
    const yAfter = await page4.evaluate(() => document.getElementById('day-chips').getBoundingClientRect().top);
    check('the day selector stays pinned while the week list scrolls',
      scrolled > 0 && Math.abs(yAfter - yBefore) < 2, `scrolled ${scrolled}px, moved ${Math.abs(yAfter - yBefore)}px`);
    await ctx4.close();
  }

  // ============ 20. CS2102's duration exception renders correctly ============
  {
    // Wednesday 13:30 CS2102 is published as Theory but genuinely runs 160
    // minutes (a full lab-length block), confirmed against the real schedule.
    // Everything downstream - the card, current/next detection, the countdown
    // - must use that real length, not the standard 50-minute Theory duration.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['CS2102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    await page.click('.tab[data-view="week"]');
    await page.click('#day-chips [data-day="Wednesday"]');
    await page.waitForTimeout(80);
    eq('CS2102 shows 160 min on its card, still badged Theory',
      await page.$$eval('#week-list .event', (els) => els.map((el) => [
        el.querySelector('.time').textContent.trim(),
        el.querySelector('.dur').textContent.trim(),
        el.querySelector('.badge').textContent.trim(),
      ])),
      [['13:30', '160 min', 'Theory']]);

    // The Monday CS2102 (a genuinely different, unexceptional class) stays 50.
    await page.click('#day-chips [data-day="Monday"]');
    await page.waitForTimeout(80);
    eq('the other CS2102 class (Monday) keeps the standard 50 min',
      await page.$$eval('#week-list .event', (els) => els.map((el) =>
        el.querySelector('.dur').textContent.trim())),
      ['50 min']);

    // Mid-way through the 160-minute block, it must still read as current.
    const ctx2 = await browser.newContext(ctxOpts);
    const page2 = await newPage(ctx2, { clock: '2026-09-02T15:30:00' });   // Wed 15:30, 2h in (a Wed with no holiday nearby)
    await seed(page2, ['CS2102']);
    await page2.waitForSelector('#screen-app:not([hidden])');
    const card = (await page2.textContent('#now-card')).replace(/\s+/g, ' ');
    check('120 minutes into the 160-minute block it still reads as current',
      /Current class/.test(card) && /CS2102/.test(card));
    check('remaining time reflects the real 160-minute length, not 50',
      /40 minutes remaining/.test(card), card.slice(0, 90));

    // At the point a standard 50-minute Theory class would have already
    // ended (80 minutes in), the real 160-minute block is still running.
    const ctx3 = await browser.newContext(ctxOpts);
    const page3 = await newPage(ctx3, { clock: '2026-09-02T14:50:00' });   // Wed 14:50, 80 min in (a Wed with no holiday nearby)
    await seed(page3, ['CS2102']);
    await page3.waitForSelector('#screen-app:not([hidden])');
    check('80 minutes in - past a standard Theory class\'s end - it is still current',
      /Current class/.test((await page3.textContent('#now-card'))));
    await ctx2.close();
    await ctx3.close();
    await ctx.close();
  }

  // ============ 20b. Opening Edit on the CS2102 exception shows its real 160 ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['CS2102']);
    await page.waitForSelector('#screen-app:not([hidden])');
    await page.click('.tab[data-view="week"]');
    await page.click('#day-chips [data-day="Wednesday"]');
    await page.waitForTimeout(80);
    await openMenu(page, '#week-list', 0);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    eq('editing the CS2102 exception prefills its real 160-minute duration',
      await page.inputValue('#f-duration'), '160');
    await ctx.close();
  }

  // ============ 21. Duration is directly editable ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await seed(page, ['PH3104', 'PH3102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    // --- editing duration alone, with the type left untouched
    await openMenu(page, '#today-list', 2);   // 09:50 PH3102 Theory G02
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-duration', '90');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    eq('the card shows the manually-set duration',
      await page.$$eval('#today-list .event', (els) =>
        els[els.length - 1].querySelector('.dur').textContent.trim()),
      '90 min');
    eq('only duration is persisted - type/room stay implicit from the original',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.custom.v1')).overrides),
      { [MON_PH3102]: { duration: 90 } });
    check('the class is flagged as edited', await page.$$eval('#today-list .event', (els) =>
      !!els[els.length - 1].querySelector('.edited-flag')));

    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('the manual duration survives a reload',
      await page.$$eval('#today-list .event', (els) =>
        els[els.length - 1].querySelector('.dur').textContent.trim()),
      '90 min');

    // Reopening the dialog must show the customised value, not the original.
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    eq('the edit dialog re-prefills the customised duration', await page.inputValue('#f-duration'), '90');

    // --- re-entering the original duration clears the override entirely
    await page.fill('#f-duration', '50');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });
    eq('restoring the original duration drops the override',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1')), null);

    // --- changing type still auto-fills the standard duration for that type
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.selectOption('#f-type', 'Lab');
    eq('picking a new type live-updates the duration field', await page.inputValue('#f-duration'), '160');
    await page.click('#edit-cancel');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    // --- but an explicit duration edit is never clobbered by a later type change
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-duration', '75');
    await page.selectOption('#f-type', 'Lab');
    eq('a manually-entered duration is not overwritten by a type change',
      await page.inputValue('#f-duration'), '75');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });
    eq('both the type and the explicit duration are persisted',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.custom.v1')).overrides),
      { [MON_PH3102]: { type: 'Lab', duration: 75 } });

    // restore for the checks that follow
    await openMenu(page, '#today-list', 2);
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.selectOption('#f-type', 'Theory');
    await page.fill('#f-duration', '50');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    // --- validation rejects nonsense without saving
    for (const bad of ['0', '-5', '4', '601', '']) {
      await openMenu(page, '#today-list', 2);
      await page.click('#event-edit');
      await page.waitForSelector('#edit-sheet:not([hidden])');
      await page.fill('#f-duration', bad);
      await page.click('#edit-save');
      await page.waitForTimeout(80);
      check(`duration "${bad}" is rejected`, await page.isVisible('#edit-sheet'));
      check(`duration "${bad}" shows an error`, await page.isVisible('#edit-error'));
      await page.click('#edit-cancel');
      await page.waitForSelector('#edit-sheet', { state: 'hidden' });
    }
    eq('no invalid duration was ever saved',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1')), null);
    await ctx.close();
  }

  // ============ 22. Duration edits reach current/next detection ============
  {
    // Shrink the running class: it should end, and stop being "current", at
    // its new, shorter length rather than the published 50 minutes.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });   // Mon 09:10, 15 min into 08:55 PH3104
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    await openMenu(page, '#today-list', 1);   // 08:55 PH3104 Theory G08
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-duration', '10');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    check('shrinking the running class ends it at its new, shorter length',
      !/Current class/.test(await page.textContent('#now-card')));
    await ctx.close();

    // Extend a class: it should still read as current well past where the
    // published 50-minute length would have ended it (08:55 + 50 = 09:45).
    const ctx2 = await browser.newContext(ctxOpts);
    const page2 = await newPage(ctx2, { clock: '2026-08-24T10:00:00' });   // Mon 10:00, 65 min into 08:55 PH3104
    await seed(page2, ['PH3104']);
    await page2.waitForSelector('#screen-app:not([hidden])');

    await openMenu(page2, '#today-list', 1);
    await page2.click('#event-edit');
    await page2.waitForSelector('#edit-sheet:not([hidden])');
    await page2.fill('#f-duration', '120');
    await page2.click('#edit-save');
    await page2.waitForSelector('#edit-sheet', { state: 'hidden' });

    const card = (await page2.textContent('#now-card')).replace(/\s+/g, ' ');
    check('extending a class keeps it current past its original 50-minute end',
      /Current class/.test(card));
    check('remaining time reflects the new, longer duration',
      /55 minutes remaining/.test(card), card.slice(0, 80));
    await ctx2.close();
  }

  // ============ 23. Malformed duration in stored overrides ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-24T09:10:00' });
    await page.goto(base);
    await page.evaluate((id) => {
      localStorage.setItem('iiserk.tt.courses.v1', JSON.stringify(['PH3104']));
      localStorage.setItem('iiserk.tt.custom.v1', JSON.stringify({
        version: 1,
        overrides: {
          [id]: { room: 'G09', duration: '90' },   // string, not a number
        },
        removed: [],
      }));
    }, MON_TUT);
    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('a non-numeric stored duration is dropped, sibling fields survive',
      await page.$$eval('#today-list .event', (els) => [
        els[0].querySelector('.dur').textContent.trim(),
        els[0].querySelector('.room span').textContent.trim(),
      ]), ['50 min', 'G09']);

    for (const bad of [1.5, 0, -10, 601, 100000]) {
      await page.evaluate((args) => {
        localStorage.setItem('iiserk.tt.custom.v1', JSON.stringify({
          version: 1, overrides: { [args.id]: { duration: args.bad } }, removed: [],
        }));
      }, { id: MON_TUT, bad });
      await page.reload();
      await page.waitForSelector('#screen-app:not([hidden])');
      eq(`out-of-range/non-integer stored duration ${bad} is dropped`,
        await page.$$eval('#today-list .event', (els) => els[0].querySelector('.dur').textContent.trim()),
        '50 min');
    }
    await ctx.close();
  }

  // ============ 24. Holiday lookup: pure-function checks ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx);
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    const HOLIDAYS = [
      ['2026-08-15', 'Independence Day'],
      ['2026-08-26', 'Milad un-Nabi'],
      ['2026-10-02', 'Mahatma Gandhi Jayanti'],
      ['2026-10-19', 'Additional day for Dussehra'],
      ['2026-10-20', 'Dussehra'],
      ['2026-11-08', 'Diwali'],
      ['2026-11-24', 'Guru Nanak Jayanti'],
      ['2026-12-25', 'Christmas'],
    ];

    eq('the holiday dataset loaded exactly the 8 documented holidays',
      await page.evaluate(() => window.__tt.holidays.length), 8);
    eq('the holiday dataset is a separate global, not merged into TIMETABLE_DATA',
      await page.evaluate(() => 'holidays' in window.TIMETABLE_DATA), false);

    const lookupResults = await page.evaluate((list) => {
      const t = window.__tt;
      return list.map(([date, name]) => {
        const [y, m, d] = date.split('-').map(Number);
        const on = t.holidayOn(new Date(y, m - 1, d));
        const before = t.holidayOn(new Date(y, m - 1, d - 1));
        const after = t.holidayOn(new Date(y, m - 1, d + 1));
        return [on && on.name, before, after];
      });
    }, HOLIDAYS);
    HOLIDAYS.forEach(([date, name], i) => {
      eq(`holidayOn() correctly identifies ${date} as "${name}"`, lookupResults[i][0], name);
    });
    // Day-before and day-after are only "not a holiday" for isolated dates -
    // Oct 19/20 are back-to-back, so their neighbours are checked separately.
    [0, 1, 2, 5, 6, 7].forEach((i) => {
      eq(`the day before ${HOLIDAYS[i][0]} is not a holiday`, lookupResults[i][1], null);
      eq(`the day after ${HOLIDAYS[i][0]} is not a holiday`, lookupResults[i][2], null);
    });
    eq('the day before the Dussehra pair (18 Oct) is not a holiday', lookupResults[3][1], null);
    eq('19 Oct correctly sees 20 Oct (the next day) as a holiday too',
      await page.evaluate(() => {
        const h = window.__tt.holidayOn(new Date(2026, 9, 20));
        return h && h.name;
      }), 'Dussehra');
    eq('the day after the Dussehra pair (21 Oct) is not a holiday', lookupResults[4][2], null);

    // Year boundary: same month/day, a year outside the loaded dataset.
    eq('15 August 2027 (outside the loaded dataset) is not a holiday',
      await page.evaluate(() => window.__tt.holidayOn(new Date(2027, 7, 15))), null);
    eq('15 August 2025 (outside the loaded dataset) is not a holiday',
      await page.evaluate(() => window.__tt.holidayOn(new Date(2025, 7, 15))), null);
    eq('an ordinary date is not a holiday', await page.evaluate(() =>
      window.__tt.holidayOn(new Date(2026, 7, 20))), null);

    eq('localDateKey() uses local calendar fields, e.g. "2026-08-15"',
      await page.evaluate(() => window.__tt.localDateKey(new Date(2026, 7, 15))), '2026-08-15');
    await ctx.close();
  }

  // ============ 25. Holiday Today, end to end ============
  {
    // A weekday holiday that would otherwise have real scheduled classes:
    // the holiday state must win, not the timetable.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-26T10:00:00' });   // Wed - Milad un-Nabi
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('exactly one card renders, the holiday card', await page.locator('.now-card').count(), 1);
    check('it is marked as a holiday card', await page.locator('.now-card.holiday').count() === 1);
    eq('the label reads "Holiday today"',
      (await page.locator('.now-card .now-label').textContent()).trim(), 'Holiday today');
    eq('the holiday name is shown', (await page.locator('.holiday-name').textContent()).trim(), 'Milad un-Nabi');
    eq('the description says no regular classes',
      (await page.locator('.now-card .now-empty').textContent()).trim(), 'No regular classes today.');
    check('no misleading "Current class" or "Next" label appears',
      !/Current class|^Next$/.test(await page.textContent('#now-card')));

    eq('the TODAY section shows a holiday empty state, not the real Wednesday classes',
      await page.locator('#today-list .event').count(), 0);
    check('the empty state names the holiday',
      /Milad un-Nabi/.test(await page.textContent('#today-list')));
    eq('the day header shows the weekday, not a class count',
      (await page.textContent('#today-head')).trim(), 'Wednesday');
    await ctx.close();
  }

  // ============ 26. Holiday on a weekend takes precedence over "it's the weekend" ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-15T10:00:00' });   // Saturday - Independence Day
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('a weekend holiday still shows "Holiday today", not "it\'s the weekend"',
      (await page.locator('.now-card .now-label').textContent()).trim(), 'Holiday today');
    eq('the holiday name is shown', (await page.locator('.holiday-name').textContent()).trim(), 'Independence Day');
    check('the generic weekend message is not shown',
      !/weekend/i.test(await page.textContent('#today-list')));
    eq('the day header shows the real weekday',
      (await page.textContent('#today-head')).trim(), 'Saturday');
    await ctx.close();

    // A genuinely ordinary weekend, nowhere near a holiday, is unaffected.
    const ctx2 = await browser.newContext(ctxOpts);
    const page2 = await newPage(ctx2, { clock: '2026-08-29T10:00:00' });   // an ordinary Saturday
    await seed(page2, ['PH3104']);
    await page2.waitForSelector('#screen-app:not([hidden])');
    eq('an ordinary weekend still shows the normal weekend message',
      (await page2.textContent('#today-list')).includes('weekend'), true);
    eq('no holiday card appears on an ordinary weekend', await page2.locator('.now-card.holiday').count(), 0);
    await ctx2.close();
  }

  // ============ 27. Consecutive holidays (19 + 20 October), now inside Autumn Break ============
  {
    // Both Dussehra dates fall inside Autumn Break (17-25 Oct), which must
    // take priority: the UI shows "Autumn Break" on both days, not the
    // individual holiday names - a break is the coarser, more encompassing
    // state (see the precedence comment in renderToday()). The underlying
    // single-day holiday data is untouched and still correct - proven
    // directly via holidayOn() in section 24 - this only confirms the UI's
    // resolved precedence.
    for (const iso of ['2026-10-19T10:00:00', '2026-10-20T10:00:00']) {
      const ctx = await browser.newContext(ctxOpts);
      const page = await newPage(ctx, { clock: iso });
      await seed(page, ['PH3104']);
      await page.waitForSelector('#screen-app:not([hidden])');
      eq(`${iso.slice(0, 10)} shows "Autumn Break", not the subsumed Dussehra holiday name`,
        (await page.locator('.holiday-name').textContent()).trim(), 'Autumn Break');
      eq('the label reads "On break"',
        (await page.locator('.now-card .now-label').textContent()).trim(), 'On break');
      eq('only one card renders (no duplicate break/holiday notice)',
        await page.locator('.now-card.holiday').count(), 1);
      await ctx.close();
    }
  }

  // ============ 28. Holiday Tomorrow, end to end ============
  {
    // A weekday with real classes, followed by a weekday holiday: today's
    // classes must stay fully visible alongside the compact notice.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-14T10:00:00' });   // Fri, before Sat 15 Aug
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    const cards = page.locator('.now-card');
    eq('two cards render: the holiday notice and the normal next-class card',
      await cards.count(), 2);
    eq('the holiday notice is first, per the recommended priority order',
      (await cards.nth(0).locator('.now-label').textContent()).trim(), 'Tomorrow is a holiday');
    check('the holiday notice is marked distinctly', await cards.nth(0).evaluate((el) => el.classList.contains('holiday')));
    eq('the holiday name is shown', (await cards.nth(0).locator('.holiday-name').textContent()).trim(), 'Independence Day');
    eq('the date is formatted exactly as specified: weekday, day month',
      (await cards.nth(0).locator('.now-empty').textContent()).trim(), 'Saturday, 15 August');
    eq('the normal next-class card still follows, unreplaced',
      (await cards.nth(1).locator('.now-label').textContent()).trim(), 'Next class');

    eq('today\'s real classes remain fully visible in the TODAY section',
      await page.locator('#today-list .event').count(), 1);
    eq('the day header is unaffected', (await page.textContent('#today-head')).trim(), 'Friday · 1 class');
    await ctx.close();

    // A standalone holiday's tomorrow-notice date format, verbatim, using a
    // holiday NOT subsumed by any break (Diwali, 8 Nov) - the Dussehra pair
    // (19/20 Oct) is now inside Autumn Break and is covered in section 33.
    const ctx2 = await browser.newContext(ctxOpts);
    const page2 = await newPage(ctx2, { clock: '2026-11-07T10:00:00' });   // Sat, before Sun 8 Nov
    await seed(page2, ['PH3104']);
    await page2.waitForSelector('#screen-app:not([hidden])');
    eq('standalone-holiday tomorrow-notice date format matches the spec example',
      (await page2.locator('.now-card.holiday .now-empty').textContent()).trim(), 'Sunday, 8 November');
    eq('the holiday name is shown', (await page2.locator('.holiday-name').textContent()).trim(), 'Diwali');
    // A weekend day's own list is unaffected by the tomorrow notice above it.
    check('the weekend message still shows beneath the notice',
      /weekend/i.test(await page2.textContent('#today-list')));
    await ctx2.close();
  }

  // ============ 29. Holiday state does not touch Week view, data or customisations ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-26T10:00:00' });   // Wed - Milad un-Nabi
    await seed(page, ['PH3104', 'PH3102', 'MA3101']);   // MA3101 has a real Wednesday class
    await page.waitForSelector('#screen-app:not([hidden])');

    // Today's own list can't be used to make a customisation here: it is
    // showing the holiday empty state, with no event/menu to click. Week
    // view is unaffected by the holiday, so interact there instead - this
    // doubles as proof Week's own interactions work normally on this date.
    await page.click('.tab[data-view="week"]');
    await page.waitForSelector('#view-week:not([hidden])');
    check('Week view opens on today\'s real weekday even though it is a holiday',
      await page.getAttribute('#day-chips [data-day="Wednesday"]', 'aria-selected') === 'true');

    let weekRows = await page.$$eval('#week-list .event', (els) => els.map((el) => [
      el.querySelector('.time').textContent.trim(), el.querySelector('.code').textContent.trim(),
    ]));
    eq('Week view lists Wednesday\'s real class exactly as if there were no holiday',
      weekRows, [['10:45', 'MA3101']]);
    eq('no holiday banner, label or class is present anywhere in Week view',
      await page.locator('#view-week .holiday, #view-week .now-card').count(), 0);
    check('the word "holiday" does not appear anywhere in Week view',
      !/holiday/i.test(await page.textContent('#view-week')));
    eq('day pill counts are the normal, unfiltered counts',
      await page.locator('#day-chips .chip').allTextContents(),
      ['Mon3', 'Tue3', 'Wed1', 'Thu2', 'Fri3']);

    // Make a real customisation through Week view.
    await openMenu(page, '#week-list', 0);
    await page.click('#event-remove');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(120);
    const customBefore = await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1'));
    check('the removal was actually recorded for this check to be meaningful', !!customBefore);
    weekRows = await page.$$eval('#week-list .event', (els) => els.map((el) =>
      el.querySelector('.code').textContent.trim()));
    eq('the removal took effect normally in Week view on a holiday date', weekRows, []);

    // Switching back to Today must not be disturbed by that customisation.
    await page.click('.tab[data-view="today"]');
    eq('Today still shows the holiday state after a Week-view customisation',
      (await page.locator('.now-card .now-label').textContent()).trim(), 'Holiday today');
    eq('Today\'s holiday empty state is unaffected by the customisation',
      await page.locator('#today-list .event').count(), 0);

    eq('the published timetable is still exactly 482 events',
      await page.evaluate(() => window.TIMETABLE_DATA.events.length), 482);
    check('the published timetable has no "holidays" field of its own',
      await page.evaluate(() => !('holidays' in window.TIMETABLE_DATA)));
    eq('the course selection is untouched by holiday rendering',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.courses.v1')).sort()),
      ['MA3101', 'PH3102', 'PH3104']);

    // Reset Courses and Reset Timetable Changes still work normally on a
    // holiday date - holiday state is presentation-only and must not block
    // or alter either flow.
    await page.click('#open-settings');
    await page.waitForSelector('#settings-sheet:not([hidden])');
    check('"Reset timetable changes" is offered normally on a holiday date',
      await page.locator('#reset-changes-btn').isVisible());
    await page.click('#reset-changes-btn');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(120);
    eq('Reset timetable changes works normally on a holiday date',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1')), null);
    check('the holiday state itself is unaffected by resetting timetable changes',
      (await page.locator('.now-card .now-label').textContent()).trim() === 'Holiday today');

    await page.click('#open-settings');
    await page.click('#reset-btn');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForSelector('#screen-setup:not([hidden])');
    check('Reset courses works normally on a holiday date', await page.isVisible('#screen-setup'));
    await ctx.close();
  }

  // ============ 30. Holiday card across themes ============
  {
    const ctx = await browser.newContext({ ...ctxOpts, colorScheme: 'light' });
    const page = await newPage(ctx, { clock: '2026-08-26T10:00:00' });
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    const lightBorder = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.now-card.holiday')).borderColor);
    const lightText = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.holiday-name')).color);

    await page.click('#open-settings');
    await page.click('#theme-seg [data-theme="dark"]');
    await page.waitForTimeout(80);
    const darkBorder = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.now-card.holiday')).borderColor);
    const darkText = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.holiday-name')).color);

    check('the holiday card is visibly styled in light mode', lightBorder !== 'rgba(0, 0, 0, 0)');
    check('the holiday card border changes between light and dark', lightBorder !== darkBorder);
    check('holiday text is legible (colour set) in both themes', !!lightText && !!darkText);

    await page.click('#theme-seg [data-theme="auto"]');
    await page.waitForTimeout(80);
    check('Auto mode still renders the holiday card',
      await page.locator('.now-card.holiday').isVisible());
    await ctx.close();
  }

  // ============ 31. Offline cold launch on a holiday ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-08-26T10:00:00' });   // Wed - Milad un-Nabi
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      if (!keys.length) return false;
      const c = await caches.open(keys[0]);
      return (await c.keys()).length >= 10;   // now includes data/holidays.js
    }, null, { timeout: 15000 });

    const cachedHolidays = await page.evaluate(async () => {
      const c = await caches.open((await caches.keys())[0]);
      return (await c.keys()).some((r) => new URL(r.url).pathname.endsWith('data/holidays.js'));
    });
    check('the holiday dataset is precached for offline use', cachedHolidays);

    await page.fill('#search', 'PH3104');
    await page.waitForTimeout(50);
    await page.click('.course-row[data-code="PH3104"]');
    await page.click('#continue-btn');
    await page.waitForSelector('#screen-app:not([hidden])');

    await ctx.setOffline(true);
    const cold = await newPage(ctx, { clock: '2026-08-26T10:00:00' });
    await cold.goto(base);
    await cold.waitForSelector('#screen-app:not([hidden])', { timeout: 15000 });

    check('the app cold-starts offline on a holiday date', await cold.isVisible('#screen-app'));
    eq('the holiday state renders correctly with no network',
      (await cold.locator('.now-card .now-label').textContent()).trim(), 'Holiday today');
    eq('the holiday name renders offline', (await cold.locator('.holiday-name').textContent()).trim(), 'Milad un-Nabi');
    eq('offline holiday lookup still finds all 8 entries',
      await cold.evaluate(() => window.__tt.holidays.length), 8);
    await ctx.setOffline(false);
    await ctx.close();
  }

  // ============ 32. Local date, not UTC (Indian timezone) ============
  {
    // A local instant just after midnight IST on Independence Day, where the
    // UTC calendar date is still the 14th. Code that used toISOString() or
    // getUTC*() instead of local getters would misdetect this as "not yet a
    // holiday" (or "tomorrow"), exactly the bug the feature spec warns about.
    const ctx = await browser.newContext({ ...ctxOpts, timezoneId: 'Asia/Kolkata' });
    const page = await newPage(ctx, { clock: '2026-08-15T00:15:00' });
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');
    eq('00:15 local IST on 15 Aug reads as Holiday Today, using the LOCAL date',
      (await page.locator('.now-card .now-label').textContent()).trim(), 'Holiday today');
    await ctx.close();

    // The mirror instant, 30 minutes earlier local time: still 14 Aug locally,
    // so it must be "tomorrow is a holiday", not yet "holiday today".
    const ctx2 = await browser.newContext({ ...ctxOpts, timezoneId: 'Asia/Kolkata' });
    const page2 = await newPage(ctx2, { clock: '2026-08-14T23:45:00' });
    await seed(page2, ['PH3104']);
    await page2.waitForSelector('#screen-app:not([hidden])');
    eq('23:45 local IST on 14 Aug is still "tomorrow is a holiday"',
      (await page2.locator('.now-card .now-label').first().textContent()).trim(), 'Tomorrow is a holiday');
    await ctx2.close();
  }

  // ============ 33. Academic breaks: pure-function checks ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx);
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    eq('the break dataset loaded exactly the 3 documented breaks',
      await page.evaluate(() => window.__tt.breaks.length), 3);
    eq('the break dataset is a separate global, not merged into TIMETABLE_DATA',
      await page.evaluate(() => 'breaks' in window.TIMETABLE_DATA), false);

    const BREAKS = [
      // [name, [y,m,d] before, [y,m,d] first, [y,m,d] middle, [y,m,d] last, [y,m,d] after]
      ['Autumn Break', [2026, 10, 16], [2026, 10, 17], [2026, 10, 21], [2026, 10, 25], [2026, 10, 26]],
      ['Winter Vacation', [2026, 12, 12], [2026, 12, 13], [2026, 12, 25], [2027, 1, 3], [2027, 1, 4]],
    ];
    const results = await page.evaluate((list) => {
      const t = window.__tt;
      return list.map(([name, before, first, middle, last, after]) => {
        const on = (a) => { const b = t.breakOn(new Date(a[0], a[1] - 1, a[2])); return b && b.name; };
        return [on(before), on(first), on(middle), on(last), on(after)];
      });
    }, BREAKS);
    BREAKS.forEach(([name], i) => {
      eq(`the day before ${name} is not in the break`, results[i][0], null);
      eq(`the first day of ${name} is correctly identified`, results[i][1], name);
      eq(`a middle day of ${name} is correctly identified`, results[i][2], name);
      eq(`the last day of ${name} is correctly identified`, results[i][3], name);
      eq(`the day after ${name} is not in the break`, results[i][4], null);
    });

    // Winter Vacation subsumes Christmas: breakOn() finds the break, while
    // holidayOn() (unmodified) still separately and correctly finds Christmas
    // - the underlying holiday data is intact, only the UI's resolved
    // precedence (tested end to end below) prefers the break.
    eq('breakOn(25 Dec) finds Winter Vacation',
      await page.evaluate(() => { const b = window.__tt.breakOn(new Date(2026, 11, 25)); return b && b.name; }),
      'Winter Vacation');
    eq('holidayOn(25 Dec) still separately finds Christmas, unaffected by breaks',
      await page.evaluate(() => { const h = window.__tt.holidayOn(new Date(2026, 11, 25)); return h && h.name; }),
      'Christmas');

    // Year boundary robustness, exactly mirroring the single-day holiday
    // dataset's convention: a date outside the loaded range is never a break.
    eq('17 October 2027 (outside the loaded range) is not a break',
      await page.evaluate(() => window.__tt.breakOn(new Date(2027, 9, 17))), null);
    eq('13 December 2025 (outside the loaded range) is not a break',
      await page.evaluate(() => window.__tt.breakOn(new Date(2025, 11, 13))), null);
    eq('an ordinary date is not in any break',
      await page.evaluate(() => window.__tt.breakOn(new Date(2026, 10, 15))), null);
    await ctx.close();
  }

  // ============ 34. Break Today, end to end (first / middle / last day) ============
  {
    const cases = [
      ['2026-10-17T10:00:00', 'Autumn Break', 'first day, a Saturday - overrides the weekend message',
        'No regular classes. Classes resume Monday, 26 October.'],
      ['2026-10-21T10:00:00', 'Autumn Break', 'a middle weekday with real classes normally scheduled',
        'No regular classes. Classes resume Monday, 26 October.'],
      ['2026-10-25T10:00:00', 'Autumn Break', 'last day, a Sunday - resume phrase says "tomorrow"',
        'No regular classes. Classes resume tomorrow.'],
      ['2026-12-13T10:00:00', 'Winter Vacation', 'first day, a Sunday - overrides the weekend message',
        'No regular classes. Classes resume Monday, 4 January.'],
      ['2026-12-25T10:00:00', 'Winter Vacation', 'a middle day that is also Christmas - break wins',
        'No regular classes. Classes resume Monday, 4 January.'],
      ['2027-01-03T10:00:00', 'Winter Vacation', 'last day - resume phrase says "tomorrow"',
        'No regular classes. Classes resume tomorrow.'],
    ];
    for (const [iso, name, label, desc] of cases) {
      const ctx = await browser.newContext(ctxOpts);
      const page = await newPage(ctx, { clock: iso });
      await seed(page, ['PH3104', 'MA3101']);
      await page.waitForSelector('#screen-app:not([hidden])');

      eq(`[${name} - ${label}] exactly one card renders`, await page.locator('.now-card').count(), 1);
      eq(`[${name} - ${label}] label reads "On break"`,
        (await page.locator('.now-card .now-label').textContent()).trim(), 'On break');
      eq(`[${name} - ${label}] break name is shown`,
        (await page.locator('.holiday-name').textContent()).trim(), name);
      eq(`[${name} - ${label}] resume-date phrasing is correct`,
        (await page.locator('.now-card .now-empty').textContent()).trim(), desc);
      check(`[${name} - ${label}] no misleading Current/Next class label`,
        !/Current class|^Next$/.test(await page.textContent('#now-card')));

      eq(`[${name} - ${label}] TODAY section shows a break empty state, not real classes`,
        await page.locator('#today-list .event').count(), 0);
      check(`[${name} - ${label}] the empty state names the break`,
        (await page.textContent('#today-list')).includes(name));
      await ctx.close();
    }
  }

  // ============ 35. Break Starts Tomorrow, end to end ============
  {
    // Autumn Break's day-before (16 Oct) is a Friday with a real PH3104
    // class: today's real classes must stay fully visible under the notice.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-10-16T15:00:00' });
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    const cards = page.locator('.now-card');
    check('the break notice is marked distinctly',
      await cards.nth(0).evaluate((el) => el.classList.contains('holiday')));
    eq('label reads "Break starts tomorrow"',
      (await cards.nth(0).locator('.now-label').textContent()).trim(), 'Break starts tomorrow');
    eq('break name is shown', (await cards.nth(0).locator('.holiday-name').textContent()).trim(), 'Autumn Break');
    eq('the date range is formatted "D Month – D Month", no year',
      (await cards.nth(0).locator('.now-empty').textContent()).trim(), '17 October – 25 October');
    eq('the normal next-class card still follows, unreplaced',
      (await cards.nth(1).locator('.now-label').textContent()).trim(), 'Next class');

    eq('today\'s real Friday class remains fully visible', await page.locator('#today-list .event').count(), 1);
    eq('the day header shows the real weekday', (await page.textContent('#today-head')).trim(), 'Friday · 1 class');
    await ctx.close();

    // Winter Vacation's day-before (12 Dec) is a Saturday: PH3104 has no
    // Saturday classes at all (Saturday isn't even a teaching day), so the
    // existing weekend message must still show beneath the notice, exactly
    // as the equivalent holiday-tomorrow-on-a-weekend case already does.
    const ctx2 = await browser.newContext(ctxOpts);
    const page2 = await newPage(ctx2, { clock: '2026-12-12T10:00:00' });
    await seed(page2, ['PH3104']);
    await page2.waitForSelector('#screen-app:not([hidden])');
    eq('label reads "Break starts tomorrow" on the weekend day before too',
      (await page2.locator('.now-card.holiday .now-label').textContent()).trim(), 'Break starts tomorrow');
    eq('break name is shown', (await page2.locator('.holiday-name').textContent()).trim(), 'Winter Vacation');
    eq('the date range correctly spans the year boundary with no year shown',
      (await page2.locator('.now-card.holiday .now-empty').textContent()).trim(), '13 December – 3 January');
    check('the weekend message still shows beneath the notice',
      /weekend/i.test(await page2.textContent('#today-list')));
    await ctx2.close();
  }

  // ============ 36. Next Class logic skips days inside a break ============
  {
    // Isolated case: CS2102 meets only Monday 15:20 and Wednesday 13:30.
    // From Thursday 15 Oct, the unmodified computeNow() would find "next" on
    // Monday 19 Oct (inside Autumn Break, offset 4) - the break-aware
    // version must skip both the 19th AND the 21st (also inside the break)
    // and land on Monday 26 Oct (offset 11), with no "starts tomorrow"
    // notice in play to confound the result.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-10-15T10:00:00' });
    await seed(page, ['CS2102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    const cmp = await page.evaluate(() => {
      const t = window.__tt;
      const sel = new Set(['CS2102']);
      const now = new Date();
      const raw = t.computeNow(sel, now);
      const aware = t.computeNextSkippingBreaks(sel, now);
      return {
        rawOffset: raw.nextOffset, rawDay: raw.next[0] && raw.next[0].day,
        awareOffset: aware.nextOffset, awareDay: aware.next[0] && aware.next[0].day,
      };
    });
    eq('sanity check: the unmodified computeNow() would land inside the break',
      cmp.rawOffset, 4);
    eq('the break-aware scan skips past the break entirely',
      cmp.awareOffset, 11);
    eq('both point at a Monday (the label alone can\'t disambiguate the date - '
      + 'this is why the offset assertions above matter)', [cmp.rawDay, cmp.awareDay], ['Monday', 'Monday']);

    check('computeNow() itself is completely unmodified by the break feature (Week view depends on it)',
      cmp.rawOffset === 4);
    eq('the rendered card uses the break-aware result, not the raw one',
      (await page.locator('.now-card .now-label').textContent()).trim(), 'Next class');
    await ctx.close();

    // Combined case: the day immediately before Autumn Break starts, where
    // the "starts tomorrow" notice AND the Next-card skip fire together.
    const ctx2 = await browser.newContext(ctxOpts);
    const page2 = await newPage(ctx2, { clock: '2026-10-16T15:00:00' });   // after PH3104's own 10:45 Fri class
    await seed(page2, ['PH3104']);
    await page2.waitForSelector('#screen-app:not([hidden])');
    const cmp2 = await page2.evaluate(() => {
      const t = window.__tt;
      const sel = new Set(['PH3104']);
      const now = new Date();
      return { raw: t.computeNow(sel, now).nextOffset, aware: t.computeNextSkippingBreaks(sel, now).nextOffset };
    });
    eq('sanity check: raw would land on Monday 19 Oct, inside the break', cmp2.raw, 3);
    eq('the Next card skips past the break to Monday 26 Oct instead', cmp2.aware, 10);
    eq('the rendered Next card is present alongside the starts-tomorrow notice',
      (await page2.locator('.now-card').nth(1).locator('.now-label').textContent()).trim(), 'Next class');
    await ctx2.close();
  }

  // ============ 37. Break state does not touch Week view, data or customisations ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-10-21T10:00:00' });   // Wed, middle of Autumn Break
    await seed(page, ['PH3104', 'PH3102', 'MA3101']);   // MA3101 has a real Wednesday class
    await page.waitForSelector('#screen-app:not([hidden])');

    await page.click('.tab[data-view="week"]');
    await page.waitForSelector('#view-week:not([hidden])');
    check('Week view opens on today\'s real weekday even though it is inside a break',
      await page.getAttribute('#day-chips [data-day="Wednesday"]', 'aria-selected') === 'true');

    let weekRows = await page.$$eval('#week-list .event', (els) => els.map((el) => [
      el.querySelector('.time').textContent.trim(), el.querySelector('.code').textContent.trim(),
    ]));
    eq('Week view lists Wednesday\'s real class exactly as if there were no break',
      weekRows, [['10:45', 'MA3101']]);
    eq('no break/holiday banner or card is present anywhere in Week view',
      await page.locator('#view-week .holiday, #view-week .now-card').count(), 0);
    check('neither "break" nor "holiday" appears anywhere in Week view',
      !/break|holiday/i.test(await page.textContent('#view-week')));
    eq('day pill counts are the normal, unfiltered counts',
      await page.locator('#day-chips .chip').allTextContents(),
      ['Mon3', 'Tue3', 'Wed1', 'Thu2', 'Fri3']);

    // Make a real customisation through Week view (Today's own list has no
    // events/menus to click while it is showing the break empty state).
    await openMenu(page, '#week-list', 0);
    await page.click('#event-remove');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(120);
    const customBefore = await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1'));
    check('the removal was actually recorded for this check to be meaningful', !!customBefore);
    weekRows = await page.$$eval('#week-list .event', (els) => els.map((el) =>
      el.querySelector('.code').textContent.trim()));
    eq('the removal took effect normally in Week view during a break', weekRows, []);

    await page.click('.tab[data-view="today"]');
    eq('Today still shows the break state after a Week-view customisation',
      (await page.locator('.now-card .now-label').textContent()).trim(), 'On break');
    eq('the published timetable is still exactly 482 events',
      await page.evaluate(() => window.TIMETABLE_DATA.events.length), 482);
    eq('the course selection is untouched by break rendering',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.courses.v1')).sort()),
      ['MA3101', 'PH3102', 'PH3104']);

    // Reset Courses and Reset Timetable Changes still work normally during a
    // break - the break state is presentation-only and must not block or
    // alter either flow.
    await page.click('#open-settings');
    await page.waitForSelector('#settings-sheet:not([hidden])');
    await page.click('#reset-changes-btn');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForTimeout(120);
    eq('Reset timetable changes works normally during a break',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.custom.v1')), null);
    check('the break state itself is unaffected by resetting timetable changes',
      (await page.locator('.now-card .now-label').textContent()).trim() === 'On break');

    await page.click('#open-settings');
    await page.click('#reset-btn');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForSelector('#screen-setup:not([hidden])');
    check('Reset courses works normally during a break', await page.isVisible('#screen-setup'));
    await ctx.close();
  }

  // ============ 38. Break card across themes ============
  {
    const ctx = await browser.newContext({ ...ctxOpts, colorScheme: 'light' });
    const page = await newPage(ctx, { clock: '2026-10-21T10:00:00' });
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    const lightBorder = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.now-card.holiday')).borderColor);

    await page.click('#open-settings');
    await page.click('#theme-seg [data-theme="dark"]');
    await page.waitForTimeout(80);
    const darkBorder = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.now-card.holiday')).borderColor);

    check('the break card is visibly styled in light mode', lightBorder !== 'rgba(0, 0, 0, 0)');
    check('the break card border changes between light and dark', lightBorder !== darkBorder);

    await page.click('#theme-seg [data-theme="auto"]');
    await page.waitForTimeout(80);
    check('Auto mode still renders the break card',
      await page.locator('.now-card.holiday').isVisible());
    await ctx.close();
  }

  // ============ 39. Offline cold launch during a break ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-10-21T10:00:00' });   // Wed, middle of Autumn Break
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      if (!keys.length) return false;
      const c = await caches.open(keys[0]);
      return (await c.keys()).length >= 10;
    }, null, { timeout: 15000 });

    await page.fill('#search', 'PH3104');
    await page.waitForTimeout(50);
    await page.click('.course-row[data-code="PH3104"]');
    await page.click('#continue-btn');
    await page.waitForSelector('#screen-app:not([hidden])');

    await ctx.setOffline(true);
    const cold = await newPage(ctx, { clock: '2026-10-21T10:00:00' });
    await cold.goto(base);
    await cold.waitForSelector('#screen-app:not([hidden])', { timeout: 15000 });

    check('the app cold-starts offline during a break', await cold.isVisible('#screen-app'));
    eq('the break state renders correctly with no network',
      (await cold.locator('.now-card .now-label').textContent()).trim(), 'On break');
    eq('the break name renders offline', (await cold.locator('.holiday-name').textContent()).trim(), 'Autumn Break');
    eq('offline break lookup still finds all 3 configured breaks',
      await cold.evaluate(() => window.__tt.breaks.length), 3);
    eq('the offline Next-class scan still correctly skips break days',
      await cold.evaluate(() => {
        const t = window.__tt;
        return t.computeNextSkippingBreaks(new Set(['PH3104']), new Date()).nextOffset;
      }), 5);   // Wed 21 Oct -> Mon 26 Oct is 5 days
    await ctx.setOffline(false);
    await ctx.close();
  }

  // ============ 40. Mid-Sem data: bundled, separate, pure-function checks ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx);
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    eq('the Mid-Sem dataset loaded all 94 documented exams',
      await page.evaluate(() => window.__tt.midsem.exams.length), 94);
    eq('the Mid-Sem dataset is a separate global, not merged into TIMETABLE_DATA',
      await page.evaluate(() => 'exams' in window.TIMETABLE_DATA || 'midsem' in window.TIMETABLE_DATA), false);
    eq('the published timetable event count is unaffected by the Mid-Sem feature',
      await page.evaluate(() => window.TIMETABLE_DATA.events.length), 482);

    eq('a multi-venue course merges every allocated room with its roll-number range, in source order',
      await page.evaluate(() => window.__tt.midsem.exams.find((e) => e.course === 'CS2102')),
      { id: 'midsem-cs2102', course: 'CS2102', date: '2026-09-12', time: '10:00',
        minutes: 600, duration: 90, shift: 1,
        venue: 'G02 (24MS001 to 24MS158, 22MS213, 23MS013 to 23MS256); ' +
               'G08 (24MS167 to 24MS249, 25MS020 to 25MS225)' });

    check('Mid-Sem source data is frozen against writes', await page.evaluate(() => {
      const e = window.__tt.midsem.exams[0];
      const before = e.venue;
      try { e.venue = 'HACKED'; } catch (err) { /* strict mode throws */ }
      return e.venue === before;
    }));

    eq('every Mid-Sem course has a matching course in the catalog',
      await page.evaluate(() => window.__tt.midsem.exams.every((e) =>
        window.TIMETABLE_DATA.courses.some((c) => c.code === e.course))), true);
    await ctx.close();
  }

  // ============ 41. Mid-Sem card is absent when no selected course has an exam ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-01T08:00:00' });
    await seed(page, ['CS2103']);   // documented as having no Mid-Sem exam
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('no Mid-Sem card renders for a course with no Mid-Sem exam',
      (await page.textContent('#midsem-card')).trim(), '');
    await ctx.close();
  }

  // ============ 42. Mid-Sem card: next exam + full schedule in chronological order ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-06T08:00:00' });   // Sunday, day before CH2102's exam
    await seed(page, ['LS2103', 'CH2102', 'CS2102', 'CH2104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('the Mid-Sem card shows the next upcoming exam, not a more distant one',
      (await page.locator('#midsem-card .now-code').textContent()).trim(), 'CH2102');
    eq('the card labels it "Next Mid-Sem exam"',
      (await page.locator('#midsem-card .now-label').textContent()).trim(), 'Next Mid-Sem exam');
    const nextWhere = await page.locator('#midsem-card .now-where').textContent();
    check('the venue shown includes every allocated room, with its roll-number range',
      nextWhere.includes('G05 (25MS002 to 25MS110, Reenrollment)') &&
      nextWhere.includes('G02 (25MS111 to 25MS229)') && nextWhere.includes('G08 (25MS230 to 25MS328)'));
    eq('the date label reads "Tomorrow"',
      (await page.locator('#midsem-card .now-remain').textContent()).trim(), 'Tomorrow · 10:00');
    eq('the card is not styled as a current exam', await page.locator('#midsem-card .midsem-card.live').count(), 0);

    // --- full schedule: exactly the selected courses' exams, chronologically
    await page.click('[data-action="midsem-full"]');
    await page.waitForSelector('#midsem-sheet:not([hidden])');
    eq('the full schedule lists the selected courses\' exams in chronological order',
      await midsemRows(page), [
        ['10:00', 'LS2103', 'G05 (25MS001 to 25MS113, Reenrollment); G02 (25MS114 to 25MS213); G08 (25MS214 to 25MS328)', false],
        ['10:00', 'CH2102', 'G05 (25MS002 to 25MS110, Reenrollment); G02 (25MS111 to 25MS229); G08 (25MS230 to 25MS328)', false],
        ['10:00', 'CS2102', 'G02 (24MS001 to 24MS158, 22MS213, 23MS013 to 23MS256); G08 (24MS167 to 24MS249, 25MS020 to 25MS225)', false],
        ['15:00', 'CH2104', 'G05 (25MS002 to 25MS110, Reenrollment); G02 (25MS111 to 25MS229); G08 (25MS230 to 25MS328)', false],
      ]);
    eq('the sub-header counts the exams',
      (await page.textContent('#midsem-sheet-sub')).trim(), '4 exams for your selected courses, in order');

    await page.click('#midsem-close');
    await page.waitForSelector('#midsem-sheet', { state: 'hidden' });
    await ctx.close();
  }

  // ============ 43. Mid-Sem card: a current exam ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-07T10:30:00' });   // Monday, mid-exam
    await seed(page, ['CH2102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('exactly one Mid-Sem card renders, marked live',
      await page.locator('#midsem-card .midsem-card.live').count(), 1);
    eq('the label reads "Mid-Sem exam now"',
      (await page.locator('#midsem-card .now-label').textContent()).trim(), 'Mid-Sem exam now');
    eq('the course code is shown',
      (await page.locator('#midsem-card .now-code').textContent()).trim(), 'CH2102');
    const courseName = await page.evaluate(() =>
      window.TIMETABLE_DATA.courses.find((c) => c.code === 'CH2102').name);
    eq('the course name is shown', (await page.locator('#midsem-card .now-name').textContent()).trim(), courseName);
    const nowWhere = await page.locator('#midsem-card .now-where').textContent();
    check('venue (with roll ranges) and time are both shown',
      nowWhere.includes('G05 (25MS002 to 25MS110, Reenrollment)') && nowWhere.includes('10:00'));

    await page.click('[data-action="midsem-full"]');
    await page.waitForSelector('#midsem-sheet:not([hidden])');
    eq('the exam row in the full schedule is marked "Now"',
      (await page.textContent('#midsem-list .event.is-now .badge')).trim(), 'Now');
    await ctx.close();
  }

  // ============ 44. Mid-Sem card: multiple concurrent current exams ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-05T10:15:00' });   // Saturday, both mid-exam
    await seed(page, ['LS2103', 'MA3104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    const labelText = await page.locator('#midsem-card .now-label').textContent();
    check('the label mentions concurrent exams and the count',
      /Mid-Sem exams now/.test(labelText) && /2 at once/.test(labelText));
    eq('two compact exam rows are shown', await page.locator('#midsem-card .now-row').count(), 2);
    const rowCodes = (await page.locator('#midsem-card .now-row-code').allTextContents()).sort();
    eq('both concurrent courses are listed', rowCodes, ['LS2103', 'MA3104']);
    await ctx.close();
  }

  // ============ 45. Regular classes are suppressed during an active Mid-Sem exam ============
  {
    // CH2102's published exam (7 Sept) now falls inside the "Mid-Sem
    // Examinations" break (5-13 Sept, see section 50), which already clears
    // Today outright - too coarse a day to isolate THIS finer-grained,
    // interval-overlap suppression from. So the exam is moved, via the
    // override layer, to 21 Sept (still a Monday, still outside any break)
    // at its published 10:00-11:30 time - proving suppression follows the
    // user's edited exam date/time, exactly as required, and still exercises
    // the same boundary cases: 08:55 ends before the exam starts (kept),
    // 09:50 ends after it starts (suppressed), 10:45 is fully inside
    // (suppressed), 11:40 starts exactly when the exam ends (kept) - and the
    // suppressed classes belong to OTHER courses entirely, proving this is a
    // real time-interval overlap, not a course-code match.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-21T09:00:00' });
    await page.goto(base);
    await page.evaluate(() => {
      localStorage.setItem('iiserk.tt.courses.v1',
        JSON.stringify(['PH3104', 'PH3102', 'CH4104', 'PH4104', 'CH2102']));
      localStorage.setItem('iiserk.tt.midsem.v1',
        JSON.stringify({ version: 1, overrides: { 'midsem-ch2102': { date: '2026-09-21' } } }));
    });
    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');

    // CH2102's own Monday 16:15 class is NOT suppressed here: unlike section
    // 49 (where both courses' exams share the original 7 Sept date), only
    // CH2102's exam was moved to 21 Sept - PH3102's exam stays on its
    // published 7 Sept, so its 15:00-16:30 interval is not active today.
    eq('classes overlapping the active exam are suppressed; others are not',
      await listRows(page, '#today-list'),
      [['08:00', 'PH3104', 'Tutorial', 'G08', false],
       ['08:55', 'PH3104', 'Theory', 'G08', false],
       ['11:40', 'PH4104', 'Theory', '102', false],
       ['16:15', 'CH2102', 'Theory', 'S N Bose Lecture Theatre', false]]);

    // --- Week view must be completely unaffected: same Monday, full list.
    await page.click('.tab[data-view="week"]');
    await page.waitForSelector('#view-week:not([hidden])');
    eq('Week view shows every Monday class, including the ones suppressed on Today',
      await listRows(page, '#week-list'),
      [['08:00', 'PH3104', 'Tutorial', 'G08', false],
       ['08:55', 'PH3104', 'Theory', 'G08', false],
       ['09:50', 'PH3102', 'Theory', 'G02', false],
       ['10:45', 'CH4104', 'Theory', '110', false],
       ['11:40', 'PH4104', 'Theory', '102', false],
       ['16:15', 'CH2102', 'Theory', 'S N Bose Lecture Theatre', false]]);
    await ctx.close();
  }

  // ============ 46. Editing a Mid-Sem exam: persistence, sparse override, read-only course ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-01T08:00:00' });   // well before any exam
    await seed(page, ['CS2102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    await page.click('[data-action="midsem-full"]');
    await page.waitForSelector('#midsem-sheet:not([hidden])');
    await openMidsemEdit(page, 0);

    check('the edit dialog has no course field - course code/name are read-only',
      await page.locator('#me-course').count() === 0);
    const courseName = await page.evaluate(() =>
      window.TIMETABLE_DATA.courses.find((c) => c.code === 'CS2102').name);
    eq('the edit dialog names the read-only course and its name',
      (await page.textContent('#midsem-edit-sub')).trim(), 'CS2102 · ' + courseName);
    const publishedVenue = 'G02 (24MS001 to 24MS158, 22MS213, 23MS013 to 23MS256); ' +
      'G08 (24MS167 to 24MS249, 25MS020 to 25MS225)';
    eq('the dialog pre-fills the published date/time/venue, roll ranges included', await page.evaluate(() => [
      document.getElementById('me-date').value,
      document.getElementById('me-time').value,
      document.getElementById('me-venue').value,
    ]), ['2026-09-12', '10:00', publishedVenue]);

    await page.fill('#me-venue', publishedVenue + '; Overflow Hall');
    await page.click('#midsem-edit-save');
    await page.waitForSelector('#midsem-edit-sheet', { state: 'hidden' });

    eq('the edited exam is flagged and shows the new venue',
      await midsemRows(page), [['10:00', 'CS2102', publishedVenue + '; Overflow Hall', true]]);
    eq('only the changed field is persisted (sparse patch)',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.midsem.v1')).overrides),
      { 'midsem-cs2102': { venue: publishedVenue + '; Overflow Hall' } });

    await page.click('#midsem-close');
    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    await page.click('[data-action="midsem-full"]');
    await page.waitForSelector('#midsem-sheet:not([hidden])');
    eq('the edit survives a reload',
      await midsemRows(page), [['10:00', 'CS2102', publishedVenue + '; Overflow Hall', true]]);

    // --- moving the date/time to right now makes it the current exam
    await openMidsemEdit(page, 0);
    await page.fill('#me-date', '2026-09-01');
    await page.fill('#me-time', '08:00');
    await page.click('#midsem-edit-save');
    await page.waitForSelector('#midsem-edit-sheet', { state: 'hidden' });
    await page.click('#midsem-close');
    eq('the Mid-Sem card reflects the edited (now current) exam time',
      (await page.locator('#midsem-card .now-label').textContent()).trim(), 'Mid-Sem exam now');

    // --- restoring every field drops the override entirely
    await page.click('[data-action="midsem-full"]');
    await page.waitForSelector('#midsem-sheet:not([hidden])');
    await openMidsemEdit(page, 0);
    await page.fill('#me-date', '2026-09-12');
    await page.fill('#me-time', '10:00');
    await page.fill('#me-venue', publishedVenue);
    await page.click('#midsem-edit-save');
    await page.waitForSelector('#midsem-edit-sheet', { state: 'hidden' });
    eq('re-entering the published values clears the override',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.midsem.v1')), null);
    check('the exam is no longer flagged as edited', (await midsemRows(page))[0][3] === false);

    await page.click('#midsem-close');
    await ctx.close();
  }

  // ============ 47. Reset Mid-Sem edits stays separate from timetable/course resets ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-01T08:00:00' });   // Tuesday
    await seed(page, ['CS2102', 'CS2103']);   // CS2103 has no Mid-Sem exam at all
    await page.waitForSelector('#screen-app:not([hidden])');

    await page.click('#open-settings');
    await page.waitForSelector('#settings-sheet:not([hidden])');
    check('the reset-Mid-Sem button is hidden with no edits', await page.isHidden('#reset-midsem-btn'));
    await page.click('#close-settings');

    await page.click('[data-action="midsem-full"]');
    await page.waitForSelector('#midsem-sheet:not([hidden])');
    await openMidsemEdit(page, 0);   // CS2102 is the only exam listed
    await page.fill('#me-venue', 'Changed Venue');
    await page.click('#midsem-edit-save');
    await page.waitForSelector('#midsem-edit-sheet', { state: 'hidden' });
    await page.click('#midsem-close');

    // an ordinary timetable edit, to prove the two resets never cross-affect each other
    await openMenu(page, '#today-list', 0);   // CS2103's Tuesday 11:40 class
    await page.click('#event-edit');
    await page.waitForSelector('#edit-sheet:not([hidden])');
    await page.fill('#f-room', 'ZZZ');
    await page.click('#edit-save');
    await page.waitForSelector('#edit-sheet', { state: 'hidden' });

    await page.click('#open-settings');
    await page.waitForSelector('#settings-sheet:not([hidden])');
    check('the reset-Mid-Sem button appears once an exam is edited', await page.isVisible('#reset-midsem-btn'));
    eq('it summarises the edit count',
      (await page.textContent('#midsem-changes-summary')).trim(), '1 exam edited - restore the published schedule');

    await page.click('#reset-midsem-btn');
    await page.waitForSelector('#confirm-dialog:not([hidden])');
    await page.click('#confirm-ok');
    await page.waitForSelector('#confirm-dialog', { state: 'hidden' });

    eq('Mid-Sem overrides are cleared',
      await page.evaluate(() => localStorage.getItem('iiserk.tt.midsem.v1')), null);
    eq('the timetable edit survives the Mid-Sem reset untouched',
      await page.evaluate(() => !!JSON.parse(localStorage.getItem('iiserk.tt.custom.v1')).overrides), true);
    eq('the course selection survives the Mid-Sem reset untouched',
      await page.evaluate(() => JSON.parse(localStorage.getItem('iiserk.tt.courses.v1'))), ['CS2102', 'CS2103']);
    await ctx.close();
  }

  // ============ 48. Malformed / missing Mid-Sem storage ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-01T08:00:00' });
    await page.goto(base);
    await page.evaluate(() => {
      localStorage.setItem('iiserk.tt.courses.v1', JSON.stringify(['CS2102']));
      localStorage.setItem('iiserk.tt.midsem.v1', '{not valid json');
    });
    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    await page.click('[data-action="midsem-full"]');
    await page.waitForSelector('#midsem-sheet:not([hidden])');
    eq('corrupt Mid-Sem data degrades to the published schedule, not a crash',
      await midsemRows(page), [['10:00', 'CS2102',
        'G02 (24MS001 to 24MS158, 22MS213, 23MS013 to 23MS256); G08 (24MS167 to 24MS249, 25MS020 to 25MS225)', false]]);
    await page.click('#midsem-close');

    await page.evaluate(() => localStorage.setItem('iiserk.tt.midsem.v1', JSON.stringify({
      version: 1,
      overrides: {
        'midsem-cs2102': { date: '31/13/2026', time: '99:99', venue: '   ', duration: 999 },
        'no-such-exam-id': { venue: 'X' },
        'bad-patch': 'not an object',
      },
    })));
    await page.reload();
    await page.waitForSelector('#screen-app:not([hidden])');
    await page.click('[data-action="midsem-full"]');
    await page.waitForSelector('#midsem-sheet:not([hidden])');
    eq('invalid fields are dropped, published values are kept, unknown ids are ignored',
      await midsemRows(page), [['10:00', 'CS2102',
        'G02 (24MS001 to 24MS158, 22MS213, 23MS013 to 23MS256); G08 (24MS167 to 24MS249, 25MS020 to 25MS225)', false]]);
    check('the app does not crash on malformed Mid-Sem storage', await page.isVisible('#screen-app'));
    await ctx.close();
  }

  // ============ 49. Offline cold start with a Mid-Sem edit and active suppression ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-07T09:00:00' });   // Monday, CH2102's exam day
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      if (!keys.length) return false;
      const c = await caches.open(keys[0]);
      return (await c.keys()).length >= 10;
    }, null, { timeout: 15000 });

    for (const code of ['CH2102', 'PH3102']) {
      await page.fill('#search', code);
      await page.waitForTimeout(50);
      await page.click(`.course-row[data-code="${code}"]`);
    }
    await page.click('#continue-btn');
    await page.waitForSelector('#screen-app:not([hidden])');

    // Edit the exam's venue while still online.
    await page.click('[data-action="midsem-full"]');
    await page.waitForSelector('#midsem-sheet:not([hidden])');
    await openMidsemEdit(page, 0);
    await page.fill('#me-venue', 'Overflow Hall');
    await page.click('#midsem-edit-save');
    await page.waitForSelector('#midsem-edit-sheet', { state: 'hidden' });
    await page.click('#midsem-close');

    // ---- genuinely offline, cold start
    await ctx.setOffline(true);
    const cold = await newPage(ctx, { clock: '2026-09-07T09:00:00' });
    await cold.goto(base);
    await cold.waitForSelector('#screen-app:not([hidden])', { timeout: 15000 });

    check('the app cold-starts offline with the Mid-Sem feature intact', await cold.isVisible('#screen-app'));
    // Both selected courses have an exam that day - CH2102's 10:00-11:30
    // suppresses PH3102's 09:50 class, and PH3102's own 15:00-16:30 exam in
    // turn suppresses CH2102's 16:15 class, leaving nothing on Today.
    eq('offline suppression accounts for every selected course\'s exam that day',
      await listRows(cold, '#today-list'), []);
    await cold.click('[data-action="midsem-full"]');
    await cold.waitForSelector('#midsem-sheet:not([hidden])');
    eq('the offline Mid-Sem edit is intact, alongside the other selected course\'s published exam',
      await midsemRows(cold), [['10:00', 'CH2102', 'Overflow Hall', true], ['15:00', 'PH3102', 'G06', false]]);
    await ctx.setOffline(false);
    await ctx.close();
  }

  // ============ 50. Mid-Sem Examinations week (5-13 Sept): no regular classes ============
  {
    // A break like any other in data/holidays.js, so it gets the exact same
    // treatment already proven for Autumn Break/Winter Vacation - covering 5
    // (Sat) to 13 (Sun) September inclusive so "Classes resume" always
    // correctly resolves to Monday 14 September, the real first teaching day
    // (13th itself is a Sunday, which never has classes regardless).
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-05T10:00:00' });   // first day, a Saturday
    await seed(page, ['CH2102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('the label reads "On break"',
      (await page.locator('.now-card .now-label').textContent()).trim(), 'On break');
    eq('the break is named "Mid-Sem Examinations"',
      (await page.locator('.holiday-name').textContent()).trim(), 'Mid-Sem Examinations');
    eq('resume-date phrasing correctly points at the real first teaching day',
      (await page.locator('.now-card .now-empty').textContent()).trim(),
      'No regular classes. Classes resume Monday, 14 September.');
    eq('the weekend message is overridden, not shown alongside the break',
      await page.locator('#today-list .event').count(), 0);
    check('the empty state names the break, not the weekend',
      /Mid-Sem Examinations/.test(await page.textContent('#today-list')) &&
      !/weekend/i.test(await page.textContent('#today-list')));
    await ctx.close();
  }

  {
    // A weekday inside the range: CH2102's own exam is happening at this
    // exact moment. The blanket "no regular classes" break notice and the
    // student's own personal Mid-Sem exam card are independent and both
    // render together - one says classes are paused this week, the other
    // says exactly where/when to be for the exam itself.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-07T10:30:00' });   // Monday, mid-exam
    await seed(page, ['CH2102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('the break card still shows on a weekday inside the range',
      (await page.locator('.now-card .now-label').textContent()).trim(), 'On break');
    eq('no misleading "Current class" or "Next" label appears',
      /Current class|^Next$/.test(await page.textContent('#now-card')), false);
    eq('Today\'s class list is fully cleared, including CH2102\'s own unrelated 16:15 class',
      await page.locator('#today-list .event').count(), 0);
    check('the empty state names the break',
      /Mid-Sem Examinations/.test(await page.textContent('#today-list')));

    // The personal Mid-Sem exam card is a separate section and is unaffected.
    eq('the personal Mid-Sem exam card still shows the exam happening right now',
      (await page.locator('#midsem-card .now-label').textContent()).trim(), 'Mid-Sem exam now');
    eq('it still names the course', (await page.locator('#midsem-card .now-code').textContent()).trim(), 'CH2102');
    await ctx.close();
  }

  {
    // Last day, a Sunday: the resume phrase says "tomorrow" (which is
    // genuinely true this time - Monday 14 September - unlike naively ending
    // the range on 12 September, where "tomorrow" would wrongly mean the
    // 13th, a Sunday with no classes).
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-13T10:00:00' });
    await seed(page, ['CH2102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('on the actual last day, the resume phrase says "tomorrow"',
      (await page.locator('.now-card .now-empty').textContent()).trim(),
      'No regular classes. Classes resume tomorrow.');
    await ctx.close();
  }

  {
    // Next-class scan from just before the range must skip the whole week
    // and land on Monday 14 September - the real next teaching day.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-04T20:00:00' });   // Friday night, just before
    await seed(page, ['CH2102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    eq('the Next card skips the entire Mid-Sem week to the real next class',
      await page.evaluate(() => {
        const t = window.__tt;
        return t.computeNextSkippingBreaks(new Set(['CH2102']), new Date()).nextOffset;
      }), 10);   // Fri 4 Sept -> Mon 14 Sept is 10 days
    check('the rendered card reflects the break-aware result',
      /Next class/.test(await page.textContent('#now-card')) &&
      /Monday/.test(await page.textContent('#now-card')));
    await ctx.close();
  }

  {
    // Week view must be completely unaffected - same Monday as section 45's
    // suite, full unfiltered class list, no mention of the break anywhere.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-07T10:30:00' });
    await seed(page, ['PH3104', 'PH3102', 'CH4104', 'PH4104', 'CH2102']);
    await page.waitForSelector('#screen-app:not([hidden])');

    await page.click('.tab[data-view="week"]');
    await page.waitForSelector('#view-week:not([hidden])');
    eq('Week view shows the normal, unfiltered Monday schedule',
      await listRows(page, '#week-list'),
      [['08:00', 'PH3104', 'Tutorial', 'G08', false],
       ['08:55', 'PH3104', 'Theory', 'G08', false],
       ['09:50', 'PH3102', 'Theory', 'G02', false],
       ['10:45', 'CH4104', 'Theory', '110', false],
       ['11:40', 'PH4104', 'Theory', '102', false],
       ['16:15', 'CH2102', 'Theory', 'S N Bose Lecture Theatre', false]]);
    eq('day pill counts are the normal, unfiltered counts',
      (await page.locator('#day-chips .chip').allTextContents()).join(','),
      'Mon6,Tue4,Wed0,Thu6,Fri2');
    check('no mention of the break anywhere in Week view',
      !/Mid-Sem Examinations|break/i.test(await page.textContent('#view-week')));
    await ctx.close();
  }

  // ============ 51. Next-class day badge disambiguates a far-off day with a date ============
  {
    // The exact scenario a real user hit: Friday 4 Sept, the next PH3104
    // class is skipped past the whole Mid-Sem week to Monday 14 Sept
    // (offset 10) - "MONDAY" alone looks identical to next Monday the 7th
    // (which is inside the break and correctly excluded), so the date must
    // be shown to disambiguate.
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx, { clock: '2026-09-04T15:38:00' });
    await seed(page, ['PH3104']);
    await page.waitForSelector('#screen-app:not([hidden])');

    const offset = await page.evaluate(() =>
      window.__tt.computeNextSkippingBreaksAndMidsem(new Set(['PH3104']), new Date()).nextOffset);
    eq('sanity check: the next class really is 10 days out, past the whole break', offset, 10);
    eq('the day badge disambiguates with the date beyond a week out',
      (await page.locator('.now-day').textContent()).trim(), 'Monday, 14 Sep');
    await ctx.close();
  }

  // Within a week the day name alone is unambiguous, e.g. Saturday ->
  // Monday (offset 2) - already covered in section 2 ("a next class on
  // another day is labelled with that day", plain "Monday", no date).

  // ============ 52. First-year courses added, MA3110 rescheduled ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx);
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    const CATALOG = {
      CH1101: 'Elements of Chemistry I',
      CS1101: 'Introduction to Computer Programming',
      ES1101: 'Introduction to Earth Science',
      HU1101: 'Communicative English I',
      HU1103: 'Communicative English II',
      LS1101: 'Introduction to Biology I',
      MA1101: 'Mathematics I',
      PH1101: 'Mechanics I',
      PH1102: 'Physics Laboratory I',
    };
    for (const code of Object.keys(CATALOG)) {
      await page.fill('#search', code);
      await page.waitForTimeout(50);
      eq(`${code} is in the catalog as "${CATALOG[code]}"`,
        (await page.locator(`.course-row[data-code="${code}"] .name`).textContent()).trim(), CATALOG[code]);
    }
    await page.click('#search-clear');
    await page.waitForTimeout(50);
    eq('picker lists exactly 131 courses (122 + 9 new first-years; LS1102 was withdrawn, never added)',
      await page.locator('.course-row').count(), 131);
    check('LS1102 (mentioned but withdrawn) was never added',
      await page.locator('.course-row[data-code="LS1102"]').count() === 0);

    for (const code of Object.keys(CATALOG)) {
      await page.fill('#search', code);
      await page.waitForTimeout(50);
      await page.click(`.course-row[data-code="${code}"]`);
    }
    await page.fill('#search', 'MA3110');
    await page.waitForTimeout(50);
    await page.click('.course-row[data-code="MA3110"]');
    await page.click('#continue-btn');
    await page.waitForSelector('#screen-app:not([hidden])');

    // --- MA3110: Monday/Tuesday only now, Wednesday/Friday dropped entirely
    await page.click('.tab[data-view="week"]');
    await page.waitForSelector('#view-week:not([hidden])');
    await page.click('[data-day="Monday"]');
    eq('MA3110 keeps its original Monday 13:30 class and gains a new 14:25 one',
      (await page.locator('#week-list .event').filter({ hasText: 'MA3110' })
        .locator('.time').allTextContents()), ['13:30', '14:25']);
    await page.click('[data-day="Tuesday"]');
    eq('MA3110 moves its two former Wednesday classes to Tuesday 14:25 and 15:20',
      (await page.locator('#week-list .event').filter({ hasText: 'MA3110' })
        .locator('.time').allTextContents()), ['14:25', '15:20']);
    await page.click('[data-day="Wednesday"]');
    check('MA3110 no longer meets on Wednesday',
      await page.locator('#week-list .event').filter({ hasText: 'MA3110' }).count() === 0);
    await page.click('[data-day="Friday"]');
    check('MA3110 no longer meets on Friday',
      await page.locator('#week-list .event').filter({ hasText: 'MA3110' }).count() === 0);

    // --- the new first-year courses render correctly, including the new
    // 12:35 slot (previously unused - reserved for lunch on the upperclass
    // grid) and a multi-room Lab/Tutorial spread across parallel sections.
    await page.click('[data-day="Tuesday"]');
    const tueRows = await listRows(page, '#week-list');
    check('the new 12:35 slot renders (LS1101, Tuesday)',
      tueRows.some((r) => r[0] === '12:35' && r[1] === 'LS1101'));
    const cs1101Dur = (await page.locator('#week-list .event').filter({ hasText: 'CS1101' })
      .locator('.dur').first().textContent()).trim();
    eq('CS1101\'s Tuesday lab renders as a 160-minute Lab', cs1101Dur, '160 min');

    await page.click('[data-day="Monday"]');
    eq('CH1101\'s 7 parallel Monday tutorial sections all render for the selected course',
      (await page.locator('#week-list .event').filter({ hasText: 'CH1101' }).count()), 7);

    await ctx.close();
  }

  await browser.close();
  server.close();

  if (errors.length) {
    console.log('\nBrowser console errors:');
    errors.forEach((e) => console.log('  ! ' + e));
  }
  check('no uncaught browser errors', errors.length === 0, errors.length ? errors[0] : 'clean');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
