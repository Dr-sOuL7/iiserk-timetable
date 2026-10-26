// IISER-K Timetable reminder relay - Cloudflare Worker.
//
// Public API (JSON, CORS-restricted to the app's origin):
//   GET    /v1/config                        -> { vapidPublicKey }
//   POST   /v1/subscribe                     -> register / re-register a device, returns { id, token }
//   PUT    /v1/subscriptions/:id/schedule    -> replace the device's pending reminders
//   POST   /v1/subscriptions/:id/test        -> send one pre-encrypted test notification now
//   DELETE /v1/subscriptions/:id             -> forget the device
// Scheduled:
//   every minute   deliver due reminders (see planner.js for how bursts are spread)
//   daily          delete expired rows and dead subscriptions
//
// The Worker never sees what a reminder says: each body is encrypted on the
// device for that device. It stores opaque bytes plus fire times, and relays them.

import {
  b64uDecode, sha256Hex, timingSafeEqual, randomToken, intVar, nowSeconds
} from './util.js';
import { importVapid, isAllowedEndpoint, sendPush } from './webpush.js';
import { mustSendNow } from './planner.js';

const MAX_ITEMS = 300;               // pending reminders per device (client builds <= 300)
const MAX_BODY_CHARS = 6000;         // base64url length of one encrypted message (push limit is 4096 bytes)
const MAX_REQUEST_BYTES = 400000;
const HORIZON_SECONDS = 60 * 86400;
const SYNC_PER_HOUR = 40;
const TEST_INTERVAL_SECONDS = 30;
const MAX_ATTEMPTS = 3;
const STALE_CLAIM_SECONDS = 120;
const POOL = 6;                      // Workers allow 6 simultaneous outgoing connections
const PLAN_VIEW_MINUTES = 40;        // how far ahead pending demand is considered when planning a run

class HttpError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra || {}; }
}

function settings(env) {
  return {
    origins: String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    subject: env.VAPID_SUBJECT || 'mailto:admin@example.invalid',
    maxSubscriptions: intVar(env.MAX_SUBSCRIPTIONS, 5000, 1, 1000000),
    maxNewPerHour: intVar(env.MAX_NEW_SUBSCRIPTIONS_PER_HOUR, 120, 1, 100000),
    perTick: intVar(env.MAX_PUSHES_PER_TICK, 40, 1, 900),
    lookahead: intVar(env.LOOKAHEAD_MINUTES, 10, 0, 60),
    extraHosts: String(env.EXTRA_PUSH_HOSTS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  };
}

let vapidMemo = null;
async function getVapid(env) {
  const sig = env.VAPID_PUBLIC_KEY + '|' + env.VAPID_PRIVATE_KEY;
  if (vapidMemo && vapidMemo.sig === sig) return vapidMemo.value;
  const value = await importVapid(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidMemo = { sig, value };
  return value;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function respond(data, status, origin, headers) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }, origin ? corsHeaders(origin) : {}, headers || {})
  });
}

async function readJson(request) {
  const declared = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (declared > MAX_REQUEST_BYTES) throw new HttpError(413, 'too_large');
  const text = await request.text();
  if (text.length > MAX_REQUEST_BYTES) throw new HttpError(413, 'too_large');
  try { return JSON.parse(text); } catch (e) { throw new HttpError(400, 'invalid_json'); }
}

async function authenticate(db, request, id) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(request.headers.get('Authorization') || '');
  const row = /^[0-9a-f]{32}$/.test(id)
    ? await db.prepare('SELECT * FROM subscriptions WHERE id = ?1').bind(id).first()
    : null;
  // Hash even when the lookup failed so every rejection takes about the same time.
  const presented = await sha256Hex(m ? m[1] : 'none');
  if (!m || !row || !timingSafeEqual(presented, row.token_hash)) throw new HttpError(401, 'unauthorized');
  return row;
}

// ------------------------------------------------------------------ routes

async function subscribe(request, env, s, now) {
  const body = await readJson(request);
  const endpoint = body && body.endpoint;
  const proof = body && body.proof;
  if (!isAllowedEndpoint(endpoint, s.extraHosts)) throw new HttpError(400, 'bad_endpoint');
  if (typeof proof !== 'string' || !/^[0-9a-f]{64}$/.test(proof)) throw new HttpError(400, 'bad_proof');

  const db = env.DB;
  const id = (await sha256Hex(endpoint)).slice(0, 32);
  const proofHash = await sha256Hex(proof);
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const vapid = await getVapid(env);

  const existing = await db.prepare('SELECT proof_hash FROM subscriptions WHERE id = ?1').bind(id).first();
  if (existing) {
    // Same endpoint registering again (the device lost its token, or re-subscribed to the same
    // endpoint). Only a holder of the subscription's auth secret can reproduce the proof.
    if (!timingSafeEqual(proofHash, existing.proof_hash)) throw new HttpError(409, 'conflict');
    await db.prepare('UPDATE subscriptions SET token_hash = ?1, last_sync_at = ?2 WHERE id = ?3')
      .bind(tokenHash, now, id).run();
    return { status: 200, data: { id, token, vapid: vapid.publicKey } };
  }

  const total = await db.prepare('SELECT COUNT(*) AS n FROM subscriptions').first();
  if (total.n >= s.maxSubscriptions) throw new HttpError(503, 'capacity');
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE created_at > ?1').bind(now - 3600).first();
  if (recent.n >= s.maxNewPerHour) throw new HttpError(429, 'busy', { retryAfter: 600 });

  await db.prepare(
    'INSERT INTO subscriptions (id, endpoint, proof_hash, token_hash, created_at, last_sync_at) VALUES (?1, ?2, ?3, ?4, ?5, ?5)'
  ).bind(id, endpoint, proofHash, tokenHash, now).run();
  return { status: 201, data: { id, token, vapid: vapid.publicKey } };
}

function cleanItems(items, now) {
  if (!Array.isArray(items)) throw new HttpError(400, 'bad_items');
  if (items.length > MAX_ITEMS) throw new HttpError(400, 'too_many_items');
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') throw new HttpError(400, 'bad_item');
    const { k, f, s, t, h, b } = it;
    if (typeof k !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(k)) throw new HttpError(400, 'bad_key');
    if (!Number.isInteger(f) || !Number.isInteger(s)) throw new HttpError(400, 'bad_time');
    if (typeof t !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(t)) throw new HttpError(400, 'bad_topic');
    if (typeof h !== 'string' || !/^[0-9a-z]{1,20}$/.test(h)) throw new HttpError(400, 'bad_hash');
    if (typeof b !== 'string' || b.length < 100 || b.length > MAX_BODY_CHARS || !/^[A-Za-z0-9_-]+$/.test(b)) {
      throw new HttpError(400, 'bad_body');
    }
    if (f > now + HORIZON_SECONDS || s < f || s - f > 4 * 3600) throw new HttpError(400, 'bad_time');
    if (seen.has(k)) throw new HttpError(400, 'duplicate_key');
    seen.add(k);
    if (s <= now) continue;              // class has already started: nothing to remind about
    out.push({ k, f, s, t, h, b });
  }
  return out;
}

async function putSchedule(request, env, s, now, id) {
  const db = env.DB;
  const sub = await authenticate(db, request, id);
  const body = await readJson(request);
  const items = cleanItems(body && body.items, now);
  const tz = typeof (body && body.tz) === 'string' ? body.tz.slice(0, 64) : '';

  // Rate limit syncs per device per hour.
  let windowStart = sub.sync_window, count = sub.sync_count;
  if (now - windowStart >= 3600) { windowStart = now; count = 0; }
  if (count >= SYNC_PER_HOUR) throw new HttpError(429, 'rate_limited', { retryAfter: 3600 - (now - windowStart) });

  const keysJson = JSON.stringify(items.map((i) => i.k));
  const itemsJson = JSON.stringify(items);
  await db.batch([
    db.prepare('UPDATE subscriptions SET last_sync_at = ?1, sync_window = ?2, sync_count = ?3, tz = ?4 WHERE id = ?5')
      .bind(now, windowStart, count + 1, tz, id),
    // Reminders the device no longer wants (class edited, removed, course dropped...).
    // Already-sent and in-flight rows are kept so a re-sync can never cause a second delivery.
    db.prepare(
      'DELETE FROM reminders WHERE sub_id = ?1 AND state = 0 AND key NOT IN (SELECT value FROM json_each(?2))'
    ).bind(id, keysJson),
    // Insert new ones; update changed ones; leave identical, sent and claimed rows untouched.
    db.prepare(
      'INSERT INTO reminders (sub_id, key, fire_at, start_at, topic, h, body, state) ' +
      "SELECT ?1, json_extract(value, '$.k'), json_extract(value, '$.f'), json_extract(value, '$.s'), " +
      "json_extract(value, '$.t'), json_extract(value, '$.h'), json_extract(value, '$.b'), 0 " +
      'FROM json_each(?2) WHERE true ' +
      'ON CONFLICT (sub_id, key) DO UPDATE SET fire_at = excluded.fire_at, start_at = excluded.start_at, ' +
      'topic = excluded.topic, h = excluded.h, body = excluded.body ' +
      'WHERE reminders.state = 0 AND (reminders.h IS NOT excluded.h OR reminders.fire_at != excluded.fire_at ' +
      'OR reminders.start_at != excluded.start_at)'
    ).bind(id, itemsJson)
  ]);
  return { status: 200, data: { ok: true, stored: items.length } };
}

async function deleteSubscription(env, id) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM reminders WHERE sub_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM subscriptions WHERE id = ?1').bind(id)
  ]);
}

async function postTest(request, env, s, now, id, opts) {
  const sub = await authenticate(env.DB, request, id);
  if (now - sub.last_test_at < TEST_INTERVAL_SECONDS) {
    throw new HttpError(429, 'rate_limited', { retryAfter: TEST_INTERVAL_SECONDS - (now - sub.last_test_at) });
  }
  const body = await readJson(request);
  const b = body && body.b, t = body && body.t;
  if (typeof b !== 'string' || b.length < 100 || b.length > MAX_BODY_CHARS || !/^[A-Za-z0-9_-]+$/.test(b)) {
    throw new HttpError(400, 'bad_body');
  }
  await env.DB.prepare('UPDATE subscriptions SET last_test_at = ?1 WHERE id = ?2').bind(now, id).run();
  const vapid = await getVapid(env);
  const r = await sendPush(
    { endpoint: sub.endpoint, body: b64uDecode(b), ttl: 120, urgency: 'high', topic: typeof t === 'string' ? t : undefined },
    vapid, s.subject, now, { fetchFn: opts.fetchFn });
  if (r.gone) {
    await deleteSubscription(env, id);
    throw new HttpError(410, 'gone');
  }
  if (!r.ok) throw new HttpError(502, 'push_failed', { upstream: r.status });
  return { status: 200, data: { ok: true } };
}

export async function handleRequest(request, env, opts) {
  opts = opts || {};
  const now = opts.now !== undefined ? opts.now : nowSeconds();
  const s = settings(env);
  const origin = request.headers.get('Origin');
  const originOk = !origin || s.origins.includes(origin);
  const reply = (data, status, headers) => respond(data, status, originOk ? origin : null, headers);

  try {
    if (origin && !originOk) throw new HttpError(403, 'origin_not_allowed');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: origin ? corsHeaders(origin) : {} });

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    let m;

    if (request.method === 'GET' && path === '/v1/config') {
      const vapid = await getVapid(env);
      return reply({ vapidPublicKey: vapid.publicKey, maxItems: MAX_ITEMS }, 200);
    }
    if (request.method === 'GET' && path === '/v1/health') return reply({ ok: true }, 200);

    if (request.method === 'POST' && path === '/v1/subscribe') {
      const r = await subscribe(request, env, s, now);
      return reply(r.data, r.status);
    }
    if ((m = /^\/v1\/subscriptions\/([^/]+)\/schedule$/.exec(path)) && request.method === 'PUT') {
      const r = await putSchedule(request, env, s, now, m[1]);
      return reply(r.data, r.status);
    }
    if ((m = /^\/v1\/subscriptions\/([^/]+)\/test$/.exec(path)) && request.method === 'POST') {
      const r = await postTest(request, env, s, now, m[1], opts);
      return reply(r.data, r.status);
    }
    if ((m = /^\/v1\/subscriptions\/([^/]+)$/.exec(path)) && request.method === 'DELETE') {
      await authenticate(env.DB, request, m[1]);
      await deleteSubscription(env, m[1]);
      return reply({ ok: true }, 200);
    }
    throw new HttpError(404, 'not_found');
  } catch (err) {
    if (err instanceof HttpError) {
      const headers = err.extra.retryAfter ? { 'Retry-After': String(err.extra.retryAfter) } : {};
      const data = Object.assign({ error: err.code }, err.extra.upstream ? { upstream: err.extra.upstream } : {});
      return reply(data, err.status, headers);
    }
    console.error('unhandled error', err && err.message);
    return reply({ error: 'server_error' }, 500);
  }
}

// --------------------------------------------------------------- scheduled

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** One cron run: deliver what is due (or must start early to keep later minutes feasible). */
export async function runTick(env, opts) {
  opts = opts || {};
  const now = opts.now !== undefined ? opts.now : nowSeconds();
  const s = settings(env);
  const db = env.DB;
  const nowMinute = Math.floor(now / 60);
  const horizon = (nowMinute + s.lookahead) * 60 + 59;                 // what may be sent now
  const view = (nowMinute + Math.max(s.lookahead, PLAN_VIEW_MINUTES)) * 60 + 59;   // what is considered
  const stats = { claimed: 0, sent: 0, retried: 0, failed: 0, pruned: 0 };

  // Rows a crashed run left claimed become sendable again.
  await db.prepare('UPDATE reminders SET state = 0 WHERE state = 1 AND claimed_at < ?1').bind(now - STALE_CLAIM_SECONDS).run();

  const demand = await db.prepare(
    'SELECT fire_at / 60 AS minute, COUNT(*) AS n FROM reminders WHERE state = 0 AND start_at > ?1 AND fire_at <= ?2 GROUP BY minute'
  ).bind(now, view).all();
  const must = mustSendNow(demand.results.map((r) => ({ minute: r.minute, n: r.n })), nowMinute, s.perTick, s.lookahead);
  if (must <= 0) return stats;

  const claimed = await db.prepare(
    'UPDATE reminders SET state = 1, claimed_at = ?1, attempts = attempts + 1 ' +
    'WHERE id IN (SELECT id FROM reminders WHERE state = 0 AND start_at > ?1 AND fire_at <= ?2 ORDER BY fire_at, id LIMIT ?3) ' +
    'RETURNING id, sub_id, topic, body, start_at, attempts'
  ).bind(now, horizon, must).all();
  const rows = claimed.results;
  stats.claimed = rows.length;
  if (!rows.length) return stats;

  const subIds = [...new Set(rows.map((r) => r.sub_id))];
  const subs = await db.prepare('SELECT id, endpoint FROM subscriptions WHERE id IN (SELECT value FROM json_each(?1))')
    .bind(JSON.stringify(subIds)).all();
  const endpointOf = new Map(subs.results.map((r) => [r.id, r.endpoint]));

  const vapid = await getVapid(env);
  const jwtCache = new Map();
  const outcomes = await mapPool(rows, POOL, async (r) => {
    const endpoint = endpointOf.get(r.sub_id);
    if (!endpoint) return { r, kind: 'orphan' };
    const res = await sendPush({
      endpoint,
      body: b64uDecode(r.body),
      // Never let the push service hold a reminder past the class start.
      ttl: Math.max(30, Math.min(3600, r.start_at - now)),
      urgency: 'high',
      topic: r.topic
    }, vapid, s.subject, now, { fetchFn: opts.fetchFn, cache: jwtCache });
    if (res.ok) return { r, kind: 'sent' };
    if (res.gone) return { r, kind: 'gone' };
    if (res.retry && r.attempts < MAX_ATTEMPTS) return { r, kind: 'retry' };
    return { r, kind: res.status === 401 || res.status === 403 ? 'rejected' : 'failed' };
  });

  const ids = (kind) => JSON.stringify(outcomes.filter((o) => o.kind === kind).map((o) => o.r.id));
  const subsOf = (kind) => JSON.stringify([...new Set(outcomes.filter((o) => o.kind === kind).map((o) => o.r.sub_id))]);
  const count = (kind) => outcomes.filter((o) => o.kind === kind).length;
  stats.sent = count('sent');
  stats.retried = count('retry');
  stats.failed = count('failed') + count('rejected') + count('orphan');

  const statements = [];
  if (stats.sent) {
    statements.push(db.prepare('UPDATE reminders SET state = 2, sent_at = ?1 WHERE id IN (SELECT value FROM json_each(?2))').bind(now, ids('sent')));
    statements.push(db.prepare('UPDATE subscriptions SET failures = 0 WHERE id IN (SELECT value FROM json_each(?1))').bind(subsOf('sent')));
  }
  if (stats.retried) {
    statements.push(db.prepare('UPDATE reminders SET state = 0 WHERE id IN (SELECT value FROM json_each(?1))').bind(ids('retry')));
  }
  if (count('failed') + count('orphan')) {
    const dead = JSON.stringify(outcomes.filter((o) => o.kind === 'failed' || o.kind === 'orphan').map((o) => o.r.id));
    statements.push(db.prepare('UPDATE reminders SET state = 3 WHERE id IN (SELECT value FROM json_each(?1))').bind(dead));
  }
  if (count('rejected')) {
    // 401/403: the push service refuses us for this subscription (made for another VAPID key, or revoked).
    statements.push(db.prepare('UPDATE reminders SET state = 3 WHERE id IN (SELECT value FROM json_each(?1))').bind(ids('rejected')));
    statements.push(db.prepare('UPDATE subscriptions SET failures = failures + 1 WHERE id IN (SELECT value FROM json_each(?1))').bind(subsOf('rejected')));
  }
  if (count('gone')) {
    const gone = subsOf('gone');
    stats.pruned = JSON.parse(gone).length;
    statements.push(db.prepare('DELETE FROM reminders WHERE sub_id IN (SELECT value FROM json_each(?1))').bind(gone));
    statements.push(db.prepare('DELETE FROM subscriptions WHERE id IN (SELECT value FROM json_each(?1))').bind(gone));
  }
  if (statements.length) await db.batch(statements);
  return stats;
}

/** Daily housekeeping: expired rows, dead and long-abandoned subscriptions. */
export async function cleanup(env, opts) {
  opts = opts || {};
  const now = opts.now !== undefined ? opts.now : nowSeconds();
  const db = env.DB;
  const stale = now - 60 * 86400;
  const res = await db.batch([
    db.prepare('DELETE FROM reminders WHERE start_at < ?1').bind(now - 86400),
    db.prepare('DELETE FROM reminders WHERE sub_id IN (SELECT id FROM subscriptions WHERE last_sync_at < ?1 OR failures >= 5)').bind(stale),
    db.prepare('DELETE FROM subscriptions WHERE last_sync_at < ?1 OR failures >= 5').bind(stale)
  ]);
  return { reminders: res[0].meta.changes, orphaned: res[1].meta.changes, subscriptions: res[2].meta.changes };
}

export default {
  fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
  async scheduled(event, env, ctx) {
    if (event.cron === '17 3 * * *') ctx.waitUntil(cleanup(env));
    else ctx.waitUntil(runTick(env));
  }
};
