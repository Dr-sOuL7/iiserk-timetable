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

  function courseName(code) { return NAME_BY_CODE[code] || ''; }

  // -------------------------------------------------------- data selectors

  /** All events for a day belonging to `selected`, chronologically. */
  function eventsFor(day, selected) {
    return DATA.events
      .filter(function (e) { return e.day === day && selected.has(e.course); })
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

  function eventHtml(e, status) {
    var name = courseName(e.course);
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
          '</div>' +
          (name ? '<div class="cname">' + esc(name) + '</div>' : '') +
          '<div class="room">' + PIN_SVG + '<span>' + esc(e.room) + '</span></div>' +
        '</div>' +
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

    info.current.forEach(function (e) {
      var pct = Math.min(100, Math.max(0, (info.elapsed / e.duration) * 100));
      html +=
        '<div class="now-card live">' +
          '<div class="now-label"><span class="dot"></span>Current class</div>' +
          '<div class="now-course"><span class="now-code">' + esc(e.course) + '</span>' +
            '<span class="badge ' + e.type + '">' + esc(e.type) + '</span></div>' +
          (courseName(e.course) ? '<div class="now-name">' + esc(courseName(e.course)) + '</div>' : '') +
          '<div class="now-where">' + PIN_SVG + '<span>' + esc(e.room) + '</span>' +
            '<span>&middot;</span><span>' + esc(e.time) + '</span></div>' +
          '<div class="now-remain">' + esc(humanDuration(info.remaining)) + ' remaining</div>' +
          '<div class="progress"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '</div>';
    });

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
            '<span class="badge ' + n.type + '">' + esc(n.type) + '</span></div>' +
          '<div class="now-name"><strong>' + esc(n.course) + '</strong>' +
            (courseName(n.course) ? ' &middot; ' + esc(courseName(n.course)) : '') + '</div>' +
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

  function statusFor(e, info, isToday) {
    if (!isToday) return '';
    if (info.current.indexOf(e) >= 0) return 'now';
    if (info.nextOffset === 0 && info.next.indexOf(e) >= 0) return 'next';
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
  }

  function closeSheet() {
    $('sheet-backdrop').hidden = true;
    $('settings-sheet').hidden = true;
  }

  var confirmAction = null;

  function openConfirm(onOk) {
    confirmAction = onOk;
    $('confirm-backdrop').hidden = false;
    $('confirm-dialog').hidden = false;
    $('confirm-ok').focus();
  }

  function closeConfirm() {
    confirmAction = null;
    $('confirm-backdrop').hidden = true;
    $('confirm-dialog').hidden = true;
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

    // "Choose courses" buttons inside empty states.
    $('main').addEventListener('click', function (e) {
      if (e.target.closest('[data-action="pick"]')) openPicker(true);
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
      openConfirm(function () {
        store.remove(KEY_COURSES);          // only the selection; data stays put
        state.selected = null;
        state.view = 'today';
        openPicker(false);
        toast('Course selection cleared');
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
    computeNow: computeNow,
    teachingDay: teachingDay,
    humanDuration: humanDuration,
    render: render,
    KEY_COURSES: KEY_COURSES,
    KEY_THEME: KEY_THEME
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
