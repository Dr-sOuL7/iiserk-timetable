// Small helpers shared by the Worker modules. Web-standard APIs only, so the
// same code runs on Cloudflare Workers and under Node (tests).

export function b64uEncode(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(input) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  let out = '';
  for (let i = 0; i < d.length; i++) out += (d[i] < 16 ? '0' : '') + d[i].toString(16);
  return out;
}

/** Comparison whose running time does not depend on where the strings differ. */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomToken() {
  return b64uEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export function intVar(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}
