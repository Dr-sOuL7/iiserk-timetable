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
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
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

  // ============ 1. First launch shows the picker ============
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await newPage(ctx);
    await page.goto(base);
    await page.waitForSelector('#screen-setup:not([hidden])');

    check('first launch shows the course picker', await page.isVisible('#screen-setup'));
    check('first launch hides the timetable', !(await page.isVisible('#screen-app')));

    const rows = await page.locator('.course-row').count();
    eq('picker lists every timetabled course', rows, 122);
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
    eq('clearing search restores the full list', await page.locator('.course-row').count(), 122);

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
      await page.evaluate(() => window.TIMETABLE_DATA.events.length), 433);
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
      await page.evaluate(() => window.TIMETABLE_DATA.events.length), 433);
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

    eq('dataset loaded in the browser', audit.total, 433);
    eq('course catalog loaded in the browser', audit.courses, 122);
    eq('per-day totals match the source', audit.perDay, [92, 85, 73, 89, 94]);
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
    eq('classes are 50 minutes and labs 160',
      Object.keys(durations).sort().map((k) => [k, durations[k]]),
      [['Lab', [160]], ['Theory', [50]], ['Tutorial', [50]]]);

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
