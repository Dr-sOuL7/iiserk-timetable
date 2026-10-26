#!/usr/bin/env node
/**
 * Generate the VAPID key pair the reminder Worker signs its pushes with.
 * Development tool - run it once, on your own machine.
 *
 *   node tools/generate-vapid-keys.js              print both keys
 *   node tools/generate-vapid-keys.js --dev-vars   also write worker/.dev.vars for `wrangler dev`
 *                                                  (that file is git-ignored)
 *
 * The PUBLIC key goes in worker/wrangler.toml (VAPID_PUBLIC_KEY).
 * The PRIVATE key is a secret: give it to Cloudflare with
 *     cd worker && npx wrangler secret put VAPID_PRIVATE_KEY
 * and keep a copy in a password manager. It is never committed and never sent to the app.
 * Replacing the pair later makes every device re-subscribe (the app does that by itself).
 */
'use strict';

const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = privateKey.export({ format: 'jwk' });
const b64u = (s) => Buffer.from(s, 'base64url');
const publicKey = Buffer.concat([Buffer.from([4]), b64u(jwk.x), b64u(jwk.y)]).toString('base64url');
const privateScalar = jwk.d;

console.log('VAPID_PUBLIC_KEY  (public - goes in worker/wrangler.toml):');
console.log('  ' + publicKey);
console.log('\nVAPID_PRIVATE_KEY (SECRET - `npx wrangler secret put VAPID_PRIVATE_KEY`):');
console.log('  ' + privateScalar);

if (process.argv.includes('--dev-vars')) {
  const file = path.join(__dirname, '..', 'worker', '.dev.vars');
  fs.writeFileSync(file, `VAPID_PRIVATE_KEY=${privateScalar}\nVAPID_PUBLIC_KEY=${publicKey}\n`, { mode: 0o600 });
  console.log('\nWrote worker/.dev.vars (git-ignored, mode 600) for local `wrangler dev`.');
}
console.log('\nKeep the private key out of chat, tickets and commits.');
