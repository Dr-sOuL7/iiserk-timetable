'use strict';
// The "browser" half of Web Push for tests: a device key pair and a decryptor for
// the aes128gcm messages (RFC 8291) that reminders.js produces. Written separately
// from the encrypt path so a round trip proves something.

const subtle = globalThis.crypto.subtle;
const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
const ub64 = (s) => new Uint8Array(Buffer.from(s, 'base64url'));

async function hkdf(salt, ikm, info, len) {
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

/** device = { jwk, pub (base64url), auth (base64url) } as exposed by the page's fake subscription */
async function decrypt(bodyB64u, device) {
  const body = ub64(bodyB64u);
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPub = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const priv = await subtle.importKey('jwk', device.jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const pub = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256));
  const enc = new TextEncoder();
  const cat = (...a) => Buffer.concat(a.map((x) => Buffer.from(x)));
  const ikm = await hkdf(ub64(device.auth), secret, cat(enc.encode('WebPush: info\0'), ub64(device.pub), asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end--;
  if (plain[end] !== 2) throw new Error('bad padding delimiter');
  return JSON.parse(new TextDecoder().decode(plain.slice(0, end)));
}

module.exports = { decrypt, b64u, ub64 };
