# IISER Kolkata Timetable (PWA)

An offline-first personal class timetable for IISER Kolkata, Autumn 2026.
Pick your courses once; the app then opens straight to today's classes, tells you
what is running right now and what is next, and keeps working with no network.
Individual classes can be edited or removed, and those changes persist offline.

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
| `manifest.json` | Web App Manifest (name, display mode, colours, icons). |
| `sw.js` | Service worker: precaches the shell, serves it offline. |
| `icons/` | PNG app icons (192, 512, maskable 512, apple-touch). |
| `.nojekyll` | Tells GitHub Pages to serve the files as-is. |
| `tools/raw/` | The source timetable text and the offered-courses CSV. |
| `tools/build-data.js` | Regenerates `data/timetable.js` from `tools/raw/`. |
| `tools/validate-data.js` | Data checks of the generated dataset against the raw source. |
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
| `iiserk.tt.theme.v1` | Auto / light / dark. |

They are deliberately separate: **Reset courses** clears only the selection, so
re-picking a course brings its customisations back rather than silently losing
them. Malformed, unknown or wrongly-typed stored values are discarded on load,
so a corrupted entry degrades to "no customisations" instead of breaking the
app. With no keys set, the app behaves exactly as it did before the feature
existed.

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
node tools/validate-data.js                       # data checks
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
- **Monday–Friday only.** Saturday and Sunday are holidays: both show a
  weekend state with no events, plus a pointer to the next upcoming class.
- No public/academic-calendar holidays, exam dates, one-off reschedules or
  instructor names — the source data contains none of these.
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
