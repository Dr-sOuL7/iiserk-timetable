#!/usr/bin/env node
/**
 * Data validation (development only). Checks the generated dataset against the
 * raw source. Run: node tools/validate-data.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'timetable.js'));
const DATA = global.TIMETABLE_DATA;

const raw = fs.readFileSync(path.join(ROOT, 'tools', 'raw', 'timetable.txt'), 'utf8');
const rawLines = raw.split(/\r?\n/).filter((l) => /^\s*\*/.test(l));

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`);
  if (!ok) failures++;
};

// 1. Every raw line produced exactly one event.
check('event count matches raw source lines',
  DATA.events.length === rawLines.length,
  `${DATA.events.length} events vs ${rawLines.length} source lines`);

// 2. No exact duplicate events (same day+time+course+type+room).
const seen = new Map();
const dupes = [];
for (const e of DATA.events) {
  const key = [e.day, e.time, e.course, e.type, e.room].join('|');
  if (seen.has(key)) dupes.push(key); else seen.set(key, e);
}
check('no exact duplicate events', dupes.length === 0, dupes.join(' ; ') || 'none');

// 2b. Same-slot, same-course events with different rooms must be preserved.
const friCh2104 = DATA.events.filter((e) => e.day === 'Friday' && e.course === 'CH2104' && e.time === '09:50');
check('same-course same-slot events with different rooms preserved',
  friCh2104.length === 2 && new Set(friCh2104.map((e) => e.room)).size === 2,
  friCh2104.map((e) => e.room).join(' + '));

// 3. Ids: unique, stable and content-derived (user customisations key off them).
check('all event ids unique', new Set(DATA.events.map((e) => e.id)).size === DATA.events.length);
check('ids are slug-shaped, not positional',
  DATA.events.every((e) => /^[a-z]{3}-\d{4}-[a-z]{2}\d{4}-(theory|tutorial|lab)-[a-z0-9-]+$/.test(e.id)),
  DATA.events[0].id);
check('ids are derived from the event\'s own fields (recomputable)',
  (() => {
    const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return DATA.events.every((e) => e.id === [slug(e.day).slice(0, 3), e.time.replace(':', ''),
      slug(e.course), slug(e.type), slug(e.room)].join('-'));
  })());
check('ids survive reordering (independent of array position)',
  (() => {
    const shuffled = [...DATA.events].sort((a, b) => a.room.localeCompare(b.room) || a.id.localeCompare(b.id));
    const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return shuffled.every((e) => e.id === [slug(e.day).slice(0, 3), e.time.replace(':', ''),
      slug(e.course), slug(e.type), slug(e.room)].join('-'));
  })());

// 4. Course catalog covers exactly the codes present in events.
const fromEvents = [...new Set(DATA.events.map((e) => e.course))].sort();
const fromCatalog = DATA.courses.map((c) => c.code).sort();
check('catalog codes === codes used by events',
  JSON.stringify(fromEvents) === JSON.stringify(fromCatalog),
  `${fromCatalog.length} courses`);
check('every course code matches AA9999 format',
  fromEvents.every((c) => /^[A-Z]{2}\d{4}$/.test(c)));
check('every course has a name from the CSV',
  DATA.courses.every((c) => c.name && c.name.length > 0),
  DATA.courses.filter((c) => !c.name).map((c) => c.code).join(', ') || 'all named');

// 5. Type classification is derived correctly from the raw text.
let typeErrors = [];
const rawCounts = { Tutorial: 0, Lab: 0, Theory: 0 };
for (const line of rawLines) {
  if (/\(Tut\)/.test(line)) rawCounts.Tutorial++;
  else if (/\(Lab\)\s*$/.test(line)) rawCounts.Lab++;
  else rawCounts.Theory++;
}
const dataCounts = DATA.events.reduce((a, e) => (a[e.type] = (a[e.type] || 0) + 1, a), { Theory: 0, Tutorial: 0, Lab: 0 });
for (const t of Object.keys(rawCounts)) {
  if (rawCounts[t] !== dataCounts[t]) typeErrors.push(`${t}: raw ${rawCounts[t]} vs data ${dataCounts[t]}`);
}
check('Theory/Tutorial/Lab counts match the raw source', typeErrors.length === 0,
  typeErrors.join('; ') || JSON.stringify(dataCounts));
check('only the three known types exist',
  DATA.events.every((e) => ['Theory', 'Tutorial', 'Lab'].includes(e.type)));
// A "(Tut)" line is a Tutorial even though it ends in "(Theory)".
check('"(Tut)" lines classified as Tutorial, never Theory',
  DATA.events.filter((e) => e.type === 'Tutorial').length === rawCounts.Tutorial);
// Labs keep their lab room text.
check('every Lab event has a lab/computer room',
  DATA.events.filter((e) => e.type === 'Lab').every((e) => /Lab/i.test(e.room)));

// 6. Times are sortable + consistent with the published slot grid.
const SLOTS = ['08:00', '08:55', '09:50', '10:45', '11:40', '13:30', '14:25', '15:20', '16:15', '17:10'];
check('every time is HH:MM 24-hour', DATA.events.every((e) => /^\d{2}:\d{2}$/.test(e.time)));
check('minutes field agrees with time string',
  DATA.events.every((e) => {
    const [h, m] = e.time.split(':').map(Number);
    return h * 60 + m === e.minutes;
  }));
check('times sort chronologically by `minutes`',
  (() => {
    const sorted = [...DATA.events].sort((a, b) => a.minutes - b.minutes);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].minutes < sorted[i - 1].minutes) return false;
      if (sorted[i].minutes === sorted[i - 1].minutes) continue;
      if (sorted[i].time < sorted[i - 1].time) return false; // string sort must agree
    }
    return true;
  })());
const unknownSlots = [...new Set(DATA.events.map((e) => e.time))].filter((t) => !SLOTS.includes(t));
check('all start times fall on the published slot grid', unknownSlots.length === 0, unknownSlots.join(', ') || SLOTS.join(' '));

// 7. Day assignment: each event's day matches the header it appeared under.
const rawByDay = {};
{
  let day = null;
  for (const line of raw.split(/\r?\n/)) {
    const h = /^([A-Za-z]+day)\s*-\s*$/.exec(line.trim());
    if (h) { day = h[1]; rawByDay[day] = 0; continue; }
    if (/^\s*\*/.test(line)) rawByDay[day]++;
  }
}
const dayErrors = [];
for (const d of DATA.days) {
  const n = DATA.events.filter((e) => e.day === d).length;
  if (n !== rawByDay[d]) dayErrors.push(`${d}: raw ${rawByDay[d]} vs data ${n}`);
}
check('per-day event counts match the raw source', dayErrors.length === 0,
  dayErrors.join('; ') || DATA.days.map((d) => `${d.slice(0, 3)} ${rawByDay[d]}`).join(', '));
check('every event day is Monday-Friday',
  DATA.events.every((e) => DATA.days.includes(e.day)));

// 8. Byte-level spot check: rebuild each raw line from the parsed event and
//    confirm the multiset of (day,time,course,type,room) tuples is identical.
{
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const fromRaw = [];
  let day = null;
  for (const line of raw.split(/\r?\n/)) {
    const h = /^([A-Za-z]+day)\s*-\s*$/.exec(line.trim());
    if (h) { day = h[1]; continue; }
    const m = /^\s*\*\s*(.+?)\s*:\s*([A-Z]{2}\d{4})\s*(\(Tut\))?\s*\[(.+?)\]\s*\((Theory|Lab)\)\s*$/.exec(line);
    if (!m) continue;
    let [, t, course, tut, room, trailing] = m;
    let [hh, mm] = t.trim().replace(/\s*(a|p)\.m\.$/i, '').split(':');
    hh = parseInt(hh, 10); mm = mm ? parseInt(mm, 10) : 0;
    if (/p\.m\./i.test(t) && hh < 12) hh += 12;
    fromRaw.push([day, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      course, tut ? 'Tutorial' : trailing, norm(room)].join('|'));
  }
  const fromData = DATA.events.map((e) => [e.day, e.time, e.course, e.type, norm(e.room)].join('|'));
  check('rooms preserved exactly (independent re-parse of every line)',
    JSON.stringify(fromRaw.slice().sort()) === JSON.stringify(fromData.slice().sort()),
    `${fromRaw.length} tuples compared`);
}

// 9. Durations present and positive.
check('every event has a positive duration',
  DATA.events.every((e) => Number.isInteger(e.duration) && e.duration > 0));

// 10. Known duration exceptions: events whose duration deliberately differs
// from their type's standard length (tools/build-data.js DURATION_OVERRIDES).
// Confirms the override applied to the right event AND that it stayed the
// only exception - a second Theory/Tutorial event drifting off 50, or a Lab
// off 160, would mean an override leaked or the standard grid broke.
{
  const STANDARD = DATA.durations;
  const exceptions = DATA.events.filter((e) => e.duration !== STANDARD[e.type]);
  check('Wednesday 13:30 CS2102 is the sole duration exception, at 160 min',
    exceptions.length === 1 && exceptions[0].id === 'wed-1330-cs2102-theory-ramanujan-virtual-classroom' &&
    exceptions[0].duration === 160,
    JSON.stringify(exceptions.map((e) => [e.id, e.duration])));
  check('the CS2102 duration exception keeps its published Theory type',
    (() => {
      const e = DATA.events.find((x) => x.id === 'wed-1330-cs2102-theory-ramanujan-virtual-classroom');
      return e && e.type === 'Theory';
    })());
  check('the other CS2102 class (Monday) is unaffected',
    (() => {
      const e = DATA.events.find((x) => x.id === 'mon-1520-cs2102-theory-ramanujan-virtual-classroom');
      return e && e.duration === 50;
    })());
}

console.log(`\n${failures === 0 ? 'ALL DATA CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
