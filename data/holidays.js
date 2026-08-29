/**
 * 2026 institute calendar - Today-tab awareness only.
 *
 * Deliberately its OWN file, separate from data/timetable.js: the published
 * class schedule (window.TIMETABLE_DATA) is never read from or written to by
 * this logic, and this list can be swapped for a future academic year by
 * replacing this one file - no timetable data and no app code need to change.
 *
 * Hand-maintained (not generated): there is no raw source to parse, so unlike
 * timetable.js this file is edited directly.
 *
 * Two arrays, both consumed by the same Today-tab calendar layer in app.js:
 *
 *   HOLIDAY_DATA - single-day holidays.
 *     date - "YYYY-MM-DD", matched against the device's LOCAL calendar date
 *            (never UTC - see app.js localDateKey()).
 *     name - shown verbatim in the Today tab.
 *
 *   BREAK_DATA - multi-day academic breaks (Autumn Break, Winter Vacation).
 *     start, end - "YYYY-MM-DD", inclusive at both ends.
 *     name - shown verbatim in the Today tab.
 *     A break takes precedence over a single-day holiday that falls inside
 *     it (Winter Vacation contains Christmas) - see app.js breakContext().
 *
 * Both are specific to 2026 (Winter Vacation runs into January 2027); a date
 * outside these lists is simply not a holiday/break, on purpose - see
 * Limitations in README.md. Zero-padded "YYYY-MM-DD" strings compare
 * correctly in plain string order, including across the year boundary, so no
 * date parsing is needed to test whether a day falls in a range.
 */
(function (global) {
  'use strict';

  global.HOLIDAY_DATA = [
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-08-26', name: 'Milad un-Nabi' },
    { date: '2026-10-02', name: 'Mahatma Gandhi Jayanti' },
    { date: '2026-10-19', name: 'Additional day for Dussehra' },
    { date: '2026-10-20', name: 'Dussehra' },
    { date: '2026-11-08', name: 'Diwali' },
    { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
    { date: '2026-12-25', name: 'Christmas' }
  ];

  global.BREAK_DATA = [
    { start: '2026-10-17', end: '2026-10-25', name: 'Autumn Break' },
    { start: '2026-12-13', end: '2027-01-03', name: 'Winter Vacation' }
  ];
})(typeof globalThis !== 'undefined' ? globalThis : self);
