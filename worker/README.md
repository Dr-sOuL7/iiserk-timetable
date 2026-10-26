# Class-reminder relay (Cloudflare Worker)

GitHub Pages only serves static files, so it cannot wake a phone when a class is
about to start. This small Worker is the missing piece: it holds each device's
*already-encrypted* reminders and, once a minute, hands the due ones to the
browser's push service (FCM / Mozilla autopush / Apple), which delivers them to
the installed app **even when it is closed**.

It is optional. Without it the timetable works exactly as before and the
Settings "Class reminders" section hides itself (`apiBase` empty).

## How it works

```
 Phone/PC (GitHub Pages app)                     Cloudflare (this folder)              Browser push service
 ───────────────────────────                     ────────────────────────              ────────────────────
 1. user turns reminders On  ── permission ──►
 2. pushManager.subscribe(VAPID public key)
 3. POST /v1/subscribe  {endpoint, keys}   ───►  stores endpoint + SHA-256(token)
 4. builds the next 21 days of reminders
    from the *edited* timetable, encrypts each
    one itself (RFC 8291) and PUTs them     ───►  stores opaque ciphertext + fire time
                                                  cron, every minute:
                                                  due rows ─ VAPID-signed POST ──────►  delivers to the device
 5. service worker shows the notification ◄──────────────────────────────────────────  (app can be closed)
```

* **The Worker never sees class names, rooms or courses** – only "something
  fires at time T for endpoint E". The device encrypts every message for its own
  subscription, so the Worker only relays ciphertext. (This is also what makes
  the free plan work: Workers Free allows 10 ms CPU per invocation and encrypting
  a push costs ~1 ms, so doing it on the device removes the bottleneck.)
* The **schedule is computed on the device** from the user's selected courses,
  edits, removals, holidays, breaks, Mid-Sem exams and reminder settings, then
  *replaced* on the server (`PUT /v1/subscriptions/:id/schedule`). Anything the
  user edits or removes is deleted from the server on the next sync, which is
  how obsolete reminders are prevented.
* **Duplicates**: every reminder has a stable key (`start-minute.hash-of-classes`);
  re-uploading is an upsert, the notification `tag` is that key (a repeat replaces
  rather than stacks), a device registers once (re-registration proves ownership
  with a hash and reuses the id), and a sent row is never re-sent.
* **Times** are absolute instants computed in Asia/Kolkata on the device; the
  Worker only compares UNIX seconds, so time zones and DST do not matter to it.

## Free tier: what it costs

| Resource | Used for | Free allowance (documented by Cloudflare) | This project |
| --- | --- | --- | --- |
| Workers requests | API calls + cron | 100,000 / day | a few per device per day |
| Cron Triggers | minute sender + daily cleanup | 5 per account | uses 2 |
| Worker CPU | each invocation | 10 ms | comfortably inside for one tick: no crypto, ≤ 40 pushes |
| Subrequests | pushes per cron run | 50 per invocation | capped at 40 (`MAX_PUSHES_PER_TICK`) |
| D1 database | subscriptions + reminders | 5 GB; 5 M rows read / 100 k rows written per day | ~300 small rows per device; partial indexes keep the minute scan cheap |

Practical capacity on the free plan: roughly **40 reminders per minute**. A
burst larger than that (many students with a 10:00 class) is spread backwards in
time by the planner – it starts up to `LOOKAHEAD_MINUTES` (default 10) early,
never late – so ~400 simultaneous reminders still go out on time. Beyond that
reminders degrade to *late*, never silently lost. For a large user base use the
Workers Paid plan (about US$5/month; higher CPU and 1,000 subrequests) and raise
`MAX_PUSHES_PER_TICK`. Check the current limits at
<https://developers.cloudflare.com/workers/platform/limits/> and
<https://developers.cloudflare.com/d1/platform/limits/> before relying on them –
plans change.

Push services themselves (FCM, Mozilla, Apple) do not charge.

## Security model

* **No secrets in the browser.** The only client configuration is `apiBase`. The
  VAPID *public* key is fetched from `/v1/config`. The VAPID *private* key exists
  only as a Wrangler secret.
* **Per-device bearer token** (32 random bytes). Only its SHA-256 is stored; a
  database leak does not let anyone change a schedule. Re-registration requires
  a proof derived from the subscription's own auth secret, so a third party who
  learns an endpoint URL cannot take over or evict that device.
* **Endpoint allow-list.** Only the real push-service hosts (FCM, Mozilla, Apple,
  Windows/WNS) over https are accepted – the Worker cannot be turned into an open
  server-side-request-forgery relay.
* **CORS / Origin allow-list** (`ALLOWED_ORIGINS`) – browser pages from other
  sites are refused.
* **Abuse limits:** `MAX_SUBSCRIPTIONS`, `MAX_NEW_SUBSCRIPTIONS_PER_HOUR`, 300
  reminders per device, 40 schedule uploads per device per hour, one test message
  per 30 s, request-size and payload-shape validation.
* **Stale data:** 404/410 from a push service deletes the subscription at once;
  repeated failures and subscriptions silent for 60 days are removed by the
  nightly cleanup; sent and old rows are deleted.
* **Privacy:** the server stores push endpoints, key material for the endpoint,
  fire times and ciphertext. It never stores names, emails or course codes in
  readable form.

## Deployment (about 10 minutes, no card needed)

Prerequisites: a free Cloudflare account and Node 18+.

```bash
cd worker
npm install -g wrangler            # or prefix the commands below with: npx wrangler@3
wrangler login

# 1. Database
wrangler d1 create iiserk-reminders
#    -> copy the printed database_id into worker/wrangler.toml (database_id = "...")
wrangler d1 execute iiserk-reminders --remote --file=./schema.sql

# 2. VAPID key pair (once; keep the private key somewhere safe, e.g. a password manager)
node ../tools/generate-vapid-keys.js
#    -> put the PUBLIC key in wrangler.toml (VAPID_PUBLIC_KEY)
wrangler secret put VAPID_PRIVATE_KEY       # paste the private key when asked

# 3. Settings in wrangler.toml
#    ALLOWED_ORIGINS = "https://<your-github-username>.github.io"   (origin only, no path)
#    VAPID_SUBJECT   = "mailto:you@your-domain"                     (a real contact address)

# 4. Deploy
wrangler deploy
#    -> prints https://iiserk-reminders.<your-subdomain>.workers.dev
```

Then point the app at it. In the repository root edit `data/reminders-config.js`:

```js
window.REMINDER_CONFIG = { apiBase: 'https://iiserk-reminders.<your-subdomain>.workers.dev' };
```

and **bump `CACHE` in `sw.js`** (so installed copies pick the file up on the next
refresh), commit and push to the branch GitHub Pages serves.

Smoke test: open the app → Settings → Class reminders → On → allow notifications
→ **Send a test notification**. Check live logs with `wrangler tail`.

### Local development

```bash
node ../tools/generate-vapid-keys.js --dev-vars   # writes git-ignored worker/.dev.vars
wrangler dev --test-scheduled                      # http://localhost:8787, local D1
wrangler d1 execute iiserk-reminders --local --file=./schema.sql
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"   # run one tick
```

Set `apiBase: 'http://localhost:8787'` (plain http is only accepted for localhost)
and add the dev page origin to `ALLOWED_ORIGINS` in `.dev.vars`.

## Maintenance

| When | What |
| --- | --- |
| Never needed | Subscriptions, stale rows and dead devices clean themselves up (daily cron). |
| Occasionally | Glance at the Cloudflare dashboard → Workers → *iiserk-reminders* → Metrics: errors, CPU time (the free plan kills runs over 10 ms) and subrequest errors. |
| Rotating the VAPID key | Change `VAPID_PUBLIC_KEY` + secret, deploy. Existing browser subscriptions were bound to the old key, so every device re-subscribes automatically the next time the app is opened (until then they cannot be reached). |
| Timetable changes | Nothing to do on the backend: the schedule is rebuilt on each device from the app's data the next time the app is opened. Ship the new data and bump the service-worker cache as usual. |
| Growing past ~400 simultaneous reminders | Workers Paid + raise `MAX_PUSHES_PER_TICK`. |
| Wiping everything | `wrangler d1 execute iiserk-reminders --remote --command "DELETE FROM reminders; DELETE FROM subscriptions;"` – devices re-register on next open. |

## What is *not* guaranteed

Web Push is best-effort. The Worker, the push service and the OS all sit between
the schedule and the screen.

* **Android (Chrome, Edge, Samsung Internet, Firefox):** works with the app closed.
  Aggressive battery managers (some Xiaomi/Oppo/Samsung settings), "Force stop",
  Doze and data saver can delay or drop pushes.
* **iPhone / iPad:** iOS/iPadOS 16.4+ **and the app must be added to the Home
  Screen** (Share → Add to Home Screen). Safari tabs cannot receive push. Do Not
  Disturb / Focus modes apply. The permission prompt can only appear after a tap.
* **Windows / macOS / Linux desktop:** Chrome and Edge deliver only while the
  *browser* is running (it may be in the background); if it is completely quit
  nothing arrives until it starts. Firefox is similar. Safari on macOS 13+
  supports Web Push for Home Screen-style web apps added to the Dock.
  OS "Focus / Do Not Disturb" suppresses banners.
* **Offline phone:** the push service holds a message for a limited time and
  delivers it when the device reconnects; reminders carry a short TTL, so one
  that arrives long after the class started is dropped rather than shown late.
* **Edits made while offline** reach the server only when the device is online
  again (the app retries automatically). Until then a reminder for a class you
  just removed could still fire.
* **21-day horizon:** the device uploads three weeks ahead. If the app is not
  opened for longer than that, reminders stop until it is opened once.
* Clearing site data or uninstalling the app deletes the browser subscription; the
  server entry is cleaned up on the first failed delivery (HTTP 404/410) or by the
  60-day cleanup, and a reinstall creates a new, single subscription.
* Several devices each get their own reminder by design.
* The free-plan CPU limit for the minute cron has been measured in a local
  workerd only; watch the Metrics tab after deploying.
