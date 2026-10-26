// Web Push delivery: VAPID (RFC 8292) authentication and the HTTP POST to the
// browser vendor's push service. The message body arrives already encrypted
// (RFC 8291) from the device, so no content encryption happens here and the
// per-message CPU cost stays tiny - the whole reason this relay fits the free tier.

import { b64uEncode, b64uDecode } from './util.js';

/** Hosts a legitimate browser push endpoint can live on. Anything else is refused,
 *  which stops the relay being aimed at arbitrary URLs. */
export const PUSH_HOST_PATTERNS = [
  /^fcm\.googleapis\.com$/,                       // Chrome, Edge, Brave, Samsung Internet, Opera on Android/desktop
  /^updates\.push\.services\.mozilla\.com$/,      // Firefox
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,                      // Safari, iOS/iPadOS Home Screen web apps, macOS
  /^[a-z0-9.-]+\.notify\.windows\.com$/           // Edge via Windows Notification Service
];

export function isAllowedEndpoint(endpoint, extraHosts) {
  if (typeof endpoint !== 'string' || endpoint.length > 700) return false;
  let u;
  try { u = new URL(endpoint); } catch (e) { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
  const host = u.hostname.toLowerCase();
  if (extraHosts && extraHosts.includes(host)) return true;
  return PUSH_HOST_PATTERNS.some((re) => re.test(host));
}

/** Import the VAPID key pair from the public key (65-byte point) and the secret `d`. */
export async function importVapid(publicKeyB64u, privateKeyB64u) {
  const pub = b64uDecode(publicKeyB64u);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY must be an uncompressed P-256 point');
  const d = b64uDecode(privateKeyB64u);
  if (d.length !== 32) throw new Error('VAPID_PRIVATE_KEY must be the 32-byte private scalar, base64url');
  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33, 65)), d: b64uEncode(d)
  };
  const signKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { publicKey: publicKeyB64u, signKey };
}

const enc = new TextEncoder();

async function signJwt(vapid, audience, subject, nowSec) {
  const header = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64uEncode(enc.encode(JSON.stringify({ aud: audience, exp: nowSec + 12 * 3600, sub: subject })));
  const input = enc.encode(header + '.' + claims);
  // WebCrypto's ECDSA output is already the raw r||s form JWS requires.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapid.signKey, input));
  return header + '.' + claims + '.' + b64uEncode(sig);
}

/** `Authorization` header value, with one signed token cached per push-service origin. */
export async function vapidAuthorization(vapid, endpoint, subject, nowSec, cache) {
  const audience = new URL(endpoint).origin;
  let hit = cache && cache.get(audience);
  if (!hit || hit.exp - nowSec < 3600) {
    hit = { token: await signJwt(vapid, audience, subject, nowSec), exp: nowSec + 12 * 3600 };
    if (cache) cache.set(audience, hit);
  }
  return 'vapid t=' + hit.token + ', k=' + vapid.publicKey;
}

/**
 * POST one pre-encrypted message to a push service.
 * Result: { status, ok, gone, retry } where
 *   ok    - accepted (201)
 *   gone  - the subscription no longer exists (404/410): delete it
 *   retry - transient (429/5xx/network): try again while the reminder is still useful
 */
export async function sendPush({ endpoint, body, ttl, urgency, topic }, vapid, subject, nowSec, opts) {
  const o = opts || {};
  const fetchFn = o.fetchFn || fetch;
  let authorization;
  try {
    authorization = await vapidAuthorization(vapid, endpoint, subject, nowSec, o.cache);
  } catch (e) {
    return { status: 0, ok: false, gone: false, retry: false, error: 'vapid' };
  }
  const headers = {
    'Authorization': authorization,
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    'TTL': String(Math.max(0, Math.floor(ttl))),
    'Urgency': urgency || 'normal'
  };
  if (topic && /^[A-Za-z0-9_-]{1,32}$/.test(topic)) headers['Topic'] = topic;

  let res;
  try {
    res = await fetchFn(endpoint, {
      method: 'POST', headers, body,
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
    });
  } catch (e) {
    return { status: 0, ok: false, gone: false, retry: true, error: 'network' };
  }
  // Drain the (tiny) body so the connection is released.
  try { await res.arrayBuffer(); } catch (e) { /* ignore */ }
  const status = res.status;
  return {
    status,
    ok: status === 201 || status === 200 || status === 202,
    gone: status === 404 || status === 410,
    retry: status === 429 || status >= 500 || status === 408
  };
}
