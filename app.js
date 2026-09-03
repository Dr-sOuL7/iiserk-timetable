/**
 * IISER-K Timetable - UI logic.
 *
 * The dataset lives in data/timetable.js (global TIMETABLE_DATA) and this file
 * never hard-codes a class: everything below filters, sorts and renders that
 * one structure. Swapping semesters means replacing the data file only.
 */
(function () {
  'use strict';

  var DATA = window.TIMETABLE_DATA;
  var DAYS = DATA.days;
  var WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var DEPT_LABELS = {
    CH: 'Chemistry', CS: 'Computer Science', ES: 'Earth Science', HU: 'Humanities',
    LS: 'Life Science', MA: 'Mathematics', PH: 'Physics'
  };

  // ------------------------------------------------------------- holidays
  //
  // A Today-tab-only presentation layer. data/holidays.js (window.HOLIDAY_DATA,
  // window.BREAK_DATA) is a separate, hand-maintained file - never merged into
  // TIMETABLE_DATA, never used to filter or alter timetable events, and never
  // read by the Week view. Swapping academic years means replacing that file.
  var HOLIDAYS = window.HOLIDAY_DATA || [];
  var HOLIDAY_BY_DATE = {};
  HOLIDAYS.forEach(function (h) { HOLIDAY_BY_DATE[h.date] = h; });

  var BREAKS = window.BREAK_DATA || [];

  /**
   * "YYYY-MM-DD" from a JS Date using its LOCAL calendar fields.
   * Deliberately NOT toISOString() (which is UTC) - that could shift the
   * matched date by a day for an Indian user (UTC+5:30), e.g. treating
   * 00:15 IST on 15 Aug as still "14 Aug" and missing Independence Day.
   */
  function localDateKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  /** The holiday on `date`'s local calendar day, or null. Year-agnostic: a
   * date outside the loaded dataset (any year not currently maintained)
   * simply is not a holiday. */
  function holidayOn(date) {
    return HOLIDAY_BY_DATE[localDateKey(date)] || null;
  }

  /**
   * The academic break containing `date`'s local calendar day, or null.
   * Zero-padded "YYYY-MM-DD" strings compare correctly in plain string order
   * (including across the Dec/Jan year boundary that Winter Vacation spans),
   * so no date parsing or arithmetic is needed here.
   */
  function breakOn(date) {
    var key = localDateKey(date);
    for (var i = 0; i < BREAKS.length; i++) {
      if (key >= BREAKS[i].start && key <= BREAKS[i].end) return BREAKS[i];
    }
    return null;
  }

  /**
   * Today/tomorrow holiday status for the Today tab. Independent of
   * `computeNow()` on purpose: Week view's current/next-class highlighting
   * must stay byte-for-byte unchanged, so this never touches that function
   * or any shared selector - only renderToday() consumes it.
   */
  function holidayContext(now) {
    var today = holidayOn(now);
    var tomorrowDate = new Date(now.getTime());
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    // Only worth surfacing "tomorrow" when today itself isn't already the
    // headline state - otherwise the two notices would just duplicate.
    var tomorrow = today ? null : holidayOn(tomorrowDate);
    return { today: today, tomorrow: tomorrow, tomorrowDate: tomorrowDate };
  }

  /**
   * Today/starts-tomorrow break status for the Today tab, exactly mirroring
   * holidayContext() above (same independence from computeNow(), same
   * shape). Kept as a separate function rather than folded into
   * holidayContext() so neither function's existing, already-tested contract
   * has to change - renderToday() resolves the precedence between the two.
   */
  function breakContext(now) {
    var today = breakOn(now);
    var tomorrowDate = new Date(now.getTime());
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    // Ranges are contiguous, so if today is not in a break but tomorrow is,
    // tomorrow must be that break's first day - never its middle or end.
    var startsTomorrow = today ? null : breakOn(tomorrowDate);
    return { today: today, startsTomorrow: startsTomorrow, tomorrowDate: tomorrowDate };
  }

  var KEY_COURSES = 'iiserk.tt.courses.v1';
  var KEY_THEME = 'iiserk.tt.theme.v1';
  // Personal timetable edits/removals. Deliberately a SEPARATE key from the
  // course selection: resetting courses must not throw away customisations,
  // and re-selecting the same course brings its customisations back.
  var KEY_CUSTOM = 'iiserk.tt.custom.v1';
  // Mid-Sem edits (date/time/venue). A separate key again, for the same
  // reason KEY_CUSTOM is separate from KEY_COURSES - and separate from
  // KEY_CUSTOM too, since Mid-Sem exams are not timetable events and must
  // never be resettable/removable together with a class edit.
  var KEY_MIDSEM = 'iiserk.tt.midsem.v1';

  // ---------------------------------------------------------------- storage

  // localStorage throws in some privacy modes; the app must still run.
  var store = {
    get: function (k) {
      try { return window.localStorage.getItem(k); } catch (e) { return null; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; }
    },
    remove: function (k) {
      try { window.localStorage.removeItem(k); return true; } catch (e) { return false; }
    }
  };

  function loadSelection() {
    var raw = store.get(KEY_COURSES);
    if (raw === null) return null;              // never configured
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      var valid = {};
      DATA.courses.forEach(function (c) { valid[c.code] = true; });
      return parsed.filter(function (c) { return valid[c]; });   // drop stale codes
    } catch (e) {
      return null;
    }
  }

  function saveSelection(codes) {
    return store.set(KEY_COURSES, JSON.stringify(codes));
  }

  // ------------------------------------------------- user customisation layer

  /*
   * window.TIMETABLE_DATA is the authoritative published timetable and is never
   * written to (it is frozen at start-up). Personal changes live in their own
   * localStorage entry as a thin layer on top:
   *
   *     TIMETABLE_DATA.events            (immutable, 433 published classes)
   *            +  overrides              (sparse per-event field patches)
   *            -  removed                (ids the user hid)
   *            =  effectiveEvents()      (what the app displays)
   *
   * Overrides are SPARSE - only the fields that differ from the published event
   * are stored - so if a future dataset corrects, say, a room, that correction
   * still reaches a user who had only edited the time.
   *
   * Shape: { version: 1, overrides: { <eventId>: {day,time,course,name,type,room,duration} },
   *          removed: [<eventId>, ...] }
   */
  var EDITABLE_FIELDS = ['day', 'time', 'course', 'name', 'type', 'room', 'duration'];
  var TYPES = ['Theory', 'Tutorial', 'Lab'];
  // Sanity bounds on a manually-entered duration, not a claim about any real
  // class - wide enough for a five-minute check-in or a full-day workshop.
  var MIN_DURATION_MINUTES = 5;
  var MAX_DURATION_MINUTES = 600;

  var custom = { overrides: {}, removed: [] };

  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

  /**
   * Read and sanitise the stored customisations. Anything malformed, unknown or
   * of the wrong type is dropped rather than trusted, so a corrupted entry
   * degrades to "no customisations" instead of breaking the app.
   */
  function loadCustom() {
    var out = { overrides: {}, removed: [] };
    var raw = store.get(KEY_CUSTOM);
    if (!raw) return out;

    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return out; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out;

    var src = parsed.overrides;
    if (src && typeof src === 'object' && !Array.isArray(src)) {
      Object.keys(src).forEach(function (id) {
        var patch = src[id];
        if (!id || !patch || typeof patch !== 'object' || Array.isArray(patch)) return;
        var clean = {};
        EDITABLE_FIELDS.forEach(function (f) {
          if (f === 'duration') {
            var d = patch[f];
            if (typeof d === 'number' && Number.isInteger(d) &&
                d >= MIN_DURATION_MINUTES && d <= MAX_DURATION_MINUTES) {
              clean[f] = d;
            }
            return;
          }
          if (typeof patch[f] === 'string') clean[f] = patch[f];
        });
        if (clean.day && DAYS.indexOf(clean.day) < 0) delete clean.day;
        if (clean.type && TYPES.indexOf(clean.type) < 0) delete clean.type;
        if (clean.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean.time)) delete clean.time;
        if (Object.keys(clean).length) out.overrides[id] = clean;
      });
    }

    if (Array.isArray(parsed.removed)) {
      parsed.removed.forEach(function (id) {
        if (typeof id === 'string' && id && out.removed.indexOf(id) < 0) out.removed.push(id);
      });
    }
    return out;
  }

  function saveCustom() {
    invalidateEffective();
    if (!Object.keys(custom.overrides).length && !custom.removed.length) {
      store.remove(KEY_CUSTOM);
      return true;
    }
    return store.set(KEY_CUSTOM, JSON.stringify({
      version: 1, overrides: custom.overrides, removed: custom.removed
    }));
  }

  function customCount() {
    return {
      edited: Object.keys(custom.overrides).length,
      removed: custom.removed.length
    };
  }

  function hasCustomisations() {
    var c = customCount();
    return c.edited + c.removed > 0;
  }

  // --- effective (published + personal) event list, rebuilt only when changed

  var effectiveCache = null;
  function invalidateEffective() { effectiveCache = null; }

  function pick(patch, key, fallback) {
    return patch && has(patch, key) ? patch[key] : fallback;
  }

  /** The published timetable with the user's layer applied. Never mutates DATA. */
  function effectiveEvents() {
    if (effectiveCache) return effectiveCache;

    var removed = {};
    custom.removed.forEach(function (id) { removed[id] = true; });

    var out = [];
    DATA.events.forEach(function (o) {
      if (removed[o.id]) return;
      var patch = custom.overrides[o.id] || null;

      var time = pick(patch, 'time', o.time);
      var type = pick(patch, 'type', o.type);
      var course = pick(patch, 'course', o.course);
      var parts = time.split(':');

      out.push({
        id: o.id,
        // Course filtering uses the PUBLISHED code, never the edited one - see
        // eventsFor() for why.
        originalCourse: o.course,
        day: pick(patch, 'day', o.day),
        time: time,
        minutes: (+parts[0]) * 60 + (+parts[1]),
        // Duration precedence, highest first:
        //   1. an explicit duration override - the user knows better than any
        //      table and this always wins, even over a built-in exception;
        //   2. the new type's standard length, but only when the TYPE was
        //      edited and duration was not - there is no way to guess an
        //      exception for a type the user picked themselves;
        //   3. the published duration - almost always the type's standard
        //      length, but some classes (e.g. Wed 13:30 CS2102, a Theory that
        //      actually runs a 160-minute lab-length block) genuinely differ,
        //      and that real length must survive untouched edits.
        duration: pick(patch, 'duration',
          (patch && has(patch, 'type') && patch.type !== o.type)
            ? (DATA.durations[type] || o.duration)
            : o.duration),
        course: course,
        // With no explicit name override the name tracks the course code, so
        // changing only the code still shows the right title.
        name: pick(patch, 'name', NAME_BY_CODE[course] || ''),
        type: type,
        room: pick(patch, 'room', o.room),
        modified: !!patch
      });
    });

    effectiveCache = out;
    return out;
  }

  function effectiveById(id) {
    var all = effectiveEvents();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function originalById(id) {
    for (var i = 0; i < DATA.events.length; i++) {
      if (DATA.events[i].id === id) return DATA.events[i];
    }
    return null;
  }

  // --- mutations (each persists immediately)

  function removeEvent(id) {
    if (custom.removed.indexOf(id) < 0) custom.removed.push(id);
    delete custom.overrides[id];     // a hidden class needs no field patch
    return saveCustom();
  }

  function restoreEvent(id) {
    delete custom.overrides[id];
    var i = custom.removed.indexOf(id);
    if (i >= 0) custom.removed.splice(i, 1);
    return saveCustom();
  }

  /**
   * Store `values` as a sparse patch against the published event. Fields equal
   * to the published value are not stored, and an edit that restores every
   * field drops the override entirely.
   */
  function saveOverride(id, values) {
    var orig = originalById(id);
    if (!orig) return false;

    var typeChanged = has(values, 'type') && values.type !== orig.type;
    var patch = {};
    EDITABLE_FIELDS.forEach(function (f) {
      if (!has(values, f)) return;
      var base;
      if (f === 'name') base = NAME_BY_CODE[values.course || orig.course] || '';
      else if (f === 'duration') base = typeChanged ? (DATA.durations[values.type] || orig.duration) : orig.duration;
      else base = orig[f];
      if (values[f] !== base) patch[f] = values[f];
    });

    if (Object.keys(patch).length) custom.overrides[id] = patch;
    else delete custom.overrides[id];
    return saveCustom();
  }

  function resetCustomisations() {
    custom = { overrides: {}, removed: [] };
    return saveCustom();
  }

  // ------------------------------------------------------------ Mid-Sem data
  //
  // data/midsem.js (window.MIDSEM_DATA) is bundled, immutable source data -
  // one exam per course, no network dependency - exactly like TIMETABLE_DATA.
  // Personal edits (date/time/venue only; course code/name are read-only and
  // always come from MIDSEM_DATA + NAME_BY_CODE) live in their own
  // localStorage layer, the same sparse-overrides shape as the timetable
  // customisation layer above but under a separate key: resetting timetable
  // edits must never touch Mid-Sem edits, and vice versa.
  var MIDSEM = window.MIDSEM_DATA || { shifts: {}, exams: [] };
  var MIDSEM_EDITABLE_FIELDS = ['date', 'time', 'venue'];

  var midsemCustom = { overrides: {} };

  function loadMidsemCustom() {
    var out = { overrides: {} };
    var raw = store.get(KEY_MIDSEM);
    if (!raw) return out;

    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return out; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out;

    var src = parsed.overrides;
    if (src && typeof src === 'object' && !Array.isArray(src)) {
      Object.keys(src).forEach(function (id) {
        var patch = src[id];
        if (!id || !patch || typeof patch !== 'object' || Array.isArray(patch)) return;
        var clean = {};
        if (typeof patch.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(patch.date)) clean.date = patch.date;
        if (typeof patch.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(patch.time)) clean.time = patch.time;
        if (typeof patch.venue === 'string' && patch.venue.trim()) clean.venue = patch.venue;
        if (Object.keys(clean).length) out.overrides[id] = clean;
      });
    }
    return out;
  }

  var midsemEffectiveCache = null;
  function invalidateMidsemEffective() { midsemEffectiveCache = null; }

  function saveMidsemCustom() {
    invalidateMidsemEffective();
    if (!Object.keys(midsemCustom.overrides).length) {
      store.remove(KEY_MIDSEM);
      return true;
    }
    return store.set(KEY_MIDSEM, JSON.stringify({ version: 1, overrides: midsemCustom.overrides }));
  }

  function midsemCustomCount() {
    return Object.keys(midsemCustom.overrides).length;
  }

  function midsemOriginalById(id) {
    for (var i = 0; i < MIDSEM.exams.length; i++) {
      if (MIDSEM.exams[i].id === id) return MIDSEM.exams[i];
    }
    return null;
  }

  /**
   * Every Mid-Sem exam with edits applied, course name resolved and a sortable
   * `minutes` derived - unfiltered by course selection. Mirrors
   * effectiveEvents() in shape and in never mutating MIDSEM.
   */
  function allEffectiveMidsemExams() {
    if (midsemEffectiveCache) return midsemEffectiveCache;

    var out = MIDSEM.exams.map(function (o) {
      var patch = midsemCustom.overrides[o.id] || null;
      var time = pick(patch, 'time', o.time);
      var parts = time.split(':');
      return {
        id: o.id,
        course: o.course,
        name: NAME_BY_CODE[o.course] || '',
        date: pick(patch, 'date', o.date),
        time: time,
        minutes: (+parts[0]) * 60 + (+parts[1]),
        duration: o.duration,
        venue: pick(patch, 'venue', o.venue),
        modified: !!patch
      };
    });

    midsemEffectiveCache = out;
    return out;
  }

  /**
   * The Mid-Sem exams for the courses the user has selected, one per course,
   * in chronological order - what the Mid-Sem card and full schedule show,
   * and what the Today suppression logic below checks against.
   */
  function effectiveMidsemExams(selected) {
    return allEffectiveMidsemExams()
      .filter(function (e) { return selected.has(e.course); })
      .sort(function (a, b) {
        return a.date.localeCompare(b.date) || a.minutes - b.minutes || a.course.localeCompare(b.course);
      });
  }

  /**
   * Store `values` (date/time/venue) as a sparse patch against the published
   * exam. Course code and name are never part of `values` - they are not
   * editable fields for a Mid-Sem entry.
   */
  function saveMidsemOverride(id, values) {
    var orig = midsemOriginalById(id);
    if (!orig) return false;

    var patch = {};
    MIDSEM_EDITABLE_FIELDS.forEach(function (f) {
      if (has(values, f) && values[f] !== orig[f]) patch[f] = values[f];
    });

    if (Object.keys(patch).length) midsemCustom.overrides[id] = patch;
    else delete midsemCustom.overrides[id];
    return saveMidsemCustom();
  }

  function resetMidsemCustomisations() {
    midsemCustom = { overrides: {} };
    return saveMidsemCustom();
  }

  /** The end minute of an exam's interval, for overlap checks. */
  function midsemExamEnd(e) { return e.minutes + e.duration; }

  /** True if event `e`'s [minutes, minutes+duration) interval overlaps any of `intervals`. */
  function overlapsAnyInterval(e, intervals) {
    return intervals.some(function (iv) { return e.minutes < iv.end && e.minutes + e.duration > iv.start; });
  }

  /**
   * The selected-course Mid-Sem exam intervals active on the calendar date
   * `dateKey` ("YYYY-MM-DD"), using the user's edited date/time. Empty on any
   * date with no Mid-Sem exam for a selected course.
   */
  function midsemIntervalsOn(selected, dateKey) {
    return effectiveMidsemExams(selected)
      .filter(function (e) { return e.date === dateKey; })
      .map(function (e) { return { start: e.minutes, end: midsemExamEnd(e) }; });
  }

  /**
   * Current + next selected-course Mid-Sem exam, from the device clock.
   * `all` is the full chronological list (used to decide whether the Mid-Sem
   * card has anything to show at all).
   */
  function midsemContext(selected, now) {
    var todayKey = localDateKey(now);
    var nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    var exams = effectiveMidsemExams(selected);

    var current = exams.filter(function (e) {
      return e.date === todayKey && nowMin >= e.minutes && nowMin < midsemExamEnd(e);
    });

    var next = null;
    for (var i = 0; i < exams.length; i++) {
      var e = exams[i];
      if (e.date > todayKey || (e.date === todayKey && e.minutes > nowMin)) { next = e; break; }
    }

    return { current: current, next: next, all: exams };
  }

  // ------------------------------------------------------------------ state

  var state = {
    selected: null,      // Set of course codes, or null when not configured yet
    draft: null,         // Set being edited on the selection screen
    editing: false,      // true when "Change courses" opened the picker
    view: 'today',
    weekDay: null,
    dept: 'ALL',
    query: '',
    theme: store.get(KEY_THEME) || 'auto'
  };

  var $ = function (id) { return document.getElementById(id); };

  // ------------------------------------------------------------- formatting

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** "1 class" / "3 classes" - handles the sibilant endings the UI uses. */
  function plural(n, word) {
    if (n === 1) return n + ' ' + word;
    return n + ' ' + word + (/(s|x|z|ch|sh)$/.test(word) ? 'es' : 's');
  }

  /** Human duration: "45 minutes", "1 h 20 min". */
  function humanDuration(mins) {
    mins = Math.max(0, Math.round(mins));
    if (mins < 1) return 'less than a minute';
    if (mins < 60) return plural(mins, 'minute');
    var h = Math.floor(mins / 60), m = mins % 60;
    return m === 0 ? plural(h, 'hour') : h + ' h ' + m + ' min';
  }

  var NAME_BY_CODE = {};
  DATA.courses.forEach(function (c) { NAME_BY_CODE[c.code] = c.name; });

  // -------------------------------------------------------- data selectors

  /**
   * All events for a day belonging to `selected`, chronologically.
   *
   * Filtering deliberately tests `originalCourse` (the published code) rather
   * than the possibly-edited one. If you edit a PH3102 class and change its
   * code to PH4101, the class is still *your* edit of a PH3102 slot, so it
   * stays visible and manageable while PH3102 is selected instead of silently
   * vanishing because PH4101 was never selected.
   */
  function eventsFor(day, selected) {
    return effectiveEvents()
      .filter(function (e) { return e.day === day && selected.has(e.originalCourse); })
      .sort(function (a, b) {
        return a.minutes - b.minutes ||
               a.course.localeCompare(b.course) ||
               a.type.localeCompare(b.type);
      });
  }

  /** Day name for a JS Date, or null on Sat/Sun (no classes are scheduled). */
  function teachingDay(date) {
    var name = WEEKDAY_NAMES[date.getDay()];
    return DAYS.indexOf(name) >= 0 ? name : null;
  }

  /**
   * The forward day-by-day scan shared by computeNow() and the Today-tab's
   * break-aware next-class lookup below. `skip(date)`, when given, excludes
   * a whole day from the scan regardless of what the timetable says - used
   * to skip academic breaks without computeNow() itself ever knowing they
   * exist (Week view depends on computeNow() and must not change).
   * `filterCandidates(date, list)`, when given, narrows a day's candidates
   * further still - used for Mid-Sem suppression, which cancels only the
   * overlapping time slot rather than the whole day. Both hooks are optional
   * and unused by computeNow()'s own (Week-shared) call.
   */
  function scanForNext(selected, now, nowMin, dayLimit, skip, filterCandidates) {
    var next = [], nextOffset = 0;
    for (var offset = 0; offset <= dayLimit && !next.length; offset++) {
      var d = new Date(now.getTime());
      d.setDate(d.getDate() + offset);
      if (skip && skip(d)) continue;
      var dayName = teachingDay(d);
      if (!dayName) continue;
      var candidates = eventsFor(dayName, selected).filter(function (e) {
        return offset > 0 || e.minutes > nowMin;
      });
      if (filterCandidates) candidates = filterCandidates(d, candidates);
      if (!candidates.length) continue;
      var first = candidates[0].minutes;
      next = candidates.filter(function (e) { return e.minutes === first; });
      nextOffset = offset;
    }

    // Measure the gap on the real calendar so DST shifts stay correct.
    var startsIn = null;
    if (next.length) {
      var target = new Date(now.getTime());
      target.setDate(target.getDate() + nextOffset);
      target.setHours(Math.floor(next[0].minutes / 60), next[0].minutes % 60, 0, 0);
      startsIn = (target.getTime() - now.getTime()) / 60000;
    }
    return { next: next, nextOffset: nextOffset, startsIn: startsIn };
  }

  /**
   * Current + next class from the device clock.
   * Looks up to 7 days ahead so Friday evening correctly points at Monday.
   */
  function computeNow(selected, now) {
    var nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    var today = teachingDay(now);

    var current = [];
    if (today) {
      current = eventsFor(today, selected).filter(function (e) {
        return nowMin >= e.minutes && nowMin < e.minutes + e.duration;
      });
    }

    var scan = scanForNext(selected, now, nowMin, 7, null);

    return {
      today: today,
      nowMin: nowMin,
      current: current,
      remaining: current.length ? (current[0].minutes + current[0].duration - nowMin) : null,
      elapsed: current.length ? (nowMin - current[0].minutes) : null,
      next: scan.next,
      nextOffset: scan.nextOffset,
      startsIn: scan.startsIn
    };
  }

  // Breaks can run several weeks (Winter Vacation is 22 days); scan well
  // beyond the longest configured break plus a full week, to guarantee
  // finding a real class once the break has ended.
  var NEXT_SCAN_DAYS_SKIPPING_BREAKS = 40;

  /**
   * Today-tab-only: the next class, treating every day inside an academic
   * break as if it had no events at all, regardless of what the timetable
   * says. Never used by Week view or by computeNow() - see scanForNext().
   */
  function computeNextSkippingBreaks(selected, now) {
    var nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    return scanForNext(selected, now, nowMin, NEXT_SCAN_DAYS_SKIPPING_BREAKS, breakOn);
  }

  /**
   * A day's candidates with any Mid-Sem-overlapping slot removed - "no
   * regular classes during a Mid-Sem examination period" (see
   * midsemIntervalsOn()). A plain filterCandidates hook for scanForNext();
   * never used by computeNow() or Week, exactly like computeNextSkippingBreaks
   * above.
   */
  function suppressMidsemCandidates(selected) {
    return function (date, candidates) {
      var intervals = midsemIntervalsOn(selected, localDateKey(date));
      if (!intervals.length) return candidates;
      return candidates.filter(function (e) { return !overlapsAnyInterval(e, intervals); });
    };
  }

  /**
   * Today-tab-only: computeNow(), but with any class that overlaps an active
   * Mid-Sem exam (for a selected course) removed from "current" - a genuine
   * date/time interval overlap, never a course-code match, per the "no
   * regular classes during Mid-Sem" rule. Never touches computeNow() itself,
   * so Week view (which calls computeNow() directly) is unaffected.
   */
  function computeNowWithMidsem(selected, now) {
    var nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    var today = teachingDay(now);
    var intervals = midsemIntervalsOn(selected, localDateKey(now));

    var current = [];
    if (today) {
      current = eventsFor(today, selected).filter(function (e) {
        return nowMin >= e.minutes && nowMin < e.minutes + e.duration;
      });
      if (intervals.length) current = current.filter(function (e) { return !overlapsAnyInterval(e, intervals); });
    }

    var scan = scanForNext(selected, now, nowMin, 7, null, suppressMidsemCandidates(selected));

    return {
      today: today,
      nowMin: nowMin,
      current: current,
      remaining: current.length ? (current[0].minutes + current[0].duration - nowMin) : null,
      elapsed: current.length ? (nowMin - current[0].minutes) : null,
      next: scan.next,
      nextOffset: scan.nextOffset,
      startsIn: scan.startsIn
    };
  }

  /**
   * Today-tab-only: the "Next" card's lookup, skipping both academic breaks
   * and any slot suppressed by an active Mid-Sem exam - the union of
   * computeNextSkippingBreaks() and computeNowWithMidsem()'s scan, kept as
   * its own function so neither of those two (already independently used
   * and tested) has to change.
   */
  function computeNextSkippingBreaksAndMidsem(selected, now) {
    var nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    return scanForNext(selected, now, nowMin, NEXT_SCAN_DAYS_SKIPPING_BREAKS, breakOn, suppressMidsemCandidates(selected));
  }

  // ------------------------------------------------------------- rendering

  var PIN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>';

  var DOTS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.1"/>' +
    '<circle cx="12" cy="12" r="1.1"/><circle cx="12" cy="19" r="1.1"/></svg>';

  function eventHtml(e, status) {
    return '' +
      '<article class="event' + (status ? ' is-' + status : '') + '">' +
        '<div class="rail">' +
          '<div class="time">' + esc(e.time) + '</div>' +
          '<div class="dur">' + e.duration + ' min</div>' +
        '</div>' +
        '<div class="body">' +
          '<div class="top">' +
            '<span class="code">' + esc(e.course) + '</span>' +
            '<span class="badge ' + e.type + '">' + esc(e.type) + '</span>' +
            (status === 'now' ? '<span class="badge live">Now</span>' : '') +
            (e.modified ? '<span class="edited-flag">Edited</span>' : '') +
          '</div>' +
          (e.name ? '<div class="cname">' + esc(e.name) + '</div>' : '') +
          '<div class="room">' + PIN_SVG + '<span>' + esc(e.room) + '</span></div>' +
        '</div>' +
        '<button type="button" class="evt-menu" data-evt="' + esc(e.id) + '" ' +
          'aria-label="Options for ' + esc(e.course) + ' at ' + esc(e.time) + '">' +
          DOTS_SVG +
        '</button>' +
      '</article>';
  }

  function emptyHtml(title, body, action) {
    return '' +
      '<div class="empty">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/>' +
        '<path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/></svg>' +
        '<strong>' + esc(title) + '</strong>' +
        '<p>' + esc(body) + '</p>' +
        (action || '') +
      '</div>';
  }

  /**
   * Today itself is a holiday. This fully REPLACES the current/next card and
   * the day's class list (below, in renderToday()) - showing a "Next class"
   * next to it would misleadingly suggest something is happening today.
   */
  function holidayTodayCardHtml(h) {
    return '' +
      '<div class="now-card holiday">' +
        '<div class="now-label">Holiday today</div>' +
        '<div class="holiday-name">' + esc(h.name) + '</div>' +
        '<div class="now-empty">No regular classes today.</div>' +
      '</div>';
  }

  // Built from fixed name tables, not toLocaleDateString(): the required
  // wording is "Saturday, 15 August" (day before month, no year), and
  // Intl's day/month ordering for a given locale tag is not guaranteed
  // consistent across browser engines - confirmed different between Node's
  // and Chromium's ICU for the same 'en-IN' tag. This is deterministic.
  function weekdayDate(date) {
    return WEEKDAY_NAMES[date.getDay()] + ', ' + date.getDate() + ' ' + MONTH_NAMES[date.getMonth()];
  }

  /** "D Month", no weekday or year - for the compact break date-range line. */
  function shortDate(date) {
    return date.getDate() + ' ' + MONTH_NAMES[date.getMonth()];
  }

  /**
   * Today is a normal day but tomorrow is a holiday. Compact, and placed
   * ABOVE the normal current/next card - it never replaces today's classes.
   */
  function holidayTomorrowCardHtml(h, date) {
    return '' +
      '<div class="now-card holiday">' +
        '<div class="now-label">Tomorrow is a holiday</div>' +
        '<div class="holiday-name">' + esc(h.name) + '</div>' +
        '<div class="now-empty">' + esc(weekdayDate(date)) + '</div>' +
      '</div>';
  }

  /**
   * Today falls inside an academic break. Reuses the exact same card as
   * holidayTodayCardHtml() - a break and a single-day holiday are the same
   * "no classes, informational" family of state - and, like it, fully
   * REPLACES the current/next card and the day's class list.
   *
   * The resume date doubles as the "does the break end today/tomorrow"
   * signal: on the break's last day, resumeDate is by construction tomorrow,
   * and the phrase says so directly rather than spelling out a date the
   * reader already knows is "tomorrow" - no separate UI state is needed for
   * that case, it falls out of this one naturally.
   */
  function breakTodayCardHtml(b, now) {
    var resumeDate = new Date(b.end + 'T00:00:00');
    resumeDate.setDate(resumeDate.getDate() + 1);
    var isLastDay = localDateKey(now) === b.end;
    var resumeWhen = isLastDay ? 'tomorrow' : weekdayDate(resumeDate);
    return '' +
      '<div class="now-card holiday">' +
        '<div class="now-label">On break</div>' +
        '<div class="holiday-name">' + esc(b.name) + '</div>' +
        '<div class="now-empty">No regular classes. Classes resume ' + esc(resumeWhen) + '.</div>' +
      '</div>';
  }

  /**
   * Today is a normal day but a break starts tomorrow. Compact, placed
   * ABOVE the normal current/next card - never hides today's real classes.
   */
  function breakTomorrowCardHtml(b) {
    var start = new Date(b.start + 'T00:00:00');
    var end = new Date(b.end + 'T00:00:00');
    var range = shortDate(start) + ' – ' + shortDate(end);
    return '' +
      '<div class="now-card holiday">' +
        '<div class="now-label">Break starts tomorrow</div>' +
        '<div class="holiday-name">' + esc(b.name) + '</div>' +
        '<div class="now-empty">' + esc(range) + '</div>' +
      '</div>';
  }

  function nowCardHtml(info) {
    if (!state.selected.size) return '';
    var html = '';

    if (info.current.length === 1) {
      var e = info.current[0];
      var pct = Math.min(100, Math.max(0, (info.elapsed / e.duration) * 100));
      html +=
        '<div class="now-card live">' +
          '<div class="now-label"><span class="dot"></span>Current class</div>' +
          '<div class="now-course"><span class="now-code">' + esc(e.course) + '</span>' +
            '<span class="badge ' + e.type + '">' + esc(e.type) + '</span></div>' +
          (e.name ? '<div class="now-name">' + esc(e.name) + '</div>' : '') +
          '<div class="now-where">' + PIN_SVG + '<span>' + esc(e.room) + '</span>' +
            '<span>&middot;</span><span>' + esc(e.time) + '</span></div>' +
          '<div class="now-remain">' + esc(humanDuration(info.remaining)) + ' remaining</div>' +
          '<div class="progress"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '</div>';
    } else if (info.current.length > 1) {
      // Clashing classes share one card rather than stacking full-size cards,
      // which would push the far more useful "next" card off the screen.
      html +=
        '<div class="now-card live">' +
          '<div class="now-label"><span class="dot"></span>Current class' +
            '<span class="now-count">' + info.current.length + ' at once</span></div>' +
          info.current.map(function (e) {
            var left = e.minutes + e.duration - info.nowMin;
            return '<div class="now-row">' +
              '<span class="now-row-code">' + esc(e.course) + '</span>' +
              '<span class="badge ' + e.type + '">' + esc(e.type) + '</span>' +
              '<span class="now-row-room">' + esc(e.room) + '</span>' +
              '<span class="now-row-left">' + esc(humanDuration(left)) + ' left</span>' +
            '</div>';
          }).join('') +
        '</div>';
    }

    if (info.next.length) {
      var n = info.next[0];
      var when;
      if (info.nextOffset === 0) when = 'in ' + humanDuration(info.startsIn);
      else if (info.nextOffset === 1) when = 'tomorrow';
      else when = 'on ' + n.day;
      html +=
        '<div class="now-card">' +
          '<div class="now-label">Next' + (info.current.length ? '' : ' class') + '</div>' +
          '<div class="now-course"><span class="now-code">' + esc(n.time) + '</span>' +
            // A class on another day gets its day up next to the time, so
            // "not today" is obvious at a glance rather than only in the
            // "Starts ..." line below.
            (info.nextOffset > 0
              ? '<span class="now-day">' + esc(info.nextOffset === 1 ? 'Tomorrow' : n.day) + '</span>'
              : '') +
            '<span class="badge ' + n.type + '">' + esc(n.type) + '</span></div>' +
          '<div class="now-name"><strong>' + esc(n.course) + '</strong>' +
            (n.name ? ' &middot; ' + esc(n.name) : '') + '</div>' +
          '<div class="now-where">' + PIN_SVG + '<span>' + esc(n.room) + '</span></div>' +
          '<div class="now-remain">Starts ' + esc(when) + '</div>' +
          (info.next.length > 1
            ? '<div class="now-empty">+ ' + plural(info.next.length - 1, 'other class') + ' at the same time</div>'
            : '') +
        '</div>';
    } else if (info.current.length === 0) {
      html +=
        '<div class="now-card">' +
          '<div class="now-label">Nothing scheduled</div>' +
          '<div class="now-empty">No upcoming classes for your selected courses.</div>' +
        '</div>';
    }

    return html;
  }

  /** "Today" / "Tomorrow" / "Saturday, 15 August" for a Mid-Sem exam's date. */
  function midsemDateLabel(dateStr, now) {
    if (dateStr === localDateKey(now)) return 'Today';
    var tomorrow = new Date(now.getTime());
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === localDateKey(tomorrow)) return 'Tomorrow';
    return weekdayDate(new Date(dateStr + 'T00:00:00'));
  }

  function midsemLinkHtml() {
    return '<button type="button" class="link-btn midsem-link" data-action="midsem-full">' +
      'View full Mid-Sem schedule</button>';
  }

  /**
   * The Today-tab Mid-Sem card: current exam(s) first, else the next
   * upcoming one, else (courses selected have exams but none remain) a
   * closing note - and always, when there is any Mid-Sem data for the
   * selected courses at all, a way into the full schedule/editor. Returns ''
   * when no selected course has a Mid-Sem exam, so the card simply does not
   * appear rather than showing an empty shell.
   */
  function midsemCardHtml(ctx, now) {
    if (!state.selected.size || !ctx.all.length) return '';

    if (ctx.current.length === 1) {
      var e = ctx.current[0];
      return '' +
        '<div class="midsem-card live">' +
          '<div class="now-label"><span class="dot"></span>Mid-Sem exam now</div>' +
          '<div class="now-course"><span class="now-code">' + esc(e.course) + '</span></div>' +
          (e.name ? '<div class="now-name">' + esc(e.name) + '</div>' : '') +
          '<div class="now-where">' + PIN_SVG + '<span>' + esc(e.venue) + '</span>' +
            '<span>&middot;</span><span>' + esc(e.time) + '</span></div>' +
          midsemLinkHtml() +
        '</div>';
    }

    if (ctx.current.length > 1) {
      // Two selected courses can share an exam slot (same date + shift) -
      // shown as compact rows in one card, mirroring the concurrent-class
      // treatment in nowCardHtml().
      return '' +
        '<div class="midsem-card live">' +
          '<div class="now-label"><span class="dot"></span>Mid-Sem exams now' +
            '<span class="now-count">' + ctx.current.length + ' at once</span></div>' +
          ctx.current.map(function (e) {
            return '<div class="now-row">' +
              '<span class="now-row-code">' + esc(e.course) + '</span>' +
              '<span class="now-row-room">' + esc(e.venue) + '</span>' +
            '</div>';
          }).join('') +
          midsemLinkHtml() +
        '</div>';
    }

    if (ctx.next) {
      var n = ctx.next;
      return '' +
        '<div class="midsem-card">' +
          '<div class="now-label">Next Mid-Sem exam</div>' +
          '<div class="now-course"><span class="now-code">' + esc(n.course) + '</span></div>' +
          (n.name ? '<div class="now-name">' + esc(n.name) + '</div>' : '') +
          '<div class="now-where">' + PIN_SVG + '<span>' + esc(n.venue) + '</span></div>' +
          '<div class="now-remain">' + esc(midsemDateLabel(n.date, now)) + ' &middot; ' + esc(n.time) + '</div>' +
          midsemLinkHtml() +
        '</div>';
    }

    return '' +
      '<div class="midsem-card">' +
        '<div class="now-label">Mid-Sem</div>' +
        '<div class="now-empty">No more Mid-Sem exams for your courses.</div>' +
        midsemLinkHtml() +
      '</div>';
  }

  function sameEvent(list, e) {
    for (var i = 0; i < list.length; i++) if (list[i].id === e.id) return true;
    return false;
  }

  function statusFor(e, info, isToday) {
    if (!isToday) return '';
    if (sameEvent(info.current, e)) return 'now';
    if (info.nextOffset === 0 && sameEvent(info.next, e)) return 'next';
    var nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    return e.minutes + e.duration <= nowMin ? 'past' : '';
  }

  function renderToday() {
    var now = new Date();
    var info = computeNow(state.selected, now);
    var brk = breakContext(now);
    var hol = holidayContext(now);

    $('date-line').textContent = now.toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // The "Next" line specifically must skip whole days that fall inside an
    // upcoming break (e.g. scanning forward from just before a break starts),
    // even on a day that isn't itself special in any other way, and must
    // skip any slot that overlaps an active Mid-Sem exam - "no regular
    // classes during a Mid-Sem examination period". Neither touches
    // computeNow()'s own current/next - eventsFor()/statusFor() below keep
    // using the raw `info` - so Week view is completely unaffected: it never
    // renders this card and only reads computeNow()'s original output.
    var midsemNow = computeNowWithMidsem(state.selected, now);
    var nextSkip = computeNextSkippingBreaksAndMidsem(state.selected, now);
    var cardInfo = {
      today: info.today, nowMin: info.nowMin, current: midsemNow.current,
      remaining: midsemNow.remaining, elapsed: midsemNow.elapsed,
      next: nextSkip.next, nextOffset: nextSkip.nextOffset, startsIn: nextSkip.startsIn
    };

    // Precedence (a break is the coarser, more encompassing state, so it
    // wins over a single-day holiday nested inside it - Winter Vacation
    // contains Christmas): break-today > holiday-today > break-starts-
    // tomorrow > holiday-tomorrow > normal. Today-in-a-break/holiday replaces
    // the current/next card outright (never alongside it - that would risk
    // implying a class is still imminent). All of these are date-only and
    // shown regardless of course selection, the same way the date line above
    // is; nowCardHtml() already no-ops itself when no courses are selected.
    if (brk.today) {
      $('now-card').innerHTML = breakTodayCardHtml(brk.today, now);
    } else if (hol.today) {
      $('now-card').innerHTML = holidayTodayCardHtml(hol.today);
    } else if (brk.startsTomorrow) {
      $('now-card').innerHTML = breakTomorrowCardHtml(brk.startsTomorrow) + nowCardHtml(cardInfo);
    } else if (hol.tomorrow) {
      $('now-card').innerHTML = holidayTomorrowCardHtml(hol.tomorrow, hol.tomorrowDate) + nowCardHtml(cardInfo);
    } else {
      $('now-card').innerHTML = nowCardHtml(cardInfo);
    }

    // Independent of the now-card precedence above and of course selection
    // gating below (midsemCardHtml() no-ops itself in both of those cases) -
    // a Mid-Sem exam is its own section, never folded into the holiday/break
    // states.
    $('midsem-card').innerHTML = midsemCardHtml(midsemContext(state.selected, now), now);

    var list = $('today-list');
    if (!state.selected.size) {
      $('today-head').hidden = true;
      list.innerHTML = emptyHtml(
        'No courses selected',
        'Choose the courses you are registered for to build your personal timetable.',
        '<button type="button" class="primary-btn" data-action="pick">Choose courses</button>');
      return;
    }

    $('today-head').hidden = false;

    // Same precedence as above, and for the same reason it takes precedence
    // over the weekend check further down - Independence Day (a Saturday in
    // 2026) must read as a holiday, and Winter Vacation swallows several
    // weekends too, not "it's the weekend". These branches fire regardless
    // of whether the date is a weekday or weekend (breakOn()/holidayOn()
    // only ever look at the calendar date).
    if (brk.today) {
      $('today-head').textContent = info.today || WEEKDAY_NAMES[now.getDay()];
      list.innerHTML = emptyHtml('No classes today',
        brk.today.name + ' - no regular classes are scheduled.');
      return;
    }
    if (hol.today) {
      $('today-head').textContent = info.today || WEEKDAY_NAMES[now.getDay()];
      list.innerHTML = emptyHtml('No classes today',
        hol.today.name + ' - no regular classes are scheduled.');
      return;
    }
    if (!info.today) {
      $('today-head').textContent = 'Today';
      list.innerHTML = emptyHtml('It\'s the weekend',
        'No classes are scheduled on ' + WEEKDAY_NAMES[now.getDay()] + '.');
      return;
    }

    // No regular class is shown if it overlaps an active Mid-Sem exam on
    // today's actual calendar date - a real interval overlap against the
    // user's (possibly edited) exam times, never a course-code match, so an
    // unrelated class during someone else's exam slot is suppressed too.
    // The underlying timetable data is never touched; this filters only the
    // rendered list.
    var midsemIntervals = midsemIntervalsOn(state.selected, localDateKey(now));
    var events = eventsFor(info.today, state.selected).filter(function (e) {
      return !overlapsAnyInterval(e, midsemIntervals);
    });
    $('today-head').textContent = info.today + ' · ' + plural(events.length, 'class');
    list.innerHTML = events.length
      ? events.map(function (e) { return eventHtml(e, statusFor(e, info, true)); }).join('')
      : emptyHtml('No classes today', 'Nothing scheduled on ' + info.today + ' for your courses.');
  }

  function renderWeek() {
    var now = new Date();
    var info = computeNow(state.selected, now);
    var chips = $('day-chips');

    chips.innerHTML = DAYS.map(function (d) {
      var n = state.selected.size ? eventsFor(d, state.selected).length : 0;
      return '<button type="button" class="chip" role="tab" data-day="' + d + '" ' +
             'aria-selected="' + (d === state.weekDay) + '">' + d.slice(0, 3) +
             '<span class="n">' + n + '</span></button>';
    }).join('');

    var list = $('week-list');
    if (!state.selected.size) {
      list.innerHTML = emptyHtml(
        'No courses selected',
        'Choose your courses to see your week.',
        '<button type="button" class="primary-btn" data-action="pick">Choose courses</button>');
      return;
    }

    var events = eventsFor(state.weekDay, state.selected);
    var isToday = state.weekDay === info.today;
    list.innerHTML = events.length
      ? events.map(function (e) { return eventHtml(e, statusFor(e, info, isToday)); }).join('')
      : emptyHtml('Nothing on ' + state.weekDay, 'None of your courses meet on this day.');
  }

  function render() {
    if (state.view === 'today') renderToday(); else renderWeek();
    $('view-today').hidden = state.view !== 'today';
    $('view-week').hidden = state.view !== 'week';
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.setAttribute('aria-selected', String(t.dataset.view === state.view));
    });
    $('semester-label').textContent =
      DATA.semester + ' · ' + plural(state.selected.size, 'course');
    $('course-summary').textContent = state.selected.size
      ? [].concat(Array.from(state.selected)).sort().join(', ')
      : 'None selected yet';
  }

  // --------------------------------------------------- course-picker screen

  function courseStats(code) {
    var c = { Theory: 0, Tutorial: 0, Lab: 0 };
    DATA.events.forEach(function (e) { if (e.course === code) c[e.type]++; });
    var parts = [];
    if (c.Theory) parts.push(c.Theory + ' theory');
    if (c.Tutorial) parts.push(plural(c.Tutorial, 'tutorial'));
    if (c.Lab) parts.push(plural(c.Lab, 'lab'));
    return parts.join(' · ');
  }

  function renderDeptChips() {
    var depts = [];
    DATA.courses.forEach(function (c) { if (depts.indexOf(c.dept) < 0) depts.push(c.dept); });
    depts.sort();
    var all = [{ key: 'ALL', label: 'All', n: DATA.courses.length }].concat(
      depts.map(function (d) {
        return { key: d, label: d, n: DATA.courses.filter(function (c) { return c.dept === d; }).length };
      }));
    $('dept-chips').innerHTML = all.map(function (d) {
      return '<button type="button" class="chip" role="tab" data-dept="' + d.key + '" ' +
             'aria-selected="' + (state.dept === d.key) + '" ' +
             'title="' + esc(DEPT_LABELS[d.key] || 'All departments') + '">' +
             esc(d.label) + '<span class="n">' + d.n + '</span></button>';
    }).join('');
  }

  function visibleCourses() {
    var q = state.query.trim().toLowerCase();
    return DATA.courses.filter(function (c) {
      if (state.dept !== 'ALL' && c.dept !== state.dept) return false;
      if (!q) return true;
      return c.code.toLowerCase().indexOf(q) >= 0 || c.name.toLowerCase().indexOf(q) >= 0;
    });
  }

  var CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>';

  function renderCourseList() {
    var list = visibleCourses();
    var host = $('course-list');

    if (!list.length) {
      host.innerHTML = emptyHtml('No matching courses', 'Try a different code or clear the filters.');
      return;
    }

    var html = '';
    var lastDept = null;
    list.forEach(function (c) {
      if (c.dept !== lastDept) {
        lastDept = c.dept;
        html += '<div class="group-head">' + esc(c.dept) +
                (DEPT_LABELS[c.dept] ? ' · ' + esc(DEPT_LABELS[c.dept]) : '') + '</div>';
      }
      var on = state.draft.has(c.code);
      html +=
        '<button type="button" class="course-row" data-code="' + esc(c.code) + '" aria-pressed="' + on + '">' +
          '<span class="box">' + CHECK_SVG + '</span>' +
          '<span class="meta">' +
            '<span class="code">' + esc(c.code) + '</span>' +
            (c.name ? '<span class="name">' + esc(c.name) + '</span>' : '') +
            '<span class="counts">' + esc(courseStats(c.code)) + '</span>' +
          '</span>' +
        '</button>';
    });
    host.innerHTML = html;
  }

  function renderPickerFooter() {
    var n = state.draft.size;
    $('sel-count').textContent = plural(n, 'course') + ' selected';
    $('clear-sel').hidden = n === 0;
    $('continue-btn').textContent = state.editing ? 'Save' : 'Continue';
  }

  function openPicker(editing) {
    state.editing = !!editing;
    state.draft = new Set(state.selected ? Array.from(state.selected) : []);
    state.query = '';
    state.dept = 'ALL';
    $('search').value = '';
    $('search-clear').hidden = true;
    $('setup-cancel').hidden = !editing;
    $('setup-title').textContent = editing ? 'Change courses' : 'Choose your courses';
    $('setup-sub').textContent = editing
      ? 'Add or remove courses. Your timetable updates when you save.'
      : 'Pick the courses you are registered for. You can change this later.';
    renderDeptChips();
    renderCourseList();
    renderPickerFooter();
    showScreen('setup');
    $('course-list').scrollTop = 0;
  }

  function showScreen(which) {
    $('screen-setup').hidden = which !== 'setup';
    $('screen-app').hidden = which !== 'app';
  }

  // ------------------------------------------------------------ sheet/modal

  function openSheet() {
    $('sheet-backdrop').hidden = false;
    $('settings-sheet').hidden = false;
    syncThemeButtons();
    $('sheet-foot').textContent =
      DATA.events.length + ' events · ' + DATA.courses.length + ' courses · ' +
      DATA.semester + '. Works offline.';

    // Hidden entirely when there is nothing to reset.
    var c = customCount();
    var btn = $('reset-changes-btn');
    btn.hidden = !hasCustomisations();
    if (!btn.hidden) {
      var bits = [];
      if (c.edited) bits.push(plural(c.edited, 'class') + ' edited');
      if (c.removed) bits.push(plural(c.removed, 'class') + ' removed');
      $('changes-summary').textContent = bits.join(' · ') + ' - restore the original';
    }

    var mCount = midsemCustomCount();
    var mbtn = $('reset-midsem-btn');
    mbtn.hidden = !mCount;
    if (!mbtn.hidden) {
      $('midsem-changes-summary').textContent =
        plural(mCount, 'exam') + ' edited - restore the published schedule';
    }
  }

  function closeSheet() {
    $('sheet-backdrop').hidden = true;
    $('settings-sheet').hidden = true;
  }

  var confirmAction = null;

  function openConfirm(opts) {
    confirmAction = opts.onOk;
    $('confirm-title').textContent = opts.title;
    $('confirm-body').textContent = opts.body;
    $('confirm-ok').textContent = opts.okLabel || 'Confirm';
    $('confirm-backdrop').hidden = false;
    $('confirm-dialog').hidden = false;
    $('confirm-ok').focus();
  }

  function closeConfirm() {
    confirmAction = null;
    $('confirm-backdrop').hidden = true;
    $('confirm-dialog').hidden = true;
  }

  // ------------------------------------------- single-event actions + editing

  var activeEventId = null;

  function describeEvent(e) {
    return e.day + ' · ' + e.time + ' · ' + e.course +
           ' · ' + e.type + ' · ' + e.room;
  }

  function openEventSheet(id) {
    var e = effectiveById(id);
    if (!e) return;
    activeEventId = id;
    $('event-sheet-title').textContent = e.course + (e.name ? ' · ' + e.name : '');
    $('event-sheet-sub').textContent = describeEvent(e);
    $('event-restore').hidden = !e.modified;
    $('event-backdrop').hidden = false;
    $('event-sheet').hidden = false;
  }

  function closeEventSheet() {
    activeEventId = null;
    $('event-backdrop').hidden = true;
    $('event-sheet').hidden = true;
  }

  // --- edit dialog

  var editingId = null;
  var nameTouched = false;
  var durationTouched = false;

  function openEditSheet(id) {
    var e = effectiveById(id);
    if (!e) return;
    editingId = id;
    nameTouched = false;
    durationTouched = false;

    $('f-day').innerHTML = DAYS.map(function (d) {
      return '<option value="' + esc(d) + '"' + (d === e.day ? ' selected' : '') + '>' + esc(d) + '</option>';
    }).join('');
    $('f-time').value = e.time;
    $('f-course').value = e.course;
    $('f-name').value = e.name;
    $('f-type').value = e.type;
    $('f-duration').value = e.duration;
    $('f-room').value = e.room;

    var orig = originalById(id);
    $('edit-sub').textContent = orig
      ? 'Published as ' + describeEvent(orig)
      : '';
    showEditError('');
    $('edit-backdrop').hidden = false;
    $('edit-sheet').hidden = false;
  }

  function closeEditSheet() {
    editingId = null;
    $('edit-backdrop').hidden = true;
    $('edit-sheet').hidden = true;
  }

  function showEditError(msg) {
    var el = $('edit-error');
    el.textContent = msg;
    el.hidden = !msg;
    $('f-course').setAttribute('aria-invalid', String(/course code/i.test(msg)));
    $('f-time').setAttribute('aria-invalid', String(/time/i.test(msg)));
    $('f-duration').setAttribute('aria-invalid', String(/duration/i.test(msg)));
  }

  function submitEdit() {
    if (!editingId) return;

    var values = {
      day: $('f-day').value,
      time: $('f-time').value,
      course: $('f-course').value.trim().toUpperCase(),
      name: $('f-name').value.trim(),
      type: $('f-type').value,
      room: $('f-room').value.trim(),
      duration: parseInt($('f-duration').value, 10)
    };

    if (!values.course) return showEditError('Enter a course code.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time)) {
      return showEditError('Enter a valid start time.');
    }
    if (DAYS.indexOf(values.day) < 0) return showEditError('Choose a day.');
    if (TYPES.indexOf(values.type) < 0) return showEditError('Choose a class type.');
    if (!Number.isInteger(values.duration) ||
        values.duration < MIN_DURATION_MINUTES || values.duration > MAX_DURATION_MINUTES) {
      return showEditError('Enter a duration between ' + MIN_DURATION_MINUTES +
        ' and ' + MAX_DURATION_MINUTES + ' minutes.');
    }

    var id = editingId;
    if (!saveOverride(id, values)) {
      toast('Could not save - storage is blocked in this browser');
    } else {
      toast(custom.overrides[id] ? 'Changes saved' : 'Class restored to the original');
    }
    closeEditSheet();
    render();
  }

  // ------------------------------------------------- Mid-Sem full schedule

  /** "now" / "past" / "" for a Mid-Sem exam row, on the real calendar date+time. */
  function midsemExamStatus(e, now) {
    if (e.date === localDateKey(now)) {
      var nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      if (nowMin >= e.minutes && nowMin < midsemExamEnd(e)) return 'now';
    }
    var start = new Date(e.date + 'T00:00:00');
    start.setHours(Math.floor(e.minutes / 60), e.minutes % 60, 0, 0);
    return start.getTime() < now.getTime() ? 'past' : '';
  }

  function midsemRowHtml(e, status) {
    return '' +
      '<article class="event' + (status ? ' is-' + status : '') + '">' +
        '<div class="rail">' +
          '<div class="time">' + esc(e.time) + '</div>' +
          '<div class="dur">' + esc(shortDate(new Date(e.date + 'T00:00:00'))) + '</div>' +
        '</div>' +
        '<div class="body">' +
          '<div class="top">' +
            '<span class="code">' + esc(e.course) + '</span>' +
            (status === 'now' ? '<span class="badge live">Now</span>' : '') +
            (e.modified ? '<span class="edited-flag">Edited</span>' : '') +
          '</div>' +
          (e.name ? '<div class="cname">' + esc(e.name) + '</div>' : '') +
          '<div class="room">' + PIN_SVG + '<span>' + esc(e.venue) + '</span></div>' +
        '</div>' +
        '<button type="button" class="evt-menu" data-midsem="' + esc(e.id) + '" ' +
          'aria-label="Edit ' + esc(e.course) + ' Mid-Sem exam">' +
          DOTS_SVG +
        '</button>' +
      '</article>';
  }

  function renderMidsemList() {
    var exams = effectiveMidsemExams(state.selected);
    var now = new Date();
    $('midsem-sheet-sub').textContent = exams.length
      ? plural(exams.length, 'exam') + ' for your selected courses, in order'
      : 'None of your selected courses have a Mid-Sem exam.';
    $('midsem-list').innerHTML = exams.length
      ? exams.map(function (e) { return midsemRowHtml(e, midsemExamStatus(e, now)); }).join('')
      : emptyHtml('No Mid-Sem exams', 'None of your selected courses have a Mid-Sem exam.');
  }

  function openMidsemSheet() {
    renderMidsemList();
    $('midsem-backdrop').hidden = false;
    $('midsem-sheet').hidden = false;
  }

  function closeMidsemSheet() {
    $('midsem-backdrop').hidden = true;
    $('midsem-sheet').hidden = true;
  }

  // --- edit a single exam's date/time/venue

  var midsemEditingId = null;

  function showMidsemEditError(msg) {
    var el = $('midsem-edit-error');
    el.textContent = msg;
    el.hidden = !msg;
    $('me-date').setAttribute('aria-invalid', String(/date/i.test(msg)));
    $('me-time').setAttribute('aria-invalid', String(/time/i.test(msg)));
    $('me-venue').setAttribute('aria-invalid', String(/venue/i.test(msg)));
  }

  function openMidsemEditSheet(id) {
    var e = allEffectiveMidsemExams().filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    midsemEditingId = id;
    $('midsem-edit-sub').textContent = e.course + (e.name ? ' · ' + e.name : '');
    $('me-date').value = e.date;
    $('me-time').value = e.time;
    $('me-venue').value = e.venue;
    showMidsemEditError('');
    $('midsem-edit-backdrop').hidden = false;
    $('midsem-edit-sheet').hidden = false;
  }

  function closeMidsemEditSheet() {
    midsemEditingId = null;
    $('midsem-edit-backdrop').hidden = true;
    $('midsem-edit-sheet').hidden = true;
  }

  function submitMidsemEdit() {
    if (!midsemEditingId) return;

    var values = {
      date: $('me-date').value,
      time: $('me-time').value,
      venue: $('me-venue').value.trim()
    };

    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) return showMidsemEditError('Enter a valid date.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time)) return showMidsemEditError('Enter a valid start time.');
    if (!values.venue) return showMidsemEditError('Enter a venue.');

    var id = midsemEditingId;
    if (!saveMidsemOverride(id, values)) {
      toast('Could not save - storage is blocked in this browser');
    } else {
      toast(midsemCustom.overrides[id] ? 'Exam updated' : 'Exam restored to the published schedule');
    }
    closeMidsemEditSheet();
    renderMidsemList();
    render();
  }

  var toastTimer = null;

  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  // ----------------------------------------------------------------- theme

  function applyTheme() {
    if (state.theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', state.theme);
  }

  function syncThemeButtons() {
    Array.prototype.forEach.call($('theme-seg').children, function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.theme === state.theme));
    });
  }

  // ------------------------------------------------------------------ wire

  function bind() {
    // --- picker
    $('search').addEventListener('input', function (e) {
      state.query = e.target.value;
      $('search-clear').hidden = !state.query;
      renderCourseList();
    });

    $('search-clear').addEventListener('click', function () {
      state.query = '';
      $('search').value = '';
      $('search-clear').hidden = true;
      renderCourseList();
      $('search').focus();
    });

    $('dept-chips').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-dept]');
      if (!chip) return;
      state.dept = chip.dataset.dept;
      renderDeptChips();
      renderCourseList();
      $('course-list').scrollTop = 0;
    });

    $('course-list').addEventListener('click', function (e) {
      var row = e.target.closest('[data-code]');
      if (!row) return;
      var code = row.dataset.code;
      if (state.draft.has(code)) state.draft.delete(code); else state.draft.add(code);
      row.setAttribute('aria-pressed', String(state.draft.has(code)));
      renderPickerFooter();
    });

    $('clear-sel').addEventListener('click', function () {
      state.draft.clear();
      renderCourseList();
      renderPickerFooter();
    });

    $('continue-btn').addEventListener('click', function () {
      var codes = Array.from(state.draft).sort();
      state.selected = new Set(codes);
      if (!saveSelection(codes)) {
        toast('Could not save - storage is blocked in this browser');
      } else if (state.editing) {
        toast(plural(codes.length, 'course') + ' saved');
      }
      state.editing = false;
      state.weekDay = teachingDay(new Date()) || DAYS[0];
      showScreen('app');
      render();
    });

    $('setup-cancel').addEventListener('click', function () {
      state.editing = false;
      showScreen('app');
      render();
    });

    // --- tabs
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      tab.addEventListener('click', function () {
        state.view = tab.dataset.view;
        if (state.view === 'week' && !state.weekDay) {
          state.weekDay = teachingDay(new Date()) || DAYS[0];
        }
        render();
        $('main').scrollTop = 0;
      });
    });

    $('day-chips').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-day]');
      if (!chip) return;
      state.weekDay = chip.dataset.day;
      renderWeek();
    });

    // Empty-state CTA, the per-event "..." control and the Mid-Sem card's
    // "view full schedule" link (all three live in the Today/Week views).
    $('main').addEventListener('click', function (e) {
      if (e.target.closest('[data-action="pick"]')) { openPicker(true); return; }
      if (e.target.closest('[data-action="midsem-full"]')) { openMidsemSheet(); return; }
      var menu = e.target.closest('[data-evt]');
      if (menu) openEventSheet(menu.dataset.evt);
    });

    // --- single-event action sheet
    $('event-close').addEventListener('click', closeEventSheet);
    $('event-backdrop').addEventListener('click', closeEventSheet);

    $('event-edit').addEventListener('click', function () {
      var id = activeEventId;
      closeEventSheet();
      openEditSheet(id);
    });

    $('event-restore').addEventListener('click', function () {
      var id = activeEventId;
      closeEventSheet();
      restoreEvent(id);
      render();
      toast('Class restored to the original');
    });

    $('event-remove').addEventListener('click', function () {
      var id = activeEventId;
      var e = effectiveById(id);
      closeEventSheet();
      openConfirm({
        title: 'Remove this class from your timetable?',
        body: e
          ? describeEvent(e) + '. Only this class is hidden - ' + e.originalCourse +
            ' stays selected and its other classes are unaffected.'
          : 'Only this class is hidden; the course stays selected.',
        okLabel: 'Remove',
        onOk: function () {
          if (!removeEvent(id)) toast('Could not save - storage is blocked in this browser');
          else toast('Class removed');
          render();
        }
      });
    });

    // --- edit dialog
    $('edit-cancel').addEventListener('click', closeEditSheet);
    $('edit-backdrop').addEventListener('click', closeEditSheet);
    $('edit-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submitEdit();
    });

    $('f-name').addEventListener('input', function () { nameTouched = true; });

    // Typing a known course code fills in its name, unless the user has already
    // typed their own name in this dialog.
    $('f-course').addEventListener('input', function () {
      if (nameTouched) return;
      var known = NAME_BY_CODE[$('f-course').value.trim().toUpperCase()];
      if (known) $('f-name').value = known;
    });

    $('f-duration').addEventListener('input', function () { durationTouched = true; });

    // Picking a new type fills in that type's standard duration, unless the
    // user has already typed their own duration in this dialog - the same
    // "don't clobber an explicit edit" rule as the course-name autofill above.
    $('f-type').addEventListener('change', function () {
      if (durationTouched) return;
      var std = DATA.durations[$('f-type').value];
      if (std) $('f-duration').value = std;
    });

    // --- Mid-Sem full schedule
    $('midsem-close').addEventListener('click', closeMidsemSheet);
    $('midsem-backdrop').addEventListener('click', closeMidsemSheet);

    $('midsem-list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-midsem]');
      if (btn) openMidsemEditSheet(btn.dataset.midsem);
    });

    // --- Mid-Sem edit dialog
    $('midsem-edit-cancel').addEventListener('click', closeMidsemEditSheet);
    $('midsem-edit-backdrop').addEventListener('click', closeMidsemEditSheet);
    $('midsem-edit-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submitMidsemEdit();
    });

    // --- settings
    $('open-settings').addEventListener('click', openSheet);
    $('close-settings').addEventListener('click', closeSheet);
    $('sheet-backdrop').addEventListener('click', closeSheet);

    $('change-courses').addEventListener('click', function () {
      closeSheet();
      openPicker(true);
    });

    $('theme-seg').addEventListener('click', function (e) {
      var b = e.target.closest('[data-theme]');
      if (!b) return;
      state.theme = b.dataset.theme;
      store.set(KEY_THEME, state.theme);
      applyTheme();
      syncThemeButtons();
    });

    $('reset-btn').addEventListener('click', function () {
      closeSheet();
      openConfirm({
        title: 'Reset the app?',
        body: 'This clears your saved course selection and returns you to the ' +
              'course picker. The timetable data itself stays in the app, and ' +
              'your timetable changes are kept.',
        okLabel: 'Reset',
        onOk: function () {
          // Only the selection. Timetable customisations live under their own
          // key and deliberately survive, so re-picking a course brings them
          // back rather than silently losing the user's work.
          store.remove(KEY_COURSES);
          state.selected = null;
          state.view = 'today';
          openPicker(false);
          toast('Course selection cleared');
        }
      });
    });

    $('reset-changes-btn').addEventListener('click', function () {
      closeSheet();
      openConfirm({
        title: 'Reset all timetable changes?',
        body: 'This will restore all edited and removed classes to the ' +
              'original timetable. Your selected courses are not affected.',
        okLabel: 'Reset changes',
        onOk: function () {
          resetCustomisations();
          render();
          toast('Timetable changes reset');
        }
      });
    });

    $('reset-midsem-btn').addEventListener('click', function () {
      closeSheet();
      openConfirm({
        title: 'Reset all Mid-Sem edits?',
        body: 'This restores every edited exam\'s date, time and venue to the ' +
              'published schedule. Your selected courses are not affected.',
        okLabel: 'Reset edits',
        onOk: function () {
          resetMidsemCustomisations();
          render();
          toast('Mid-Sem edits reset');
        }
      });
    });

    $('confirm-cancel').addEventListener('click', closeConfirm);
    $('confirm-backdrop').addEventListener('click', closeConfirm);
    $('confirm-ok').addEventListener('click', function () {
      var fn = confirmAction;
      closeConfirm();
      if (fn) fn();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('confirm-dialog').hidden) closeConfirm();
      else if (!$('edit-sheet').hidden) closeEditSheet();
      else if (!$('midsem-edit-sheet').hidden) closeMidsemEditSheet();
      else if (!$('event-sheet').hidden) closeEventSheet();
      else if (!$('midsem-sheet').hidden) closeMidsemSheet();
      else if (!$('settings-sheet').hidden) closeSheet();
    });

    // Keep "now" fresh: tick every 30s and immediately on resume.
    setInterval(function () {
      if (!$('screen-app').hidden && !document.hidden) render();
    }, 30000);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !$('screen-app').hidden) render();
    });
  }

  // ------------------------------------------------------------------ boot

  function init() {
    // The published timetable is read-only for the lifetime of the app: every
    // personal change goes through the customisation layer instead. Frozen in
    // strict mode, so an accidental write throws rather than corrupting data.
    DATA.events.forEach(function (e) { Object.freeze(e); });
    Object.freeze(DATA.events);
    Object.freeze(DATA);

    // Same read-only treatment for the bundled Mid-Sem source data - only the
    // separate override layer below is ever written to.
    MIDSEM.exams.forEach(function (e) { Object.freeze(e); });
    Object.freeze(MIDSEM.exams);
    Object.freeze(MIDSEM);

    custom = loadCustom();
    invalidateEffective();

    midsemCustom = loadMidsemCustom();
    invalidateMidsemEffective();

    applyTheme();
    bind();

    var saved = loadSelection();
    state.weekDay = teachingDay(new Date()) || DAYS[0];

    if (saved === null) {
      state.selected = new Set();
      openPicker(false);
    } else {
      state.selected = new Set(saved);
      showScreen('app');
      render();
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (err) {
          console.warn('Service worker registration failed:', err);
        });
      });
    }
  }

  // Test hook: lets the browser test suite drive the pure logic directly.
  window.__tt = {
    state: state,
    data: DATA,
    eventsFor: eventsFor,
    effectiveEvents: effectiveEvents,
    computeNow: computeNow,
    teachingDay: teachingDay,
    humanDuration: humanDuration,
    render: render,
    customCount: customCount,
    localDateKey: localDateKey,
    holidayOn: holidayOn,
    holidayContext: holidayContext,
    holidays: HOLIDAYS,
    breakOn: breakOn,
    breakContext: breakContext,
    computeNextSkippingBreaks: computeNextSkippingBreaks,
    breaks: BREAKS,
    midsem: MIDSEM,
    effectiveMidsemExams: effectiveMidsemExams,
    allEffectiveMidsemExams: allEffectiveMidsemExams,
    midsemContext: midsemContext,
    computeNowWithMidsem: computeNowWithMidsem,
    computeNextSkippingBreaksAndMidsem: computeNextSkippingBreaksAndMidsem,
    midsemIntervalsOn: midsemIntervalsOn,
    saveMidsemOverride: saveMidsemOverride,
    resetMidsemCustomisations: resetMidsemCustomisations,
    midsemCustomCount: midsemCustomCount,
    KEY_COURSES: KEY_COURSES,
    KEY_THEME: KEY_THEME,
    KEY_CUSTOM: KEY_CUSTOM,
    KEY_MIDSEM: KEY_MIDSEM
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
