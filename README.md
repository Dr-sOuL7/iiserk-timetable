# IISER Kolkata Timetable (PWA)

An offline-first personal class timetable for IISER Kolkata, Autumn 2026.
Pick your courses once; the app then opens straight to today's classes, tells you
what is running right now and what is next, and keeps working with no network.

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
| `tools/validate-data.js` | 19 checks of the generated data against the raw source. |
| `tools/make-icons.py` | Regenerates `icons/` (pure Python, no image libraries). |
| `tests/app.test.js` | 84 end-to-end browser checks (Playwright + headless Chromium). |

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

## Replacing the timetable

The dataset is deliberately separate from the UI. Either edit
`tools/raw/timetable.txt` and regenerate:

```bash
node tools/build-data.js      # rewrites data/timetable.js
node tools/validate-data.js   # 19 data checks
```

…or replace `data/timetable.js` by hand, keeping the shape:

```js
{ id: 'e0001', day: 'Monday', time: '08:55', minutes: 535,
  duration: 55, course: 'PH3104', type: 'Theory', room: 'G08' }
```

No UI code needs to change.

## Tests

```bash
node tools/validate-data.js                       # 19 data checks
NODE_PATH=$(npm root -g) node tests/app.test.js   # 84 browser checks
```

The browser suite serves the real site over HTTP and drives headless Chromium at
a 412×915 phone viewport. It freezes the page clock to fixed instants to test
current/next-class detection deterministically, and it genuinely switches the
browser context offline to verify the service worker.

## Data notes and limitations

- **Start times only.** The published timetable lists start times, not end
  times. Durations are display-only assumptions from the 55-minute slot grid:
  55 minutes for Theory and Tutorial, 165 minutes for Lab. They affect the
  "current class" window, the "minutes remaining" figure and the `55 min` label
  — nothing else. Both numbers live in one place, `DURATION_MINUTES` in
  `tools/build-data.js` (mirrored into `data/timetable.js` as `durations`).
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
- Monday–Friday only; the source has no weekend classes. Saturday and Sunday
  show a weekend state plus the next upcoming class.
- No holidays, exam dates, one-off reschedules or instructor names — the source
  data contains none of these.
- Course names come from `Autumn_2026_Offered_Courses.csv`. All 122 timetabled
  codes matched a name.
- The selection is stored in `localStorage` under `iiserk.tt.courses.v1`, so it
  is per-browser and per-device, and clearing site data clears it. If storage is
  blocked entirely the app still runs, but the selection will not survive a
  reload.
