#!/usr/bin/env node
/**
 * Build script (development only - NOT required to deploy or run the app).
 *
 * Parses tools/raw/timetable.txt + tools/raw/courses.csv into data/timetable.js,
 * a plain JS file that the static site loads with a <script> tag.
 *
 * Run:  node tools/build-data.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW_TIMETABLE = path.join(ROOT, 'tools', 'raw', 'timetable.txt');
const RAW_COURSES = path.join(ROOT, 'tools', 'raw', 'courses.csv');
const OUT = path.join(ROOT, 'data', 'timetable.js');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Class lengths. Lectures and tutorials run 50 minutes with a 5-minute break
// before the next one, which is why the published slot grid steps in 55s
// (08:00, 08:55, 09:50, 10:45, 11:40, 13:30, 14:25, 15:20, 16:15, 17:10).
// Labs run 160 minutes. Change these numbers to change every duration in the app.
const DURATION_MINUTES = { Theory: 50, Tutorial: 50, Lab: 160 };

// One-off exceptions to the standard per-type duration above: classes that run
// longer or shorter than their own type would suggest, confirmed against the
// real schedule rather than the published slot grid. Type is left as published
// (this is a length exception, not a reclassification) - see the Wednesday
// CS2102 entry below, which is timetabled as Theory but actually runs a full
// 160-minute lab-length block. Matched on every identifying field so a source
// change that moves or removes the line fails the build instead of silently
// doing nothing.
const DURATION_OVERRIDES = [
  { day: 'Wednesday', time: '13:30', course: 'CS2102', type: 'Theory',
    room: 'Ramanujan Virtual Classroom', duration: 160 },
];

const DAY_HEADER = /^([A-Za-z]+day)\s*-\s*$/;
const EVENT = /^\s*\*\s*(.+?)\s*:\s*([A-Z]{2}\d{4})\s*(\(Tut\))?\s*\[(.+?)\]\s*\((Theory|Lab|Tut|Tutorial)\)\s*$/;
const TIME = /^(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.)?$/i;

function parseTime(raw, lineNo) {
  const m = TIME.exec(raw.trim());
  if (!m) throw new Error(`Line ${lineNo}: cannot parse time "${raw}"`);
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = (m[3] || '').toLowerCase();
  // "13:30 p.m." is already 24-hour in the source; only shift a real 1-12 p.m.
  if (meridiem === 'p.m.' && hour < 12) hour += 12;
  if (meridiem === 'a.m.' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) throw new Error(`Line ${lineNo}: bad time "${raw}"`);
  return { hour, minute, minutes: hour * 60 + minute,
           label: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') };
}

function parseTimetable(text) {
  const events = [];
  let day = null;
  text.split(/\r?\n/).forEach((line, i) => {
    const lineNo = i + 1;
    if (!line.trim()) return;
    const header = DAY_HEADER.exec(line.trim());
    if (header) {
      day = header[1];
      if (!DAYS.includes(day)) throw new Error(`Line ${lineNo}: unknown day "${day}"`);
      return;
    }
    const m = EVENT.exec(line);
    if (!m) throw new Error(`Line ${lineNo}: unparsed line -> ${JSON.stringify(line)}`);
    if (!day) throw new Error(`Line ${lineNo}: event before any day header`);

    const [, rawTime, course, tutMarker, room, trailingType] = m;
    const time = parseTime(rawTime, lineNo);
    const type = tutMarker ? 'Tutorial' : (trailingType === 'Lab' ? 'Lab' : 'Theory');

    events.push({
      day,
      time: time.label,
      minutes: time.minutes,
      duration: DURATION_MINUTES[type],
      course,
      type,
      room,
    });
  });
  return events;
}

// Minimal RFC-4180-ish CSV reader (handles the quoted course names in the file).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

function parseCourses(text) {
  const rows = parseCsv(text);
  const header = rows.shift().map((h) => h.trim().toUpperCase());
  const iCode = header.indexOf('COURSE CODE');
  const iName = header.indexOf('COURSE NAME');
  if (iCode < 0 || iName < 0) throw new Error('courses.csv: missing expected header columns');
  const names = {};
  for (const r of rows) {
    const code = (r[iCode] || '').trim();
    if (code) names[code] = (r[iName] || '').trim();
  }
  return names;
}

function main() {
  const events = parseTimetable(fs.readFileSync(RAW_TIMETABLE, 'utf8'));
  const names = parseCourses(fs.readFileSync(RAW_COURSES, 'utf8'));

  for (const o of DURATION_OVERRIDES) {
    const matches = events.filter((e) =>
      e.day === o.day && e.time === o.time && e.course === o.course &&
      e.type === o.type && e.room === o.room);
    if (matches.length !== 1) {
      throw new Error(`duration override matched ${matches.length} event(s), expected 1: ` +
        JSON.stringify(o));
    }
    matches[0].duration = o.duration;
  }

  // Stable ordering: day, then start time, then course, then type, then room.
  const dayIndex = (d) => DAYS.indexOf(d);
  events.sort((a, b) =>
    dayIndex(a.day) - dayIndex(b.day) || a.minutes - b.minutes ||
    a.course.localeCompare(b.course) || a.type.localeCompare(b.type) ||
    a.room.localeCompare(b.room));

  // Stable content-derived ids, e.g. "mon-0855-ph3102-theory-g02".
  //
  // Deliberately NOT the array index: user customisations are stored against
  // these ids in localStorage, so an id must keep pointing at the same class
  // even if the dataset is regenerated, reordered, or has events added or
  // removed. Every field that distinguishes one event from another takes part,
  // which is what makes them unique (two classes can share a slot only if they
  // differ by course, type or room).
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const seenIds = new Map();
  for (const e of events) {
    e.id = [slug(e.day).slice(0, 3), e.time.replace(':', ''), slug(e.course),
            slug(e.type), slug(e.room)].join('-');
    if (seenIds.has(e.id)) {
      throw new Error(`duplicate event id "${e.id}" - ` +
        `${JSON.stringify(seenIds.get(e.id))} vs ${JSON.stringify(e)}`);
    }
    seenIds.set(e.id, e);
  }

  const courses = [...new Set(events.map((e) => e.course))].sort();
  const catalog = courses.map((code) => ({
    code,
    name: names[code] || '',
    dept: code.slice(0, 2),
  }));

  const missingNames = catalog.filter((c) => !c.name).map((c) => c.code);
  if (missingNames.length) {
    console.warn(`warning: no CSV name for ${missingNames.length} course(s): ${missingNames.join(', ')}`);
  }

  const body =
`/**
 * GENERATED FILE - do not edit by hand.
 * Source: tools/raw/timetable.txt + tools/raw/courses.csv
 * Regenerate with: node tools/build-data.js
 *
 * This is the app's entire dataset. Swapping the timetable means regenerating
 * (or hand-replacing) this one file - no UI code needs to change.
 */
(function (global) {
  'use strict';

  var DATA = {
    /** Semester label shown in the UI. */
    semester: 'Autumn 2026',
    /** Teaching days, in week order. */
    days: ${JSON.stringify(DAYS)},
    /**
     * Class lengths in minutes. Lectures and tutorials run 50 minutes with a
     * 5-minute break before the next slot; labs run 160 minutes.
     */
    durations: ${JSON.stringify(DURATION_MINUTES)},
    /** Every course that appears at least once in the timetable. */
    courses: ${JSON.stringify(catalog, null, 6).replace(/\n/g, '\n    ')},
    /**
     * Every timetable event.
     *   id       - stable content-derived key; user customisations in
     *                localStorage are stored against it, so it must not change
     *                for a given class between dataset versions
     *   day      - 'Monday' ... 'Friday'
     *   time     - 24h start time, 'HH:MM'
     *   minutes  - start time as minutes since midnight (sortable)
     *   duration - length in minutes (see durations above)
     *   course   - course code exactly as published
     *   type     - 'Theory' | 'Tutorial' | 'Lab'
     *   room     - room/location exactly as published
     */
    events: [
${events.map((e) => '      ' + JSON.stringify({
      id: e.id, day: e.day, time: e.time, minutes: e.minutes,
      duration: e.duration, course: e.course, type: e.type, room: e.room,
    })).join(',\n')}
    ]
  };

  global.TIMETABLE_DATA = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : self);
`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body);

  console.log(`Wrote ${path.relative(ROOT, OUT)}`);
  console.log(`  events : ${events.length}`);
  console.log(`  courses: ${catalog.length}`);
  const byType = events.reduce((a, e) => (a[e.type] = (a[e.type] || 0) + 1, a), {});
  console.log(`  types  : ${JSON.stringify(byType)}`);
  for (const d of DAYS) console.log(`  ${d.padEnd(10)}: ${events.filter((e) => e.day === d).length}`);
}

main();
