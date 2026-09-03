#!/usr/bin/env node
/**
 * Build script (development only - NOT required to deploy or run the app).
 *
 * Parses tools/raw/midsem_venues_1.csv (course -> venue, one row per venue
 * allocation) and tools/raw/midsem_venues_2.csv (course -> date/shift, one
 * row per course) into data/midsem.js, a plain JS file the static site loads
 * with a <script> tag - exactly the same shape of pipeline as
 * tools/build-data.js -> data/timetable.js.
 *
 * Run:  node tools/build-midsem.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW_VENUES = path.join(ROOT, 'tools', 'raw', 'midsem_venues_1.csv');
const RAW_DATES = path.join(ROOT, 'tools', 'raw', 'midsem_venues_2.csv');
const OUT = path.join(ROOT, 'data', 'midsem.js');

// Published exam shifts. Course name is deliberately NOT stored here - it is
// looked up from the existing course-code -> course-name data at render time
// (NAME_BY_CODE in app.js), the same way timetable events already work, so
// there is exactly one place course names come from.
const SHIFTS = {
  1: { time: '10:00', duration: 90 },   // 10:00 AM - 11:30 AM
  2: { time: '15:00', duration: 90 }    // 3:00 PM - 4:30 PM
};

// Minimal RFC-4180-ish CSV reader (handles the quoted, comma-containing roll
// number ranges in the venues file) - identical approach to build-data.js's
// parseCsv(), duplicated rather than shared since these are separate,
// one-off build scripts with no runtime dependency on each other.
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

function header(rows) {
  const head = rows.shift().map((h) => h.trim());
  return (name) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`missing column "${name}"`);
    return i;
  };
}

/** "12/09/2026" (DD/MM/YYYY, as published) -> "2026-09-12". */
function toIsoDate(raw, lineNo) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!m) throw new Error(`row ${lineNo}: unrecognised date "${raw}"`);
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}

function main() {
  const venueRows = parseCsv(fs.readFileSync(RAW_VENUES, 'utf8'));
  const dateRows = parseCsv(fs.readFileSync(RAW_DATES, 'utf8'));

  // --- venues: multiple rows per course are expected (roll-number-split
  // sections in different rooms) and are merged into ONE combined string per
  // course - never one exam entry per venue row. "All" (a single section,
  // whole class) passes through unchanged; e.g. CS2102 has two rows ("G02",
  // "G08") and merges to "G02, G08" - no roll-number/section detail is kept,
  // since only the venue matters for a personal timetable.
  const vCol = header(venueRows);
  const codeIdx = vCol('Course Code'), venueIdx = vCol('Venue (Room No.)');
  const venuesByCourse = new Map();
  for (const r of venueRows) {
    const code = r[codeIdx].trim();
    const venue = r[venueIdx].trim();
    if (!venuesByCourse.has(code)) venuesByCourse.set(code, []);
    const list = venuesByCourse.get(code);
    if (list.indexOf(venue) < 0) list.push(venue);   // de-dupe an exact repeat
  }

  // --- dates/shifts: exactly one row per course.
  const dCol = header(dateRows);
  const dCodeIdx = dCol('Course Code'), dateIdx = dCol('Date'), shiftIdx = dCol('Shift');
  const examByCourse = new Map();
  dateRows.forEach((r, i) => {
    const lineNo = i + 2;   // +1 for header, +1 for 1-based
    const code = r[dCodeIdx].trim();
    const date = toIsoDate(r[dateIdx], lineNo);
    const shift = parseInt(r[shiftIdx].trim(), 10);
    if (!SHIFTS[shift]) throw new Error(`row ${lineNo}: unknown shift "${r[shiftIdx]}" for ${code}`);
    if (examByCourse.has(code)) {
      throw new Error(`duplicate date/shift row for ${code} - ` +
        `each course must appear exactly once in the dates file`);
    }
    examByCourse.set(code, { date, shift });
  });

  // --- join: every course must appear in both files exactly once each, with
  // no silent gaps in either direction (a course with a date but no venue, or
  // a venue but no date, would otherwise be dropped or half-built silently).
  const venueCodes = new Set(venuesByCourse.keys());
  const dateCodes = new Set(examByCourse.keys());
  const onlyInVenues = [...venueCodes].filter((c) => !dateCodes.has(c));
  const onlyInDates = [...dateCodes].filter((c) => !venueCodes.has(c));
  if (onlyInVenues.length) throw new Error(`course(s) with a venue but no date/shift: ${onlyInVenues.join(', ')}`);
  if (onlyInDates.length) throw new Error(`course(s) with a date/shift but no venue: ${onlyInDates.join(', ')}`);

  const courses = [...venueCodes].sort();
  const exams = courses.map((course) => {
    const { date, shift } = examByCourse.get(course);
    const { time, duration } = SHIFTS[shift];
    const [hh, mm] = time.split(':').map(Number);
    return {
      // Content-derived, stable id - one entry per course, so the course
      // code alone is enough (lower-cased to match the timetable event id
      // convention). Never the array index - user edits are stored against
      // this id in localStorage and must not detach if this file regenerates
      // in a different order.
      id: 'midsem-' + course.toLowerCase(),
      course,
      date,
      time,
      minutes: hh * 60 + mm,
      duration,
      shift,
      venue: venuesByCourse.get(course).join(', ')
    };
  });

  // Stable chronological ordering in the generated file itself (the app
  // re-sorts at render time regardless, using the possibly-edited date/time,
  // but a chronological source file is easier to eyeball and diff).
  exams.sort((a, b) => (a.date + ' ' + a.time).localeCompare(b.date + ' ' + b.time) ||
    a.course.localeCompare(b.course));

  const body =
`/**
 * GENERATED FILE - do not edit by hand.
 * Source: tools/raw/midsem_venues_1.csv (venues) + tools/raw/midsem_venues_2.csv (dates/shifts)
 * Regenerate with: node tools/build-midsem.js
 *
 * The Mid-Sem schedule, one entry per course. Course name is intentionally
 * NOT included - it is looked up from data/timetable.js's course catalog at
 * render time, the same way timetable events already work.
 */
(function (global) {
  'use strict';

  var MIDSEM = {
    /** 10:00-11:30 and 15:00-16:30, exactly as published. Informational only
     * (each exam already carries its own resolved time/duration); kept here
     * so the shift definition has one home if it's ever needed again. */
    shifts: ${JSON.stringify({ 1: SHIFTS[1], 2: SHIFTS[2] }, null, 6).replace(/\n/g, '\n    ')},
    /**
     * Every Mid-Sem exam, one per course.
     *   id       - stable, content-derived ("midsem-<course>")
     *   course   - course code exactly as published
     *   date     - "YYYY-MM-DD"
     *   time     - 24h start time, "HH:MM"
     *   minutes  - start time as minutes since midnight (sortable)
     *   duration - length in minutes (90 for both shifts)
     *   shift    - 1 or 2, informational
     *   venue    - every allocated room for this course, comma-joined when
     *              there is more than one (roll-number-split sections)
     */
    exams: [
${exams.map((e) => '      ' + JSON.stringify(e)).join(',\n')}
    ]
  };

  global.MIDSEM_DATA = MIDSEM;
})(typeof globalThis !== 'undefined' ? globalThis : self);
`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body);

  console.log(`Wrote ${path.relative(ROOT, OUT)}`);
  console.log(`  courses: ${exams.length}`);
  console.log(`  multi-venue courses: ${exams.filter((e) => e.venue.indexOf(',') >= 0).length}`);
  const byShift = exams.reduce((a, e) => (a[e.shift] = (a[e.shift] || 0) + 1, a), {});
  console.log(`  by shift: ${JSON.stringify(byShift)}`);
  const byDate = exams.reduce((a, e) => (a[e.date] = (a[e.date] || 0) + 1, a), {});
  Object.keys(byDate).sort().forEach((d) => console.log(`  ${d}: ${byDate[d]}`));
}

main();
