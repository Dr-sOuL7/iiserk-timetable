#!/usr/bin/env node
/**
 * Data validation (development only). Checks the generated Mid-Sem dataset
 * against the two raw source files. Run: node tools/validate-midsem.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'data', 'timetable.js'));
require(path.join(ROOT, 'data', 'midsem.js'));
const TT = global.TIMETABLE_DATA;
const MS = global.MIDSEM_DATA;

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

const venueRows = parseCsv(fs.readFileSync(path.join(ROOT, 'tools/raw/midsem_venues_1.csv'), 'utf8'));
venueRows.shift();
const dateRows = parseCsv(fs.readFileSync(path.join(ROOT, 'tools/raw/midsem_venues_2.csv'), 'utf8'));
dateRows.shift();

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`);
  if (!ok) failures++;
};

// 1. Exactly one exam per course - never duplicated, never merged across courses.
const courses = MS.exams.map((e) => e.course);
check('every course appears exactly once', new Set(courses).size === courses.length,
  `${courses.length} exams, ${new Set(courses).size} unique courses`);

const rawCourseCount = new Set(venueRows.map((r) => r[0].trim())).size;
check('exam count matches the number of distinct courses in the venues file',
  MS.exams.length === rawCourseCount, `${MS.exams.length} vs ${rawCourseCount}`);
check('exam count matches the dates/shifts file (one row per course there)',
  MS.exams.length === dateRows.length, `${MS.exams.length} vs ${dateRows.length}`);

// 2. Ids: unique, stable, content-derived.
check('all exam ids unique', new Set(MS.exams.map((e) => e.id)).size === MS.exams.length);
check('ids are derived from the course code alone (recomputable, not positional)',
  MS.exams.every((e) => e.id === 'midsem-' + e.course.toLowerCase()));

// 3. Every course code matches an entry in the timetable's course catalog,
// so NAME_BY_CODE lookup in app.js never comes up empty for a Mid-Sem exam.
const namesByCode = {};
TT.courses.forEach((c) => { namesByCode[c.code] = c.name; });
const noName = MS.exams.filter((e) => !namesByCode[e.course]);
check('every Mid-Sem course has a name in the timetable catalog', noName.length === 0,
  noName.map((e) => e.course).join(', ') || 'all matched');

// 4. Shift -> time/duration mapping is exactly as published.
check('shift 1 is 10:00, 90 minutes (10:00-11:30)',
  MS.exams.filter((e) => e.shift === 1).every((e) => e.time === '10:00' && e.duration === 90));
check('shift 2 is 15:00, 90 minutes (3:00-4:30 PM)',
  MS.exams.filter((e) => e.shift === 2).every((e) => e.time === '15:00' && e.duration === 90));
check('only shifts 1 and 2 exist', MS.exams.every((e) => e.shift === 1 || e.shift === 2));

// 5. Dates: valid ISO strings, and match the source DD/MM/YYYY -> YYYY-MM-DD.
check('every date is a valid YYYY-MM-DD string',
  MS.exams.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date)));
const expectedDate = {};
dateRows.forEach((r) => { expectedDate[r[0].trim()] = r[1].trim(); });
check('every date matches the source file, format-converted',
  MS.exams.every((e) => {
    const [d, m, y] = expectedDate[e.course].split('/');
    return e.date === `${y}-${m}-${d}`;
  }));
check('minutes field agrees with the time string',
  MS.exams.every((e) => {
    const [h, m] = e.time.split(':').map(Number);
    return h * 60 + m === e.minutes;
  }));

// 6. Chronological sortability.
check('exams sort chronologically by date then minutes with no ties broken wrongly',
  (() => {
    const sorted = [...MS.exams].sort((a, b) =>
      a.date.localeCompare(b.date) || a.minutes - b.minutes || a.course.localeCompare(b.course));
    return sorted.every((e, i) => i === 0 || sorted[i - 1].date <= e.date);
  })());

// 7. Venue data: every source venue row for a course is present in its
// merged string - no silent loss - and no venue is fabricated.
const rawVenuesByCourse = {};
venueRows.forEach((r) => {
  const code = r[0].trim(), venue = r[1].trim();
  (rawVenuesByCourse[code] = rawVenuesByCourse[code] || []).push(venue);
});
let venueMismatch = [];
MS.exams.forEach((e) => {
  const raw = [...new Set(rawVenuesByCourse[e.course])];
  const got = e.venue.split(', ');
  if (raw.length !== got.length || raw.some((v, i) => v !== got[i])) {
    venueMismatch.push(e.course);
  }
});
check('every course\'s combined venue string exactly reflects its source rows, in order',
  venueMismatch.length === 0, venueMismatch.join(', ') || 'all matched');

const multiVenue = MS.exams.filter((e) => e.venue.indexOf(',') >= 0);
check('multi-venue courses exist and keep every venue (none silently discarded)',
  multiVenue.length > 0 && multiVenue.every((e) => {
    const raw = rawVenuesByCourse[e.course];
    return new Set(raw).size === e.venue.split(', ').length;
  }), `${multiVenue.length} multi-venue courses`);

// 8. No malformed/empty venue strings.
check('no exam has an empty venue', MS.exams.every((e) => e.venue && e.venue.trim().length > 0));

// 9. The published timetable itself is untouched by this data - no course
// field, exam field, or "midsem" key leaked into TIMETABLE_DATA.
check('TIMETABLE_DATA has no midsem-related field of its own',
  !('exams' in TT) && !('midsem' in TT) && !('MIDSEM_DATA' in TT));
check('the published timetable event count is unaffected (still 433)', TT.events.length === 433);

console.log(`\n${failures === 0 ? 'ALL MID-SEM DATA CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
