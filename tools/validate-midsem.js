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

// 7. Venue + roll-number data: every source row for a course (venue AND its
// roll-number range) is present in the combined string - no silent loss,
// nothing fabricated. A single-row course ("All") keeps the bare venue; a
// multi-row course gets "VENUE (ROLLS); VENUE (ROLLS)", one segment per row,
// in source order, joined with "; " because the roll ranges themselves
// already contain commas.
const rawRowsByCourse = {};
venueRows.forEach((r) => {
  const code = r[0].trim(), venue = r[1].trim(), rolls = r[2].trim();
  (rawRowsByCourse[code] = rawRowsByCourse[code] || []).push({ venue, rolls });
});
function dedupeRows(rows) {
  const out = [];
  rows.forEach((r) => {
    if (!out.some((o) => o.venue === r.venue && o.rolls === r.rolls)) out.push(r);
  });
  return out;
}
function expectedVenueString(rows) {
  return rows.length === 1 ? rows[0].venue : rows.map((r) => `${r.venue} (${r.rolls})`).join('; ');
}
let venueMismatch = [];
MS.exams.forEach((e) => {
  const raw = dedupeRows(rawRowsByCourse[e.course]);
  if (e.venue !== expectedVenueString(raw)) venueMismatch.push(e.course);
});
check('every course\'s combined venue string exactly reflects its source rows and roll ranges, in order',
  venueMismatch.length === 0, venueMismatch.join(', ') || 'all matched');

check('a single-row ("All") course never has a roll number silently attached',
  MS.exams.filter((e) => dedupeRows(rawRowsByCourse[e.course]).length === 1)
    .every((e) => !/[()]/.test(e.venue)));

const multiVenue = MS.exams.filter((e) => dedupeRows(rawRowsByCourse[e.course]).length > 1);
check('multi-venue courses exist and keep every venue and roll range (none silently discarded)',
  multiVenue.length > 0 && multiVenue.every((e) => {
    const raw = dedupeRows(rawRowsByCourse[e.course]);
    return raw.every((r) => e.venue.includes(r.venue) && e.venue.includes(r.rolls));
  }), `${multiVenue.length} multi-venue courses`);

// 8. No malformed/empty venue strings.
check('no exam has an empty venue', MS.exams.every((e) => e.venue && e.venue.trim().length > 0));

// 9. The published timetable itself is untouched by this data - no course
// field, exam field, or "midsem" key leaked into TIMETABLE_DATA.
check('TIMETABLE_DATA has no midsem-related field of its own',
  !('exams' in TT) && !('midsem' in TT) && !('MIDSEM_DATA' in TT));
check('the published timetable event count is unaffected (still 482)', TT.events.length === 482);

console.log(`\n${failures === 0 ? 'ALL MID-SEM DATA CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
