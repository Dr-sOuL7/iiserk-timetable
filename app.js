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
  var DEPT_LABELS = {
    CH: 'Chemistry', CS: 'Computer Science', ES: 'Earth Science', HU: 'Humanities',
    LS: 'Life Science', MA: 'Mathematics', PH: 'Physics'
  };

  var KEY_COURSES = 'iiserk.tt.courses.v1';
  var KEY_THEME = 'iiserk.tt.theme.v1';
  // Personal timetable edits/removals. Deliberately a SEPARATE key from the
  // course selection: resetting courses must not throw away customisations,
  // and re-selecting the same course brings its customisations back.
  var KEY_CUSTOM = 'iiserk.tt.custom.v1';

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
   * Shape: { version: 1, overrides: { <eventId>: {day,time,course,name,type,room} },
   *          removed: [<eventId>, ...] }
   */
  var EDITABLE_FIELDS = ['day', 'time', 'course', 'name', 'type', 'room'];
  var TYPES = ['Theory', 'Tutorial', 'Lab'];

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
        // An unedited event (or one edited in any field but type) keeps the
        // PUBLISHED duration - almost always the type's standard length, but
        // some classes (e.g. Wed 13:30 CS2102, a Theory that actually runs a
        // 160-minute lab-length block) genuinely differ, and that real length
        // must survive. Only an explicit type edit falls back to the new
        // type's standard length, since there is no way to guess an exception
        // for a type the user picked themselves.
        duration: (patch && has(patch, 'type') && patch.type !== o.type)
          ? (DATA.durations[type] || o.duration)
          : o.duration,
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

    var patch = {};
    EDITABLE_FIELDS.forEach(function (f) {
      if (!has(values, f)) return;
      var base = f === 'name' ? (NAME_BY_CODE[values.course || orig.course] || '') : orig[f];
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

    // Next: earliest start strictly after "now", scanning forward day by day.
    var next = [], nextOffset = 0;
    for (var offset = 0; offset <= 7 && !next.length; offset++) {
      var d = new Date(now.getTime());
      d.setDate(d.getDate() + offset);
      var dayName = teachingDay(d);
      if (!dayName) continue;
      var candidates = eventsFor(dayName, selected).filter(function (e) {
        return offset > 0 || e.minutes > nowMin;
      });
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

    return {
      today: today,
      nowMin: nowMin,
      current: current,
      remaining: current.length ? (current[0].minutes + current[0].duration - nowMin) : null,
      elapsed: current.length ? (nowMin - current[0].minutes) : null,
      next: next,
      nextOffset: nextOffset,
      startsIn: startsIn
    };
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

    $('date-line').textContent = now.toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    $('now-card').innerHTML = nowCardHtml(info);

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
    if (!info.today) {
      $('today-head').textContent = 'Today';
      list.innerHTML = emptyHtml('It\'s the weekend',
        'No classes are scheduled on ' + WEEKDAY_NAMES[now.getDay()] + '.');
      return;
    }

    var events = eventsFor(info.today, state.selected);
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

  function openEditSheet(id) {
    var e = effectiveById(id);
    if (!e) return;
    editingId = id;
    nameTouched = false;

    $('f-day').innerHTML = DAYS.map(function (d) {
      return '<option value="' + esc(d) + '"' + (d === e.day ? ' selected' : '') + '>' + esc(d) + '</option>';
    }).join('');
    $('f-time').value = e.time;
    $('f-course').value = e.course;
    $('f-name').value = e.name;
    $('f-type').value = e.type;
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
  }

  function submitEdit() {
    if (!editingId) return;

    var values = {
      day: $('f-day').value,
      time: $('f-time').value,
      course: $('f-course').value.trim().toUpperCase(),
      name: $('f-name').value.trim(),
      type: $('f-type').value,
      room: $('f-room').value.trim()
    };

    if (!values.course) return showEditError('Enter a course code.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time)) {
      return showEditError('Enter a valid start time.');
    }
    if (DAYS.indexOf(values.day) < 0) return showEditError('Choose a day.');
    if (TYPES.indexOf(values.type) < 0) return showEditError('Choose a class type.');

    var id = editingId;
    if (!saveOverride(id, values)) {
      toast('Could not save - storage is blocked in this browser');
    } else {
      toast(custom.overrides[id] ? 'Changes saved' : 'Class restored to the original');
    }
    closeEditSheet();
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

    // Empty-state CTA and the per-event "..." control (both views live here).
    $('main').addEventListener('click', function (e) {
      if (e.target.closest('[data-action="pick"]')) { openPicker(true); return; }
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
      else if (!$('event-sheet').hidden) closeEventSheet();
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

    custom = loadCustom();
    invalidateEffective();

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
    KEY_COURSES: KEY_COURSES,
    KEY_THEME: KEY_THEME,
    KEY_CUSTOM: KEY_CUSTOM
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
