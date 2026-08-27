/**
 * 2026 institute holidays - Today-tab awareness only.
 *
 * Deliberately its OWN file, separate from data/timetable.js: the published
 * class schedule (window.TIMETABLE_DATA) is never read from or written to by
 * holiday logic, and this list can be swapped for a future academic year by
 * replacing this one file - no timetable data and no app code need to change.
 *
 * Hand-maintained (not generated): there is no raw source to parse, so unlike
 * timetable.js this file is edited directly.
 *
 *   date - "YYYY-MM-DD", matched against the device's LOCAL calendar date
 *          (never UTC - see app.js localDateKey()). Specific to 2026; a date
 *          outside this list is simply not a holiday, on purpose (see
 *          Limitations in README.md).
 *   name - shown verbatim in the Today tab.
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
})(typeof globalThis !== 'undefined' ? globalThis : self);
