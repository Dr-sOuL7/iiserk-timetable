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
      await cold.evaluate(() => window.TIMETABLE_DATA.events.length), 433);
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
    eq('the published event count is unchanged at 433', audit.published, 433);
    eq('editing introduces no duplicate events', audit.uniqueIds, audit.effective);
    eq('published ids remain unique', audit.publishedIdsUnique, 433);
    check('an edit that collides with another class does not merge them',
      audit.effective === 433, `${audit.effective} effective events`);

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

  // ============ 27. Consecutive holidays (19 + 20 October) ============
  {
    for (const [iso, name] of [['2026-10-19T10:00:00', 'Additional day for Dussehra'],
                               ['2026-10-20T10:00:00', 'Dussehra']]) {
      const ctx = await browser.newContext(ctxOpts);
      const page = await newPage(ctx, { clock: iso });
      await seed(page, ['PH3104']);
      await page.waitForSelector('#screen-app:not([hidden])');
      eq(`${iso.slice(0, 10)} shows its own distinct holiday name`,
        (await page.locator('.holiday-name').textContent()).trim(), name);
      eq('only one holiday card renders (no duplicate/adjacent-day notice)',
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

    // The Dussehra pair's date-format example, verbatim.
    const ctx2 = await browser.newContext(ctxOpts);
    const page2 = await newPage(ctx2, { clock: '2026-10-18T10:00:00' });   // Sun, before Mon 19 Oct
    await seed(page2, ['PH3104']);
    await page2.waitForSelector('#screen-app:not([hidden])');
    eq('Dussehra-pair tomorrow-notice date format matches the spec example',
      (await page2.locator('.now-card.holiday .now-empty').textContent()).trim(), 'Monday, 19 October');
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

    eq('the published timetable is still exactly 433 events',
      await page.evaluate(() => window.TIMETABLE_DATA.events.length), 433);
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
