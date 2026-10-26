#!/usr/bin/env node
/**
 * Tests for the reminder relay (worker/), run against the real Worker code with a
 * SQLite-backed D1 stand-in and a fake push service. Development only.
 *
 * Run: node tests/worker.test.mjs
 */
import { createD1 } from './helpers/d1-shim.mjs';
import { handleRequest, runTick, cleanup } from '../worker/src/index.js';
import { mustSendNow } from '../worker/src/planner.js';
import { isAllowedEndpoint, importVapid, vapidAuthorization, sendPush } from '../worker/src/webpush.js';
import { b64uEncode, b64uDecode, sha256Hex, timingSafeEqual } from '../worker/src/util.js';

process.removeAllListeners('warning');   // node:sqlite prints an experimental-feature notice

let passed = 0, failed = 0;
function check(name, ok, detail) {
  (ok ? passed++ : failed++);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`);
}
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  check(name, a === e, a === e ? String(a).slice(0, 90) : `got ${a}, want ${e}`);
};

const ORIGIN = 'https://app.example.github.io';
const T0 = 29883000 * 60;                       // a whole minute, in unix seconds

async function genVapid() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pub = new Uint8Array([4, ...b64uDecode(jwk.x), ...b64uDecode(jwk.y)]);
  return { pub: b64uEncode(pub), priv: jwk.d, publicKey: pair.publicKey };
}

const vapid = await genVapid();
function makeEnv(extra) {
  return Object.assign({
    DB: createD1(),
    VAPID_PUBLIC_KEY: vapid.pub,
    VAPID_PRIVATE_KEY: vapid.priv,
    VAPID_SUBJECT: 'mailto:ops@example.com',
    ALLOWED_ORIGINS: ORIGIN
  }, extra || {});
}

async function call(env, method, path, o) {
  o = o || {};
  const headers = {};
  if (o.origin !== null) headers.Origin = o.origin || ORIGIN;
  if (o.token) headers.Authorization = 'Bearer ' + o.token;
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  const req = new Request('https://relay.test' + path, {
    method, headers, body: o.body === undefined ? undefined : (typeof o.body === 'string' ? o.body : JSON.stringify(o.body))
  });
  const res = await handleRequest(req, env, { now: o.now === undefined ? T0 : o.now, fetchFn: o.fetchFn });
  let json = null;
  try { json = await res.json(); } catch (e) { json = null; }
  return { status: res.status, json, headers: res.headers };
}

let counter = 0;
async function register(env, o) {
  o = o || {};
  const endpoint = o.endpoint || `https://fcm.googleapis.com/fcm/send/device-${++counter}-${Math.random().toString(36).slice(2)}`;
  const proof = o.proof || await sha256Hex('proof-' + endpoint);
  const r = await call(env, 'POST', '/v1/subscribe', { body: { endpoint, proof }, now: o.now });
  return { endpoint, proof, res: r, id: r.json && r.json.id, token: r.json && r.json.token };
}

function bodyOf(seed) { return b64uEncode(crypto.getRandomValues(new Uint8Array(150))) + (seed || ''); }
function item(k, fire, start, over) {
  return Object.assign({ k, f: fire, s: start, t: 'r' + k.replace(/[^A-Za-z0-9]/g, '').slice(0, 10), h: 'h' + k.replace(/[^a-z0-9]/g, '').slice(0, 8), b: bodyOf() }, over || {});
}
const put = (env, sub, items, o) => call(env, 'PUT', `/v1/subscriptions/${sub.id}/schedule`,
  Object.assign({ token: sub.token, body: { items, tz: 'Asia/Kolkata' } }, o || {}));

function pushService(statusFor) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });
    const status = typeof statusFor === 'function' ? statusFor(url, calls.length) : (statusFor || 201);
    return new Response(null, { status });
  };
  return { fetchFn, calls };
}

// ======================================================= planner
{
  const mc = (pairs) => pairs.map(([minute, n]) => ({ minute, n }));
  eq('nothing pending -> send nothing', mustSendNow([], 100, 40, 10), 0);
  eq('(the counterexample that broke the first planner) chained loads 22:2 23:2 24:1 at capacity 1, look-ahead 2: one must go a minute early', mustSendNow(mc([[22, 2], [23, 2], [24, 1]]), 20, 1, 2), 1);
  eq('light load: only what is due now', mustSendNow(mc([[100, 3], [105, 2]]), 100, 40, 10), 3);
  eq('reminders due later are left for later', mustSendNow(mc([[103, 5]]), 100, 40, 10), 0);
  eq('overdue reminders count as due now', mustSendNow(mc([[90, 4], [100, 1]]), 100, 40, 10), 5);
  eq('capacity caps a single run', mustSendNow(mc([[100, 100]]), 100, 40, 10), 40);
  eq('a burst 3 minutes away still fits: start nothing yet', mustSendNow(mc([[103, 100]]), 100, 40, 10), 0);
  eq('...2 minutes away: 20 must start now', mustSendNow(mc([[102, 100]]), 100, 40, 10), 20);
  eq('...1 minute away it is no longer fully feasible (80 < 100): send at capacity', mustSendNow(mc([[101, 100]]), 100, 40, 10), 40);
  eq('...1 minute away with 70: 30 must start now', mustSendNow(mc([[101, 70]]), 100, 40, 10), 30);
  eq('items beyond the look-ahead are ignored', mustSendNow(mc([[120, 500]]), 100, 40, 10), 0);
  eq('look-ahead 0 means strictly on time', mustSendNow(mc([[101, 100]]), 100, 40, 0), 0);

  // property: whenever a workload CAN be delivered on time (Hall's condition, with each reminder
  // sendable only within the look-ahead window before its minute), simulating the planner does so.
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let allOnTime = true, neverOver = true, earlyEnough = true, feasibleTrials = 0;
  const horizon = 30;
  for (let trial = 0; trial < 800; trial++) {
    const cap = 1 + Math.floor(rnd() * 12), look = Math.floor(rnd() * 8);
    const d = new Array(horizon).fill(0);
    for (let m = 0; m < horizon; m++) if (rnd() < 0.3) d[m] = Math.floor(rnd() * cap * (look + 2) * 0.6);
    let feasible = true;
    for (let a = 0; a < horizon && feasible; a++) {
      let sum = 0;
      for (let b = a; b < horizon; b++) { sum += d[b]; if (sum > cap * (b - a + look + 1)) { feasible = false; break; } }
    }
    if (!feasible) continue;
    feasibleTrials++;
    const left = new Map(d.map((n, m) => [m, n]).filter(([, n]) => n > 0));
    const firstTick = {};                                // earliest tick any reminder of minute m went out
    for (let now = -look; now < horizon + 1; now++) {
      const counts = [];
      for (const [m, n] of left) if (n > 0) counts.push({ minute: m, n });
      const must = mustSendNow(counts, now, cap, look);
      if (must > cap) neverOver = false;
      let todo = must;
      for (const m of [...left.keys()].sort((a, b) => a - b)) {       // earliest deadline first
        if (!todo) break;
        const take = Math.min(left.get(m), todo);
        if (take) { left.set(m, left.get(m) - take); todo -= take; if (firstTick[m] === undefined) firstTick[m] = now; }
      }
      for (const [m, n] of left) if (m <= now && n > 0) allOnTime = false;    // deadline passed unsent
    }
    for (const m of Object.keys(firstTick)) if (Number(m) - firstTick[m] > look) earlyEnough = false;
  }
  check('property: enough random workloads were feasible to mean something', feasibleTrials >= 200, `${feasibleTrials}/800`);
  check('property: every feasible workload is delivered by each reminder\'s minute', allOnTime);
  check('property: a run never exceeds its capacity', neverOver);
  check('property: nothing is ever sent earlier than the look-ahead allows', earlyEnough);
}

// ======================================================= endpoint allow-list
{
  const ok = [
    'https://fcm.googleapis.com/fcm/send/abc', 'https://fcm.googleapis.com/wp/xyz',
    'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://web.push.apple.com/QWERTY',
    'https://wns2-par02p.notify.windows.com/w/?token=abc'
  ];
  const bad = [
    'http://fcm.googleapis.com/fcm/send/abc', 'https://evil.example.com/fcm/send/abc',
    'https://fcm.googleapis.com.evil.example/x', 'https://user:pw@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x', 'https://127.0.0.1/x', 'https://localhost/x',
    'ftp://fcm.googleapis.com/x', 'not a url', '', null, 42, 'https://fcm.googleapis.com/' + 'a'.repeat(800),
    'https://notify.windows.com.attacker.io/x', 'https://169.254.169.254/latest/meta-data'
  ];
  check('real push-service hosts are accepted', ok.every((u) => isAllowedEndpoint(u)));
  check('anything else is refused (no http, userinfo, ports, IPs, look-alike hosts, metadata addresses)', bad.every((u) => !isAllowedEndpoint(u)));
  check('extra hosts can be allowed explicitly (development)', isAllowedEndpoint('https://localhost/x', ['localhost']));
}

// ======================================================= VAPID + delivery
{
  const v = await importVapid(vapid.pub, vapid.priv);
  const cache = new Map();
  const auth = await vapidAuthorization(v, 'https://fcm.googleapis.com/fcm/send/abc', 'mailto:ops@example.com', T0, cache);
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(auth);
  check('Authorization uses the RFC 8292 "vapid t=..., k=..." form', !!m);
  eq('k is the public key', m[2], vapid.pub);
  const [h, c, sig] = m[1].split('.');
  const header = JSON.parse(new TextDecoder().decode(b64uDecode(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64uDecode(c)));
  eq('JWT header', header, { typ: 'JWT', alg: 'ES256' });
  eq('aud is the push service ORIGIN only', claims.aud, 'https://fcm.googleapis.com');
  eq('sub is the contact', claims.sub, 'mailto:ops@example.com');
  check('exp is within 24 hours (RFC 8292) and in the future', claims.exp > T0 && claims.exp - T0 <= 24 * 3600, `${claims.exp - T0}s`);
  const valid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vapid.publicKey, b64uDecode(sig), new TextEncoder().encode(h + '.' + c));
  check('signature verifies against the public key (raw r||s form)', valid && b64uDecode(sig).length === 64);
  const again = await vapidAuthorization(v, 'https://fcm.googleapis.com/other/path', 'mailto:ops@example.com', T0 + 60, cache);
  eq('one signed token is reused per push-service origin', again, auth);
  const apple = await vapidAuthorization(v, 'https://web.push.apple.com/x', 'mailto:ops@example.com', T0, cache);
  check('a different origin gets its own token', apple !== auth);

  let failedToImport = false;
  try { await importVapid('AAAA', vapid.priv); } catch (e) { failedToImport = true; }
  check('a malformed VAPID key is rejected loudly', failedToImport);

  const svc = pushService(201);
  const r = await sendPush({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', body: b64uDecode(bodyOf()), ttl: 300, urgency: 'high', topic: 'rabc123' }, v, 'mailto:ops@example.com', T0, { fetchFn: svc.fetchFn, cache });
  const hd = svc.calls[0].headers;
  eq('delivery headers', [hd['Content-Encoding'], hd['TTL'], hd['Urgency'], hd['Topic'], hd['Content-Type']], ['aes128gcm', '300', 'high', 'rabc123', 'application/octet-stream']);
  check('the encrypted body is forwarded untouched', svc.calls[0].body instanceof Uint8Array && svc.calls[0].body.length > 100);
  eq('201 is success', [r.ok, r.gone, r.retry], [true, false, false]);

  const classify = async (status) => (await sendPush({ endpoint: 'https://fcm.googleapis.com/x', body: new Uint8Array(10), ttl: 60 }, v, 's', T0, { fetchFn: pushService(status).fetchFn }));
  const gone404 = await classify(404), gone410 = await classify(410), r429 = await classify(429), r503 = await classify(503), r400 = await classify(400), r403 = await classify(403);
  eq('404/410 mean the subscription is gone', [gone404.gone, gone410.gone], [true, true]);
  eq('429/5xx are retryable', [r429.retry, r503.retry], [true, true]);
  eq('400/403 are neither success, gone nor retryable', [r400.ok || r400.gone || r400.retry, r403.ok || r403.gone || r403.retry], [false, false]);
  const netFail = await sendPush({ endpoint: 'https://fcm.googleapis.com/x', body: new Uint8Array(10), ttl: 60 }, v, 's', T0, { fetchFn: async () => { throw new TypeError('network'); } });
  eq('a network failure is retryable', [netFail.ok, netFail.retry], [false, true]);
  const badTopic = pushService(201);
  await sendPush({ endpoint: 'https://fcm.googleapis.com/x', body: new Uint8Array(10), ttl: 60, topic: 'bad topic!!' }, v, 's', T0, { fetchFn: badTopic.fetchFn });
  check('an invalid Topic header is omitted rather than breaking delivery', !('Topic' in badTopic.calls[0].headers));
}

check('timingSafeEqual', timingSafeEqual('abc', 'abc') && !timingSafeEqual('abc', 'abd') && !timingSafeEqual('abc', 'abcd') && !timingSafeEqual('a', undefined));

// ======================================================= HTTP API
{
  const env = makeEnv();

  const cfg = await call(env, 'GET', '/v1/config');
  eq('GET /v1/config returns the public key and nothing secret', [cfg.status, cfg.json.vapidPublicKey, JSON.stringify(cfg.json).includes(vapid.priv)], [200, vapid.pub, false]);
  eq('CORS: the app origin is echoed (never *)', cfg.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  eq('responses are never cached', cfg.headers.get('Cache-Control'), 'no-store');

  const pre = await call(env, 'OPTIONS', '/v1/subscribe');
  eq('preflight from the app origin: 204 with allowed methods/headers',
    [pre.status, pre.headers.get('Access-Control-Allow-Headers')], [204, 'Authorization, Content-Type']);
  const foreign = await call(env, 'GET', '/v1/config', { origin: 'https://evil.example' });
  eq('a browser request from another origin is refused', [foreign.status, foreign.json.error, foreign.headers.get('Access-Control-Allow-Origin')], [403, 'origin_not_allowed', null]);
  const foreignPre = await call(env, 'OPTIONS', '/v1/subscribe', { origin: 'https://evil.example' });
  eq('...including its preflight', foreignPre.status, 403);
  eq('non-browser clients (no Origin) are not blocked by CORS (they still need credentials)', (await call(env, 'GET', '/v1/health', { origin: null })).status, 200);
  eq('unknown routes are 404', (await call(env, 'GET', '/v1/nope')).status, 404);
  eq('wrong method on a known route is 404', (await call(env, 'GET', '/v1/subscribe')).status, 404);

  // ---- subscribe
  const a = await register(env);
  eq('new device: 201 with id, token and the public key', [a.res.status, /^[0-9a-f]{32}$/.test(a.id), a.token.length >= 43, a.res.json.vapid], [201, true, true, vapid.pub]);
  const row = env.DB.rows('SELECT * FROM subscriptions WHERE id = ?', a.id)[0];
  check('the bearer token is stored only as a hash', row.token_hash !== a.token && row.token_hash === await sha256Hex(a.token) && !JSON.stringify(row).includes(a.token));
  check('the proof is stored hashed too', row.proof_hash === await sha256Hex(a.proof));
  check('no encryption keys are stored (the server cannot read reminders)', !('p256dh' in row) && !('auth' in row));

  const bad1 = await call(env, 'POST', '/v1/subscribe', { body: { endpoint: 'https://evil.example/x', proof: 'a'.repeat(64) } });
  eq('endpoint on an unknown host: 400', [bad1.status, bad1.json.error], [400, 'bad_endpoint']);
  const bad2 = await call(env, 'POST', '/v1/subscribe', { body: { endpoint: 'https://fcm.googleapis.com/fcm/send/x', proof: 'nothex' } });
  eq('malformed proof: 400', [bad2.status, bad2.json.error], [400, 'bad_proof']);
  eq('invalid JSON: 400', (await call(env, 'POST', '/v1/subscribe', { body: '{nope' })).status, 400);
  eq('oversized request: 413', (await call(env, 'POST', '/v1/subscribe', { body: 'x'.repeat(500000) })).status, 413);

  const again = await register(env, { endpoint: a.endpoint, proof: a.proof });
  eq('same device re-registering (lost its token): 200 and a NEW token', [again.res.status, again.id === a.id, again.token !== a.token], [200, true, true]);
  eq('the old token stopped working', (await put(env, { id: a.id, token: a.token }, [])).status, 401);
  eq('the new token works', (await put(env, { id: a.id, token: again.token }, [])).status, 200);
  const hijack = await register(env, { endpoint: a.endpoint, proof: await sha256Hex('someone else') });
  eq('someone who knows only the endpoint cannot take over the registration', hijack.res.status, 409);
  a.token = again.token;

  // ---- auth
  const b = await register(env);
  eq('missing credentials: 401', (await call(env, 'PUT', `/v1/subscriptions/${b.id}/schedule`, { body: { items: [] } })).status, 401);
  eq('another device\'s token: 401', (await put(env, { id: b.id, token: a.token }, [])).status, 401);
  eq('garbage id: 401 (no information leak)', (await put(env, { id: 'not-a-valid-id', token: b.token }, [])).status, 401);
  eq('unknown id: 401', (await put(env, { id: '0'.repeat(32), token: b.token }, [])).status, 401);

  // ---- schedule validation
  const F = T0 + 600, S = T0 + 900;
  const bad = async (items) => (await put(env, b, items)).json.error;
  eq('not an array', await bad('x'), 'bad_items');
  eq('too many items', await bad(Array.from({ length: 301 }, (_, i) => item('k' + i, F, S))), 'too_many_items');
  eq('bad key', await bad([item('has space', F, S)]), 'bad_key');
  eq('bad time (start before fire)', await bad([item('k1', S, F)]), 'bad_time');
  eq('bad time (fire absurdly far away)', await bad([item('k1', T0 + 90 * 86400, T0 + 90 * 86400 + 600)]), 'bad_time');
  eq('bad time (lead beyond 4 hours)', await bad([item('k1', F, F + 5 * 3600)]), 'bad_time');
  eq('bad topic', await bad([item('k1', F, S, { t: 'has space' })]), 'bad_topic');
  eq('body too short', await bad([item('k1', F, S, { b: 'abc' })]), 'bad_body');
  eq('body not base64url', await bad([item('k1', F, S, { b: '!'.repeat(200) })]), 'bad_body');
  eq('duplicate keys', await bad([item('k1', F, S), item('k1', F, S)]), 'duplicate_key');
  eq('non-object item', await bad([null]), 'bad_item');

  // ---- schedule semantics
  const x = await register(env);
  const i1 = item('c1', F, S), i2 = item('c2', F + 3600, S + 3600), i3 = item('c3', F + 7200, S + 7200);
  eq('first sync stores everything', (await put(env, x, [i1, i2, i3])).json, { ok: true, stored: 3 });
  const idsOf = () => Object.fromEntries(env.DB.rows('SELECT key, id FROM reminders WHERE sub_id = ?', x.id).map((r) => [r.key, r.id]));
  const ids1 = idsOf();
  eq('three pending rows', Object.keys(ids1).sort(), ['c1', 'c2', 'c3']);

  const writesBefore = env.DB.stats.writes;
  await put(env, x, [i1, i2, i3]);
  const writesIdentical = env.DB.stats.writes - writesBefore;
  check('re-syncing an identical schedule rewrites no reminder rows (only the subscription\'s own bookkeeping)', writesIdentical <= 1, `${writesIdentical} row writes`);
  eq('...and the same row ids remain', idsOf(), ids1);

  await put(env, x, [i1, Object.assign({}, i2, { h: 'changed', b: bodyOf('X') }), item('c4', F + 9000, S + 9000)]);
  const ids2 = idsOf();
  eq('replace semantics: dropped c3 is deleted, c4 added', Object.keys(ids2).sort(), ['c1', 'c2', 'c4']);
  eq('a changed reminder is updated IN PLACE (never duplicated)', [ids2.c1 === ids1.c1, ids2.c2 === ids1.c2], [true, true]);
  check('the update replaced its body', env.DB.rows('SELECT h FROM reminders WHERE sub_id = ? AND key = ?', x.id, 'c2')[0].h === 'changed');

  await put(env, x, [i1, Object.assign({}, i2, { f: F + 1800 })]);
  eq('moving only the fire time (user changed the lead) updates the row', env.DB.rows('SELECT fire_at FROM reminders WHERE sub_id = ? AND key = ?', x.id, 'c2')[0].fire_at, F + 1800);

  env.DB.db.prepare("UPDATE reminders SET state = 2, sent_at = ? WHERE sub_id = ? AND key = 'c1'").run(T0, x.id);
  await put(env, x, [Object.assign({}, i1, { h: 'new', f: F + 100 }), i2]);
  const c1 = env.DB.rows("SELECT state, h FROM reminders WHERE sub_id = ? AND key = 'c1'", x.id)[0];
  eq('an already-sent reminder is never reset or re-sent by a later sync', [c1.state, c1.h], [2, 'h' + 'c1']);
  await put(env, x, [i2]);
  eq('...and a sync that omits it does not erase the record of having sent it', env.DB.rows("SELECT state FROM reminders WHERE sub_id = ? AND key = 'c1'", x.id)[0].state, 2);

  const past = await put(env, x, [item('old', T0 - 900, T0 - 600), i2], { now: T0 });
  eq('classes that have already started are not stored', env.DB.rows("SELECT key FROM reminders WHERE sub_id = ? AND key = 'old'", x.id).length, 0);

  // ---- rate limit
  const y = await register(env);
  let last;
  for (let n = 0; n < 41; n++) last = await put(env, y, [item('r', F, S)]);
  eq('the 41st sync within an hour is refused with Retry-After', [last.status, last.json.error, Number(last.headers.get('Retry-After')) > 0], [429, 'rate_limited', true]);
  eq('...and allowed again an hour later', (await put(env, y, [item('r', F + 7200, S + 7200)], { now: T0 + 3601 })).status, 200);

  // ---- query budget (Workers Free: 50 D1 queries / invocation)
  const q0 = env.DB.stats.queries;
  await put(env, x, [i2]);
  check('a schedule sync uses a handful of D1 queries (limit 50)', env.DB.stats.queries - q0 <= 6, `${env.DB.stats.queries - q0}`);

  // ---- capacity limits
  const small = makeEnv({ MAX_SUBSCRIPTIONS: '2' });
  await register(small); await register(small);
  eq('device cap reached: 503', (await register(small)).res.status, 503);
  const busy = makeEnv({ MAX_NEW_SUBSCRIPTIONS_PER_HOUR: '2' });
  await register(busy); await register(busy);
  const third = await register(busy);
  eq('sign-up flood guard: 429 with Retry-After', [third.res.status, Number(third.res.headers.get('Retry-After')) > 0], [429, true]);
  eq('...which clears an hour later', (await register(busy, { now: T0 + 3700 })).res.status, 201);

  // ---- delete
  const z = await register(env);
  await put(env, z, [item('d1', F, S)]);
  eq('delete needs the token', (await call(env, 'DELETE', `/v1/subscriptions/${z.id}`)).status, 401);
  eq('delete with the token succeeds', (await call(env, 'DELETE', `/v1/subscriptions/${z.id}`, { token: z.token })).status, 200);
  eq('...and removes the device and its reminders', [env.DB.rows('SELECT 1 FROM subscriptions WHERE id = ?', z.id).length, env.DB.rows('SELECT 1 FROM reminders WHERE sub_id = ?', z.id).length], [0, 0]);

  // ---- test notification
  const t = await register(env);
  const svc = pushService(201);
  const t1 = await call(env, 'POST', `/v1/subscriptions/${t.id}/test`, { token: t.token, body: { b: bodyOf(), t: 'rtest' }, fetchFn: svc.fetchFn });
  eq('test notification is relayed', [t1.status, svc.calls.length, svc.calls[0].url === t.endpoint], [200, 1, true]);
  const t2 = await call(env, 'POST', `/v1/subscriptions/${t.id}/test`, { token: t.token, body: { b: bodyOf(), t: 'rtest' }, fetchFn: svc.fetchFn, now: T0 + 5 });
  eq('...but not more than once every 30 seconds', [t2.status, svc.calls.length], [429, 1]);
  const t3 = await call(env, 'POST', `/v1/subscriptions/${t.id}/test`, { token: t.token, body: { b: bodyOf(), t: 'rtest' }, fetchFn: pushService(410).fetchFn, now: T0 + 100 });
  eq('a gone subscription is pruned and reported', [t3.status, env.DB.rows('SELECT 1 FROM subscriptions WHERE id = ?', t.id).length], [410, 0]);
  const t4s = await register(env);
  const t4 = await call(env, 'POST', `/v1/subscriptions/${t4s.id}/test`, { token: t4s.token, body: { b: bodyOf(), t: 'rtest' }, fetchFn: pushService(500).fetchFn });
  eq('a push-service failure is a 502', t4.status, 502);
  eq('test needs a valid body', (await call(env, 'POST', `/v1/subscriptions/${t4s.id}/test`, { token: t4s.token, body: { b: 'x' }, now: T0 + 500 })).status, 400);

  // ---- nothing sensitive leaks
  const err = await call(env, 'PUT', `/v1/subscriptions/${a.id}/schedule`, { token: 'x'.repeat(30), body: { items: [] } });
  check('error responses carry only a short code', Object.keys(err.json).join() === 'error');
}

// ======================================================= scheduled delivery
async function scenario(opts) {
  opts = opts || {};
  const env = makeEnv(opts.env);
  const subs = [];
  for (let n = 0; n < (opts.devices || 1); n++) {
    const s = await register(env, { now: T0 });
    subs.push(s);
  }
  return { env, subs };
}

{
  // basic: due, not due, never twice
  const { env, subs } = await scenario();
  const [s] = subs;
  const F = T0 + 600, START = T0 + 900;
  await put(env, s, [item('due', F, START)]);
  const svc = pushService(201);

  let st = await runTick(env, { now: F - 240, fetchFn: svc.fetchFn });
  eq('before its time: nothing is sent', [st.claimed, svc.calls.length], [0, 0]);

  st = await runTick(env, { now: F, fetchFn: svc.fetchFn });
  eq('at its time: sent once to the right endpoint', [st.sent, svc.calls.length, svc.calls[0].url === s.endpoint], [1, 1, true]);
  const h = svc.calls[0].headers;
  eq('TTL is the time left until the class (so it can never arrive after it starts)', h.TTL, String(START - F));
  eq('urgency is high (reminders are time-critical)', h.Urgency, 'high');
  check('VAPID Authorization present', /^vapid t=.+, k=.+$/.test(h.Authorization));
  eq('state recorded as sent', env.DB.rows("SELECT state FROM reminders WHERE key = 'due'")[0].state, 2);

  await runTick(env, { now: F + 60, fetchFn: svc.fetchFn });
  await runTick(env, { now: F + 120, fetchFn: svc.fetchFn });
  eq('later runs never send it again (no duplicates)', svc.calls.length, 1);

  await put(env, s, [item('due', F, START)], { now: F + 30 });
  await runTick(env, { now: F + 180, fetchFn: svc.fetchFn });
  eq('...even if the app re-syncs the same reminder afterwards', svc.calls.length, 1);
}

{
  // expired: class already started
  const { env, subs } = await scenario();
  const [s] = subs;
  const F = T0 + 600, START = T0 + 900;
  await put(env, s, [item('late', F, START)]);
  const svc = pushService(201);
  const st = await runTick(env, { now: START + 10, fetchFn: svc.fetchFn });
  eq('a reminder is never sent after its class has started', [st.claimed, svc.calls.length], [0, 0]);
  const c = await cleanup(env, { now: START + 2 * 86400 });
  eq('...and housekeeping removes it later', [c.reminders, env.DB.rows('SELECT 1 FROM reminders').length], [1, 0]);
}

{
  // gone subscriptions are pruned, healthy ones unaffected
  const { env, subs } = await scenario({ devices: 2 });
  const F = T0 + 600, START = T0 + 900;
  await put(env, subs[0], [item('a1', F, START)]);
  await put(env, subs[1], [item('b1', F, START)]);
  const svc = pushService((url) => (url === subs[0].endpoint ? 410 : 201));
  const st = await runTick(env, { now: F, fetchFn: svc.fetchFn });
  eq('one gone, one delivered', [st.sent, st.pruned], [1, 1]);
  eq('the dead device and its reminders are deleted', [env.DB.rows('SELECT id FROM subscriptions').map((r) => r.id), env.DB.rows('SELECT sub_id FROM reminders').map((r) => r.sub_id)], [[subs[1].id], [subs[1].id]]);
}

{
  // transient failure: retried, then given up
  const { env, subs } = await scenario();
  const F = T0 + 600, START = T0 + 3000;
  await put(env, subs[0], [item('r1', F, START)]);
  const svc = pushService(503);
  await runTick(env, { now: F, fetchFn: svc.fetchFn });
  eq('503: released for another attempt', env.DB.rows("SELECT state, attempts FROM reminders WHERE key = 'r1'")[0], { state: 0, attempts: 1 });
  await runTick(env, { now: F + 60, fetchFn: svc.fetchFn });
  await runTick(env, { now: F + 120, fetchFn: svc.fetchFn });
  eq('after 3 attempts it is given up on (state 3)', env.DB.rows("SELECT state, attempts FROM reminders WHERE key = 'r1'")[0], { state: 3, attempts: 3 });
  const n = svc.calls.length;
  await runTick(env, { now: F + 180, fetchFn: svc.fetchFn });
  eq('...and not tried again', svc.calls.length, n);

  const ok = pushService(201);
  const e2 = await scenario();
  await put(e2.env, e2.subs[0], [item('r2', F, START)]);
  await runTick(e2.env, { now: F, fetchFn: pushService(500).fetchFn });
  await runTick(e2.env, { now: F + 60, fetchFn: ok.fetchFn });
  eq('a retry that succeeds is delivered once', [ok.calls.length, e2.env.DB.rows("SELECT state FROM reminders WHERE key = 'r2'")[0].state], [1, 2]);
}

{
  // push service rejects us (403): stop, and eventually drop the device
  const { env, subs } = await scenario();
  const F = T0 + 600, START = T0 + 3000;
  await put(env, subs[0], [item('x1', F, START), item('x2', F, START + 60)]);
  const svc = pushService(403);
  await runTick(env, { now: F, fetchFn: svc.fetchFn });
  eq('403 is not retried', env.DB.rows('SELECT state FROM reminders ORDER BY key').map((r) => r.state), [3, 3]);
  eq('...and counts against the device', env.DB.rows('SELECT failures FROM subscriptions')[0].failures, 1);
  env.DB.db.prepare('UPDATE subscriptions SET failures = 5').run();
  const c = await cleanup(env, { now: F + 10 });
  eq('a device that keeps being rejected is dropped by housekeeping', env.DB.rows('SELECT 1 FROM subscriptions').length, 0);
}

{
  // crash recovery
  const { env, subs } = await scenario();
  const F = T0 + 600, START = T0 + 3000;
  await put(env, subs[0], [item('cr', F, START)]);
  env.DB.db.prepare("UPDATE reminders SET state = 1, claimed_at = ? WHERE key = 'cr'").run(F - 1000);
  const svc = pushService(201);
  const st = await runTick(env, { now: F, fetchFn: svc.fetchFn });
  eq('a run that died mid-send leaves a claim that a later run reclaims', [st.sent, svc.calls.length], [1, 1]);

  const fresh = await scenario();
  await put(fresh.env, fresh.subs[0], [item('inflight', F, START)]);
  fresh.env.DB.db.prepare("UPDATE reminders SET state = 1, claimed_at = ? WHERE key = 'inflight'").run(F - 5);
  const svc2 = pushService(201);
  await runTick(fresh.env, { now: F, fetchFn: svc2.fetchFn });
  eq('a claim made seconds ago (another run in flight) is left alone', svc2.calls.length, 0);
}

{
  // two overlapping runs never double-send
  const { env, subs } = await scenario({ devices: 5 });
  const F = T0 + 600, START = T0 + 3000;
  for (const s of subs) await put(env, s, [item('k', F, START)]);
  const svc = pushService(201);
  await Promise.all([runTick(env, { now: F, fetchFn: svc.fetchFn }), runTick(env, { now: F, fetchFn: svc.fetchFn }), runTick(env, { now: F, fetchFn: svc.fetchFn })]);
  eq('three simultaneous runs send each reminder exactly once', svc.calls.length, 5);
}

{
  // capacity: a burst is delivered on time by starting early
  const { env, subs } = await scenario({ devices: 100, env: { MAX_PUSHES_PER_TICK: '40', LOOKAHEAD_MINUTES: '10' } });
  const F = T0 + 1200, START = F + 300;
  for (const s of subs) await put(env, s, [item('burst', F, START)]);
  const sentAt = new Map();
  const perRun = [];
  let queriesMax = 0, externalMax = 0;
  for (let minute = (F / 60) - 12; minute <= (F / 60) + 2; minute++) {
    const svc = pushService(201);
    const q0 = env.DB.stats.queries;
    await runTick(env, { now: minute * 60 + 3, fetchFn: svc.fetchFn });
    queriesMax = Math.max(queriesMax, env.DB.stats.queries - q0);
    externalMax = Math.max(externalMax, svc.calls.length);
    perRun.push(svc.calls.length);
    svc.calls.forEach((c) => sentAt.set(c.url, minute));
  }
  const minutesRelative = [...sentAt.values()].map((m) => m - F / 60);
  eq('all 100 devices were notified', sentAt.size, 100);
  check('...none later than the requested minute', Math.max(...minutesRelative) <= 0);
  check('...and none earlier than needed (burst of 100 at 40/run starts only 2 minutes early)', Math.min(...minutesRelative) >= -2, `earliest ${Math.min(...minutesRelative)}`);
  check('no run exceeded the configured capacity (stays under the 50 outgoing-request cap)', externalMax <= 40, `max ${externalMax}`);
  check('a run uses few D1 queries (limit 50)', queriesMax <= 9, `max ${queriesMax}`);
  eq('(shape of the burst: minutes before, runs sent)', perRun.filter(Boolean), [20, 40, 40]);
}

{
  // beyond what the free tier can do on time: degrades by lateness, not by loss
  const { env, subs } = await scenario({ devices: 60, env: { MAX_PUSHES_PER_TICK: '10', LOOKAHEAD_MINUTES: '2' } });
  const F = T0 + 1200, START = F + 600;
  for (const s of subs) await put(env, s, [item('big', F, START)]);
  const svc = pushService(201);
  let perMax = 0;
  for (let minute = F / 60 - 3; minute <= F / 60 + 8; minute++) {
    const before = svc.calls.length;
    await runTick(env, { now: minute * 60 + 3, fetchFn: svc.fetchFn });
    perMax = Math.max(perMax, svc.calls.length - before);
  }
  eq('an unsustainable burst is still fully delivered, just late, while the class has not started', svc.calls.length, 60);
  check('...never exceeding the per-run cap', perMax <= 10);
}

{
  // cleanup
  const { env, subs } = await scenario({ devices: 2 });
  await put(env, subs[0], [item('keep', T0 + 600, T0 + 900)]);
  env.DB.db.prepare('UPDATE subscriptions SET last_sync_at = ? WHERE id = ?').run(T0 - 61 * 86400, subs[1].id);
  env.DB.db.prepare("INSERT INTO reminders (sub_id, key, fire_at, start_at, topic, h, body, state) VALUES (?, 'ancient', ?, ?, 't', 'h', 'b', 2)").run(subs[0].id, T0 - 3 * 86400, T0 - 3 * 86400 + 600);
  const c = await cleanup(env, { now: T0 });
  eq('old reminders and long-abandoned devices are removed; live data is kept',
    [env.DB.rows('SELECT key FROM reminders').map((r) => r.key), env.DB.rows('SELECT id FROM subscriptions').map((r) => r.id)], [['keep'], [subs[0].id]]);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
