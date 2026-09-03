# IISER Kolkata Timetable (PWA)

An offline-first personal class timetable for IISER Kolkata, Autumn 2026.
Pick your courses once; the app then opens straight to today's classes, tells you
what is running right now and what is next, and keeps working with no network.
Individual classes can be edited or removed, and those changes persist offline.
The Today tab also surfaces your Mid-Sem exam schedule (date, time, venue) and
hides any regular class that a Mid-Sem exam period cancels.

Plain HTML, CSS and vanilla JavaScript. No backend, no database, no login, no
API, no build step, and no CDN or external font — every byte it needs is in this
repository.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | App shell: course picker, Today view, Week view, settings sheet, confirm dialog. |
| `style.css` | All styling. Mobile-first, system font stack, light/dark tokens. |
| `app.js` | All UI logic: filtering, sorting, current/next detection, localStorage, service-worker registration. |
| `data/timetable.js` | **The dataset.** 433 events + 122 courses as plain JS (`window.TIMETABLE_DATA`). Generated — see below. |
| `data/holidays.js` | 2026 institute holidays and academic breaks (`window.HOLIDAY_DATA`, `window.BREAK_DATA`), for Today-tab awareness only. Hand-maintained, entirely separate from the timetable — see below. |
| `data/midsem.js` | The Mid-Sem exam schedule — one entry per course (`window.MIDSEM_DATA`), for Today-tab awareness and the Mid-Sem editor. Generated — see below. |
| `manifest.json` | Web App Manifest (name, display mode, colours, icons). |
| `sw.js` | Service worker: precaches the shell, serves it offline. |
| `icons/` | PNG app icons (192, 512, maskable 512, apple-touch). |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is. |
| `tools/raw/` | The source timetable text, the offered-courses CSV, and the Mid-Sem venue/date CSVs. |
| `tools/build-data.js` | Regenerates `data/timetable.js` from `tools/raw/`. |
| `tools/validate-data.js` | Data checks of the generated dataset against the raw source. |
| `tools/build-midsem.js` | Regenerates `data/midsem.js` from `tools/raw/midsem_venues_1.csv` + `_2.csv`. |
| `tools/validate-midsem.js` | Data checks of the generated Mid-Sem dataset against its raw sources. |
| `tools/make-icons.py` | Regenerates `icons/` (pure Python, no image libraries). |
| `tests/app.test.js` | End-to-end browser checks (Playwright + headless Chromium). |

Everything under `tools/` and `tests/` is for development only. The deployed
site is just the files in the repository root plus `data/` and `icons/`.

## Running it locally

Any static file server works; a service worker needs `http://`, not `file://`.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from disk will show the app but the service worker
(and therefore offline support) will not register.

## Installing on Android

1. Deploy the repository (see below) or serve it over HTTPS / `localhost`.
2. Open the URL in Chrome on the phone.
3. Chrome shows an **Install app** prompt; otherwise use **⋮ → Add to Home screen**.
4. Launch it from the home screen — it opens standalone, with no browser chrome.
5. Open it once while online so the service worker can cache the assets. After
   that it runs with no connection at all.

## Deploying to GitHub Pages

Settings → Pages → Deploy from a branch, pick the branch and the `/ (root)`
folder. No build step and no workflow are needed. All paths in the app are
relative, so it works from a project subpath such as
`https://<user>.github.io/iiserk-timetable/`.

When you change any precached file, bump `CACHE` in `sw.js` (e.g. `...-v1` →
`...-v2`) so installed copies pick the update up.

## Personal timetable changes

Every class card has a `⋮` control offering **Edit** and **Remove**.

- **Edit** opens a sheet pre-filled with the class's day, start time, course
  code, course name, type, duration and room. Saving applies immediately and
  the class re-sorts into its new position (a new day moves it between
  Today/Week lists).
- **Remove** hides that one class after a confirmation. The course stays
  selected and its other classes are untouched.
- Changed classes are marked **Edited**, and their `⋮` menu gains **Undo my
  changes** to restore that one class.
- Settings → **Reset timetable changes** restores everything at once. It is
  hidden when there is nothing to reset, and is separate from **Reset courses**.

### How it works

`window.TIMETABLE_DATA` is the authoritative published timetable and is never
written to — it is `Object.freeze`d at start-up. Personal changes are a thin
layer stored separately:

```
TIMETABLE_DATA.events        (immutable, 433 published classes)
       +  overrides          (sparse per-event field patches)
       -  removed            (ids the user hid)
       =  effectiveEvents()  ->  course filter  ->  sort  ->  Today / Week / now+next
```

Everything downstream — Today, Week, current-class, next-class and the
countdown — reads `effectiveEvents()`, so edits and removals are reflected
everywhere automatically.

**Stable ids.** Each event carries a content-derived id such as
`mon-0950-ph3102-theory-g02`, built from day, time, course, type and room —
never from its array position. Customisations are keyed by that id, so
regenerating or reordering the dataset does not detach them from their class.

**Sparse patches.** Only fields that differ from the published event are
stored, so a future dataset that corrects (say) a room still reaches a user who
had only edited the time. An edit that restores every original value drops the
override entirely.

**Duration.** Every class has an editable duration (5-600 minutes), prefilled
with its real current length — the type's standard length, or a published
exception such as Wed 13:30 CS2102 (see Limitations below). Changing a class's
Type without touching Duration auto-fills that type's standard length, the
same way Course Name auto-fills from Course Code; once you type your own
duration, a later Type change never overwrites it. Current/next-class
detection and the countdown always use this real, possibly-edited length.

### localStorage keys

| Key | Holds |
| --- | --- |
| `iiserk.tt.courses.v1` | Selected course codes. |
| `iiserk.tt.custom.v1` | `{version, overrides: {id: patch}, removed: [id]}`. |
| `iiserk.tt.midsem.v1` | `{version, overrides: {id: patch}}` — Mid-Sem date/time/venue edits, see below. |
| `iiserk.tt.theme.v1` | Auto / light / dark. |

They are deliberately separate: **Reset courses** clears only the selection, so
re-picking a course brings its customisations back rather than silently losing
them. Malformed, unknown or wrongly-typed stored values are discarded on load,
so a corrupted entry degrades to "no customisations" instead of breaking the
app. With no keys set, the app behaves exactly as it did before the feature
existed.

## Holiday and academic-break awareness (Today tab only)

The Today tab knows about institute holidays and multi-day academic breaks;
the Week tab does not and never will — this is a Today-only presentation
layer, not a timetable feature. Both single-day holidays and multi-day breaks
are the same underlying system: one data file, one section of app.js, the
same card component, and the same rendering precedence rules.

- **Holiday today**: the current/next-class card is replaced with a plain
  informational card — holiday name, "No regular classes today." — and the
  class list below shows a matching empty state instead of the day's real
  classes. This applies even on a holiday that falls on a weekend (e.g.
  Independence Day, a Saturday in 2026): it still reads "Holiday today", never
  the generic weekend message.
- **Holiday tomorrow** (today itself is not a holiday): a compact notice —
  "Tomorrow is a holiday", the name, "Weekday, D Month" — appears above the
  normal current/next-class card. It never replaces anything: today's real
  classes stay fully visible below it.
- **On break** (today falls anywhere inside a multi-day break): same
  treatment as holiday-today, worded as "On break" / the break's name / "No
  regular classes. Classes resume {date}." The resume date is the day after
  the break ends, and reads "tomorrow" on the break's own last day — that one
  phrase covers "does the break end today or tomorrow" without a separate UI
  state for it.
- **Break starts tomorrow** (today is not inside any break): a compact notice
  — "Break starts tomorrow" / the break's name / "D Month – D Month" (the
  break's own date range) — above the normal current/next-class card, exactly
  like holiday-tomorrow. Today's real classes stay fully visible.
- **A break takes priority over a single-day holiday nested inside it** — the
  coarser, more encompassing state wins. Winter Vacation (13 Dec – 3 Jan)
  contains Christmas, and Autumn Break (17–25 Oct) contains both Dussehra
  dates; on those days the UI shows the break, not the individual holiday
  (the holiday data itself is untouched and still independently correct —
  `holidayOn()` returns "Christmas" regardless of what `breakOn()` finds).
- **Next Class skips days inside a break.** If the timetable's own weekly
  pattern would otherwise land the "next class" on a day inside an upcoming
  break, that day (and every other day of the break) is skipped, landing on
  the real next class once the break ends — a class that would otherwise be
  many weeks away, since Winter Vacation alone runs 22 days. This is
  Today-tab-only, in `computeNextSkippingBreaks()`; `computeNow()` itself
  (which Week view depends on for its own current/next-class highlighting)
  is completely unmodified — see "Local date, not UTC" below for why this
  split exists at all.

**Data.** `data/holidays.js` defines two flat arrays, both entirely separate
from `window.TIMETABLE_DATA`:
`HOLIDAY_DATA` = `[{date, name}]` for single-day holidays, and
`BREAK_DATA` = `[{start, end, name}]` (inclusive at both ends) for multi-day
breaks — dates as `"YYYY-MM-DD"` throughout, which compare correctly as plain
strings even across the Dec/Jan year boundary Winter Vacation spans, so no
date parsing is needed to test range membership. Nothing in this feature
reads, filters, or otherwise touches the timetable dataset, `effectiveEvents()`,
course selection, or personal customisations. Swapping to a future academic
year means replacing this one file; a date outside either loaded list is
simply not a holiday/break.

**Local date, not UTC.** The lookup key is built from a `Date`'s local
`getFullYear()`/`getMonth()`/`getDate()` (`localDateKey()` in app.js), the
same way the rest of the app already determines "today". It deliberately does
not use `toISOString()` or any `getUTC*()` accessor, which would read the
wrong calendar day for part of the evening/night in India (UTC+5:30) — e.g.
00:15 IST on 15 August is already Independence Day locally while `toISOString()`
would still report the 14th.

## Mid-Sem examinations (Today tab only, editable)

The Today tab includes a Mid-Sem card, independent of the current/next-class
card and of the holiday/break cards above it. **The Week tab is completely
unchanged** — no Mid-Sem card, label or exam information appears there, and
its layout and behaviour are untouched.

- **Only your selected courses' exams are shown**, one exam per course. A
  course with several room allocations (roll-number-split sections) still
  gets exactly one entry — every allocated venue, together with the roll
  number range sitting in it, is combined into that one entry's Venue field,
  e.g. `"G02 (24MS001 to 24MS158, 22MS213, 23M5013 to 23MS256); G08 (24MS167
  to 24MS249, 25MS020 to 25MS225)"` — semicolons between venues, since the
  roll ranges themselves already contain commas. A single-venue course (the
  whole class in one room) keeps a bare venue with no roll range, since there
  is nothing to distinguish. Nothing from the source is ever split into
  duplicate exams or silently dropped.
- **Current exam**: if a selected course's exam is happening right now, the
  card shows it (course, name, venue, time), styled distinctly (amber) from
  both a live class and a holiday/break notice. Two courses can share an
  exact exam slot (same date and shift) — the card then lists both
  compactly, the same treatment already used for clashing regular classes.
- **Next exam**: otherwise, the soonest upcoming selected-course exam is
  shown, with a "Today" / "Tomorrow" / "Weekday, D Month" date label.
- **Full schedule**: "View full Mid-Sem schedule" opens a sheet listing every
  selected-course exam in chronological order. Tapping an exam's `⋮` opens an
  edit dialog for **Date, Time and Venue only** — course code and course name
  are read-only, always the published code and the same
  code-to-name lookup the timetable itself uses. Edited exams are marked
  **Edited**; Settings → **Reset Mid-Sem edits** restores all of them at once
  (hidden when there is nothing to reset, and entirely separate from
  **Reset timetable changes** and **Reset courses**).
- **No regular classes during a Mid-Sem exam.** On the exact calendar date of
  an active selected-course exam, any regular class (any course, not just the
  one being examined) whose time interval overlaps the exam's interval is
  left out of the Today list and out of the current/next-class card — a real
  date/time overlap check against the (possibly edited) exam time, never a
  course-code match. The published timetable is never touched; this is a
  render-time filter only, and it does not apply to the Week tab at all.

### How it works

Same shape as the timetable customisation layer above, kept in a completely
separate localStorage key (`iiserk.tt.midsem.v1`) so resetting one never
affects the other:

```
MIDSEM_DATA.exams              (immutable, 94 published exams, one per course)
       +  overrides            (sparse date/time/venue patches)
       =  effectiveMidsemExams(selected)  ->  chronological, selected-only
```

`window.MIDSEM_DATA` is `Object.freeze`d at start-up, exactly like
`TIMETABLE_DATA`. Suppression is implemented as sibling functions
(`computeNowWithMidsem()`, `computeNextSkippingBreaksAndMidsem()`) built on
the same `scanForNext()` helper the break-skipping feature already uses —
`computeNow()` and `eventsFor()` themselves are never modified, so Week
view (which calls `computeNow()` directly) is provably unaffected.

### Regenerating the Mid-Sem dataset

```bash
node tools/build-midsem.js      # rewrites data/midsem.js
node tools/validate-midsem.js   # data checks
```

Source: `tools/raw/midsem_venues_1.csv` (course → venue → roll-number range,
one row per venue allocation) and `tools/raw/midsem_venues_2.csv` (course →
date/shift, one row per course), joined by course code. Shift 1 is
10:00–11:30, Shift 2 is 15:00–16:30 (`SHIFTS` in `tools/build-midsem.js`) —
both fixed, published
times, applied to every exam in that shift.

## Replacing the timetable

The dataset is deliberately separate from the UI. Either edit
`tools/raw/timetable.txt` and regenerate:

```bash
node tools/build-data.js      # rewrites data/timetable.js
node tools/validate-data.js   # data checks
```

…or replace `data/timetable.js` by hand, keeping the shape:

```js
{ id: 'mon-0855-ph3104-theory-g08', day: 'Monday', time: '08:55', minutes: 535,
  duration: 50, course: 'PH3104', type: 'Theory', room: 'G08' }
```

`id` must be stable across regenerations — see "Stable ids" above — and unique.

No UI code needs to change.

## Tests

```bash
node tools/validate-data.js                       # timetable data checks
node tools/validate-midsem.js                     # Mid-Sem data checks
NODE_PATH=$(npm root -g) node tests/app.test.js   # browser checks
```

The browser suite serves the real site over HTTP and drives headless Chromium at
a 412×915 phone viewport. It freezes the page clock to fixed instants to test
current/next-class detection deterministically, and it genuinely switches the
browser context offline to verify the service worker.

## Data notes and limitations

- **Start times only in the source.** The published timetable lists start
  times, not end times, so lengths are supplied by the app: lectures and
  tutorials run **50 minutes**, with a **5-minute break** before the next slot
  (which is why the grid steps in 55s), and labs run **160 minutes**. Both
  numbers live in one place, `DURATION_MINUTES` in `tools/build-data.js`
  (mirrored into `data/timetable.js` as `durations`); change them there and
  regenerate.
- **`(Tut)` means Tutorial.** Source lines such as
  `PH3104 (Tut) [G08] (Theory)` end in `(Theory)` but are tutorials; they are
  classified as Tutorial. Lines ending in `(Lab)` are Labs. Everything else is
  Theory.
- **Rooms are copied verbatim**, including what look like source typos — e.g.
  Wednesday 13:30 `PH4103` is published in `DBS 4th Year Lab` while the same
  course sits in `DPS 4th Year Lab` on Tuesday and Thursday. The app does not
  silently "fix" the source.
- **Same-slot duplicates are preserved.** Friday 09:50 `CH2104 (Tut)` is listed
  twice in two different rooms; both are kept as separate events.
- **Monday–Friday only.** The timetable itself has no Saturday/Sunday events:
  both show a weekend state with no classes, plus a pointer to the next
  upcoming class. Separately, the Today tab is aware of the institutional
  holidays and academic breaks in `data/holidays.js` (see above) — either
  takes precedence over the weekend message if they coincide, and both are
  unrelated to whether the date happens to be a weekday (Autumn Break starts
  on a Saturday; Winter Vacation starts on a Sunday).
- **`data/holidays.js` is specific to 2026** (Winter Vacation runs into
  January 2027) and does not repeat automatically in later years — a date
  outside either loaded list is simply not a holiday/break. Swap the file's
  contents for a future academic year's dates when needed.
- No end-of-semester exam dates, one-off reschedules or instructor names —
  the source data contains none of these. Mid-Sem exam dates, times and
  venues are covered separately (see "Mid-Sem examinations" above).
- Course names come from `Autumn_2026_Offered_Courses.csv`. All 122 timetabled
  codes matched a name.
- The selection is stored in `localStorage` under `iiserk.tt.courses.v1`, so it
  is per-browser and per-device, and clearing site data clears it. If storage is
  blocked entirely the app still runs, but the selection will not survive a
  reload. The same applies to timetable changes.
- **Editing a class's course code does not move it between courses.** Course
  filtering deliberately tests the *published* code, so if you edit a PH3102
  class and set its code to PH4101, it stays visible while PH3102 is selected —
  it is your edit of a PH3102 slot. This keeps the edit findable and
  manageable instead of silently vanishing because PH4101 was never selected.
- **Edits cannot create classes**, only reshape published ones. Adding a class
  that is not in the timetable is out of scope for this version.
- **Wed 13:30 CS2102 (Data Structures and Algorithms)** is published as
  Theory but genuinely runs 160 minutes — a documented, deliberate exception
  to the standard 50-minute Theory/Tutorial length (`tools/build-data.js`,
  `DURATION_OVERRIDES`). Duration follows the published class, including this
  exception, unless you explicitly edit either Duration or Type; switching a
  class's Type to Lab without touching Duration gives it the standard
  160-minute length rather than any published exception for the old type.
- Customisations for a class that a future dataset drops are kept in storage but
  ignored, so they reapply if that class returns.
