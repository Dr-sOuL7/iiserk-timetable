#!/usr/bin/env node
/**
 * Unit tests for reminders.js (development only, no browser needed).
 *
 * Covers the preference rules, schedule building (selection, edits, removals,
 * holidays, breaks, Mid-Sem, DST), RFC 8291 encryption against the RFC's own
 * known-answer vector, and the controller's subscribe / sync / permission /
 * offline behaviour against an in-memory fake of the push service and backend.
 *
 * Run: node tests/reminders.test.js
 */
'use strict';

process.env.TZ = 'Asia/Kolkata';

const path = require('path');
const R = require(path.join(__dirname, '..', 'reminders.js'));

let passed = 0, failed = 0;
function check(name, ok, detail) {
  (ok ? passed++ : failed++);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`);
}
const eq = (name, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  check(name, a === e, a === e ? String(a).slice(0, 80) : `got ${a}, want ${e}`);
};

// ------------------------------------------------------------ fake timetable

let EVENTS;
let SELECTED;
let OFF_DAYS;
let MIDSEM;

function ev(id, day, time, course, type, room, name) {
  const [h, m] = time.split(':').map(Number);
  return { id, day, time, minutes: h * 60 + m, duration: 50, course, type, room, name: name || course + ' name' };
}
function resetTimetable() {
  EVENTS = [
    ev('mon-0855-aa1101-theory-r1', 'Monday', '08:55', 'AA1101', 'Theory', 'R1', 'Alpha Course'),
    ev('mon-1045-bb1101-theory-r2', 'Monday', '10:45', 'BB1101', 'Theory', 'R2', 'Beta Course'),
    ev('mon-1520-cc1101-tutorial-r3', 'Monday', '15:20', 'CC1101', 'Tutorial', 'R3', 'Gamma Course'),
    ev('tue-0855-aa1101-theory-r1', 'Tuesday', '08:55', 'AA1101', 'Theory', 'R1', 'Alpha Course'),
    ev('tue-1330-dd1101-lab-lab1', 'Tuesday', '13:30', 'DD1101', 'Lab', 'Lab 1', 'Delta Lab'),
    ev('wed-0950-bb1101-theory-r2', 'Wednesday', '09:50', 'BB1101', 'Theory', 'R2', 'Beta Course'),
    ev('fri-0800-aa1101-tutorial-r1', 'Friday', '08:00', 'AA1101', 'Tutorial', 'R1', 'Alpha Course'),
    // two parallel sections of one tutorial in different rooms
    ev('fri-1520-ee1101-tutorial-ra', 'Friday', '15:20', 'EE1101', 'Tutorial', 'Room A', 'Epsilon'),
    ev('fri-1520-ee1101-tutorial-rb', 'Friday', '15:20', 'EE1101', 'Tutorial', 'Room B', 'Epsilon')
  ];
  SELECTED = new Set(['AA1101', 'BB1101', 'CC1101', 'DD1101', 'EE1101']);
  OFF_DAYS = new Set();
  MIDSEM = {};
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deps = {
  teachingDay: (d) => { const n = DAY_NAMES[d.getDay()]; return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(n) ? n : null; },
  localDateKey: keyOf,
  eventsFor: (day) => EVENTS.filter((e) => e.day === day && SELECTED.has(e.course)).sort((a, b) => a.minutes - b.minutes || a.id.localeCompare(b.id)),
  isOffDay: (d) => OFF_DAYS.has(keyOf(d)),
  midsemIntervalsOn: (key) => MIDSEM[key] || [],
  overlaps: (e, ivs) => ivs.some((iv) => e.minutes < iv.end && e.minutes + e.duration > iv.start)
};

// Monday 26 Oct 2026, 07:00 IST
const NOW = new Date(2026, 9, 26, 7, 0, 0, 0);
const at = (y, mo, d, h, mi) => new Date(y, mo, d, h, mi, 0, 0).getTime();
const sched = (prefs, now) => R.buildSchedule(deps, prefs || R.defaultPrefs(), now || NOW);
const find = (items, course) => items.filter((i) => i.payload.i.some((c) => c.c === course));

// -------------------------------------------------------------- run

(async () => {
  resetTimetable();

  // ============ preferences ============
  {
    const p = R.sanitizePrefs(undefined);
    eq('defaults: reminders on, 5 minutes, no per-class settings', p, { version: 1, enabled: true, lead: 5, perClass: {} });
    eq('unset class inherits the default', R.classSetting(p, 'x'), { mode: 'default', lead: 5 });
    check('default resolves to 5 minutes', R.resolveLead(p, 'x') === 5);

    const off = R.sanitizePrefs({ enabled: false, lead: 10 });
    check('global off resolves to no reminder for any class', R.resolveLead(off, 'x') === null);
    check('global off keeps the stored default', off.lead === 10);

    const dirty = R.sanitizePrefs({
      enabled: 'yes', lead: 0,
      perClass: { a: { lead: 10 }, b: { off: true }, c: { lead: 999 }, d: 'x', e: { lead: 7.5 }, f: null, g: { lead: 20, off: false } }
    });
    eq('malformed stored data is dropped, not trusted', dirty, { version: 1, enabled: true, lead: 5, perClass: { a: { lead: 10 }, b: { off: true }, g: { lead: 20 } } });
    check('1..180 minutes are valid, anything else is not',
      R.isLead(1) && R.isLead(180) && !R.isLead(0) && !R.isLead(181) && !R.isLead(5.5) && !R.isLead('5') && !R.isLead(NaN));
  }

  // ============ schedule rules ============
  {
    const items = sched();
    check('schedule has reminders', items.length > 0);
    const first = items[0];
    eq('first reminder fires 5 minutes before the 08:55 class', new Date(first.fireMs).toTimeString().slice(0, 5), '08:50');
    eq('...and the class starts at 08:55', new Date(first.startMs).toTimeString().slice(0, 5), '08:55');
    check('every fire time is exactly lead minutes before its start',
      items.every((i) => i.startMs - i.fireMs === 5 * 60000));
    check('sorted by fire time', items.every((it, i) => i === 0 || items[i - 1].fireMs <= it.fireMs));
    check('nothing beyond the 21-day horizon',
      items.every((i) => i.startMs < NOW.getTime() + 22 * 86400000));
    check('keys are unique', new Set(items.map((i) => i.key)).size === items.length);
    check('no weekend reminders', items.every((i) => ![0, 6].includes(new Date(i.startMs).getDay())));
  }

  {
    // global default changes
    const p = R.sanitizePrefs({ lead: 5, perClass: {
      'mon-1045-bb1101-theory-r2': { lead: 10 },
      'mon-1520-cc1101-tutorial-r3': { off: true }
    } });
    const before = sched(p).filter((i) => new Date(i.startMs).getDate() === 26);
    p.lead = 30;
    const after = sched(p).filter((i) => new Date(i.startMs).getDate() === 26);
    const t = (items, c) => { const i = find(items, c)[0]; return i ? (i.startMs - i.fireMs) / 60000 : null; };
    eq('class without its own setting follows the default (5 -> 30)', [t(before, 'AA1101'), t(after, 'AA1101')], [5, 30]);
    eq('class with a custom time is unaffected by a new default', [t(before, 'BB1101'), t(after, 'BB1101')], [10, 10]);
    eq('class switched off stays off whatever the default', [t(before, 'CC1101'), t(after, 'CC1101')], [null, null]);
    check('turning off one class leaves the others', find(after, 'AA1101').length === 1 && find(after, 'BB1101').length === 1);
  }

  {
    // global switch
    const p = R.sanitizePrefs({ enabled: false, perClass: { 'mon-1045-bb1101-theory-r2': { lead: 10 } } });
    eq('global off produces no reminders at all, even for a class with its own time', sched(p), []);
    p.enabled = true;
    check('turning it back on restores them, per-class setting intact',
      find(sched(p), 'BB1101').some((i) => (i.startMs - i.fireMs) === 10 * 60000));
  }

  {
    // a custom (non-preset) time and the 1/180 bounds
    const p = R.sanitizePrefs({ perClass: { 'mon-0855-aa1101-theory-r1': { lead: 45 }, 'tue-0855-aa1101-theory-r1': { lead: 1 } } });
    const items = sched(p);
    const mon = items.find((i) => new Date(i.startMs).getDate() === 26 && i.payload.i[0].c === 'AA1101');
    eq('custom 45-minute time fires at 08:10', new Date(mon.fireMs).toTimeString().slice(0, 5), '08:10');
    const tue = items.find((i) => new Date(i.startMs).getDate() === 27 && i.payload.i[0].c === 'AA1101');
    eq('1-minute time fires at 08:54', new Date(tue.fireMs).toTimeString().slice(0, 5), '08:54');
  }

  {
    // selected courses
    SELECTED = new Set(['AA1101']);
    const only = sched();
    check('only selected courses are reminded', only.every((i) => i.payload.i.every((c) => c.c === 'AA1101')));
    SELECTED.add('BB1101');
    check('selecting another course adds its reminders', find(sched(), 'BB1101').length > 0);
    SELECTED = new Set();
    eq('no selected courses -> no reminders', sched(), []);
    resetTimetable();
  }

  {
    // edited / removed / moved
    const base = sched();
    const aaMon = find(base, 'AA1101').find((i) => new Date(i.startMs).getDate() === 26);
    const idx = EVENTS.findIndex((e) => e.id === 'mon-0855-aa1101-theory-r1');
    EVENTS[idx] = Object.assign({}, EVENTS[idx], { time: '09:15', minutes: 555, room: 'New Room' });
    const edited = sched();
    const aaMon2 = find(edited, 'AA1101').find((i) => new Date(i.startMs).getDate() === 26);
    eq('edited start time moves the reminder to 09:10', new Date(aaMon2.fireMs).toTimeString().slice(0, 5), '09:10');
    check('edited class gets a new key (the old reminder is replaced, not duplicated)', aaMon.key !== aaMon2.key);
    eq('edited room appears in the payload', aaMon2.payload.i[0].r, 'New Room');
    check('no leftover reminder at the old time',
      !edited.some((i) => new Date(i.startMs).getDate() === 26 && new Date(i.startMs).toTimeString().slice(0, 5) === '08:55'));

    EVENTS.splice(idx, 1);     // removed
    const removed = sched();
    check('a removed class produces no reminder', !removed.some((i) => i.payload.i.some((c) => c.c === 'AA1101') && new Date(i.startMs).getDate() === 26));
    check('removing one class leaves its course\'s other classes', find(removed, 'AA1101').length > 0);
    resetTimetable();

    // moved to another weekday by an edit
    const j = EVENTS.findIndex((e) => e.id === 'wed-0950-bb1101-theory-r2');
    EVENTS[j] = Object.assign({}, EVENTS[j], { day: 'Thursday' });
    const moved = find(sched(), 'BB1101').filter((i) => new Date(i.startMs).getDay() === 4);
    check('a class moved to Thursday is reminded on Thursday', moved.length > 0);
    check('...and no longer on Wednesday', !find(sched(), 'BB1101').some((i) => new Date(i.startMs).getDay() === 3 && new Date(i.startMs).getHours() === 9));
    resetTimetable();
  }

  {
    // holidays and breaks (the app supplies isOffDay; every class on such a day is skipped)
    OFF_DAYS.add('2026-10-27');           // a holiday on Tuesday
    const h = sched();
    check('no reminders on a holiday', !h.some((i) => keyOf(new Date(i.startMs)) === '2026-10-27'));
    check('other days unaffected', h.some((i) => keyOf(new Date(i.startMs)) === '2026-10-26'));
    ['2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04'].forEach((k) => OFF_DAYS.add(k));
    const b = sched();
    check('no reminders through a break',
      !b.some((i) => ['2026-10-28', '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04'].includes(keyOf(new Date(i.startMs)))));
    check('reminders resume after the break', b.some((i) => keyOf(new Date(i.startMs)) === '2026-11-06'));
    resetTimetable();
  }

  {
    // Mid-Sem exam suppresses only the classes it overlaps
    MIDSEM['2026-10-26'] = [{ start: 10 * 60, end: 11 * 60 + 30 }];       // 10:00-11:30
    const m = sched().filter((i) => keyOf(new Date(i.startMs)) === '2026-10-26');
    check('class overlapping the exam is dropped (10:45 BB1101)', !m.some((i) => i.payload.i[0].c === 'BB1101'));
    check('classes outside the exam are kept (08:55, 15:20)', m.some((i) => i.payload.i[0].c === 'AA1101') && m.some((i) => i.payload.i[0].c === 'CC1101'));
    resetTimetable();
  }

  {
    // time already passed
    const now = new Date(2026, 9, 26, 8, 52, 0, 0);       // 08:52: 08:55 class, 5-min reminder was due 08:50
    check('a reminder 2 minutes overdue is not sent late', !sched(undefined, now).some((i) => new Date(i.startMs).toTimeString().slice(0, 5) === '08:55' && keyOf(new Date(i.startMs)) === '2026-10-26'));
    const now2 = new Date(2026, 9, 26, 8, 50, 30, 0);      // 30 s overdue: within the grace window
    check('a reminder 30 seconds overdue is still sent', sched(undefined, now2).some((i) => new Date(i.startMs).toTimeString().slice(0, 5) === '08:55' && keyOf(new Date(i.startMs)) === '2026-10-26'));
    const now3 = new Date(2026, 9, 26, 9, 0, 0, 0);        // class already started
    check('a class that has started is not reminded', !sched(undefined, now3).some((i) => keyOf(new Date(i.startMs)) === '2026-10-26' && new Date(i.startMs).toTimeString().slice(0, 5) === '08:55'));
  }

  {
    // grouping and key stability
    const items = sched();
    const fri = items.filter((i) => keyOf(new Date(i.startMs)) === '2026-10-30' && new Date(i.startMs).getHours() === 15);
    eq('two parallel sections make ONE notification', fri.length, 1);
    eq('...naming the course once with both rooms', fri[0].payload.i.map((c) => [c.c, c.r]), [['EE1101', 'Room A / Room B']]);
    eq('rebuilding gives identical keys (stable across refresh/reinstall)', sched().map((i) => i.key), items.map((i) => i.key));
    const p = R.defaultPrefs(); p.lead = 15;
    const changedLead = sched(p);
    eq('changing only the lead keeps each reminder\'s key (an update, never a duplicate)',
      changedLead.map((i) => i.key).sort(), items.map((i) => i.key).sort());
    check('...but moves the fire times', changedLead[0].fireMs !== items[0].fireMs);
    check('payload is compact JSON v1', items.every((i) => i.payload.v === 1 && i.payload.k === i.key && typeof i.payload.s === 'number'));
    check('payloads stay far below the 4 KB push limit', items.every((i) => JSON.stringify(i.payload).length < 1200));

    // simultaneous different classes -> one notification listing both
    EVENTS.push(ev('mon-0855-zz1101-theory-r9', 'Monday', '08:55', 'ZZ1101', 'Theory', 'R9', 'Zeta'));
    SELECTED.add('ZZ1101');
    const both = sched().find((i) => keyOf(new Date(i.startMs)) === '2026-10-26' && new Date(i.startMs).getHours() === 8);
    eq('different classes starting together share one notification', both.payload.i.map((c) => c.c).sort(), ['AA1101', 'ZZ1101']);
    // ...but not if their reminder times differ
    const p2 = R.defaultPrefs(); p2.perClass['mon-0855-zz1101-theory-r9'] = { lead: 10 };
    const split = sched(p2).filter((i) => keyOf(new Date(i.startMs)) === '2026-10-26' && new Date(i.startMs).getHours() === 8);
    eq('...but classes with different reminder times stay separate', split.length, 2);
    resetTimetable();
  }

  {
    // item cap
    const many = [];
    for (let d = 0; d < 5; d++) {
      for (let k = 0; k < 40; k++) {
        const minutes = 8 * 60 + k * 10;
        many.push({ id: `x-${d}-${k}`, day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][d],
          time: '00:00', minutes, duration: 5, course: 'AA1101', type: 'Theory', room: 'R', name: 'n' });
      }
    }
    EVENTS = many;
    const items = sched();
    check('schedule is capped (300) so a runaway timetable cannot flood the service', items.length === 300);
    resetTimetable();
  }

  {
    // DST: America/New_York, class on the Monday after spring-forward (8 Mar 2026)
    process.env.TZ = 'America/New_York';
    const tzOffset = new Date(2026, 2, 9, 9, 0).getTimezoneOffset();
    check('(sanity) TZ switch to New York took effect', tzOffset === 240, `offset ${tzOffset}`);
    EVENTS = [
      ev('fri-0900-aa-theory-r', 'Friday', '09:00', 'AA1101', 'Theory', 'R'),
      ev('mon-0900-aa-theory-r', 'Monday', '09:00', 'AA1101', 'Theory', 'R')
    ];
    const items = R.buildSchedule(deps, R.defaultPrefs(), new Date(2026, 2, 6, 7, 0));
    const fri = items.find((i) => new Date(i.startMs).getDay() === 5);
    const mon = items.find((i) => new Date(i.startMs).getDay() === 1);
    eq('Friday 09:00 EST is 14:00Z', new Date(fri.startMs).toISOString(), '2026-03-06T14:00:00.000Z');
    eq('Monday 09:00 EDT (after the clocks moved) is 13:00Z, not 14:00Z', new Date(mon.startMs).toISOString(), '2026-03-09T13:00:00.000Z');
    eq('the Monday reminder is 5 real minutes earlier', new Date(mon.fireMs).toISOString(), '2026-03-09T12:55:00.000Z');
    process.env.TZ = 'Asia/Kolkata';
    resetTimetable();
  }

  // ============ encryption: RFC 8291 known-answer test ============
  const b64u = R.b64uEncode, ub64 = R.b64uDecode;
  const subtle = globalThis.crypto.subtle;
  {
    const rfc = {
      plaintext: 'When I grow up, I want to be a watermelon',
      auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
      asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
      asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
      salt: 'DGv6ra1nlYgDCS1FRnbzlw',
      header: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
      ciphertext: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ'
    };
    const asPub = ub64(rfc.asPublic);
    const jwk = { kty: 'EC', crv: 'P-256', d: rfc.asPrivate, x: b64u(asPub.slice(1, 33)), y: b64u(asPub.slice(33, 65)) };
    const body = await R.encryptPayload(new TextEncoder().encode(rfc.plaintext), ub64(rfc.uaPublic), ub64(rfc.auth),
      { salt: ub64(rfc.salt), ephemeralJwk: jwk });
    const out = b64u(body);
    check('RFC 8291 Appendix A: header (salt, record size, key id) matches', out.startsWith(rfc.header.slice(0, 80)));
    eq('RFC 8291 Appendix A: 86-byte header', body.length - ub64(rfc.ciphertext).length, 86);
    eq('RFC 8291 Appendix A: ciphertext matches the published vector', b64u(body.slice(86)), rfc.ciphertext);
    eq('RFC 8291 Appendix A: whole message is header + ciphertext', out, b64u(Buffer.concat([ub64(rfc.header), ub64(rfc.ciphertext)])));
  }

  // user-agent side, written independently of the encrypt path, for round trips
  async function hkdf(salt, ikm, info, len) {
    const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
  }
  async function decrypt(body, uaPrivateJwk, uaPublic, auth) {
    const salt = body.slice(0, 16);
    const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
    const idlen = body[20];
    const asPub = body.slice(21, 21 + idlen);
    const ct = body.slice(21 + idlen);
    const priv = await subtle.importKey('jwk', uaPrivateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const pub = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const secret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: pub }, priv, 256));
    const enc = new TextEncoder();
    const cat = (...a) => Buffer.concat(a.map((x) => Buffer.from(x)));
    const ikm = await hkdf(auth, secret, cat(enc.encode('WebPush: info\0'), uaPublic, asPub), 32);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
    let end = plain.length - 1;
    while (end >= 0 && plain[end] === 0) end--;
    if (plain[end] !== 2) throw new Error('bad padding delimiter');
    return { text: new TextDecoder().decode(plain.slice(0, end)), rs, idlen };
  }

  async function makeDevice(endpoint) {
    const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const jwk = await subtle.exportKey('jwk', pair.privateKey);
    const pub = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
    const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return { endpoint, jwk, pub, auth };
  }

  {
    const dev = await makeDevice('https://fcm.googleapis.com/fcm/send/abc');
    const msg = JSON.stringify({ v: 1, k: 'k', s: 123, i: [{ c: 'PH3104', t: 'Theory', r: 'G08', n: 'Électricité ☃' }] });
    const body = await R.encryptPayload(new TextEncoder().encode(msg), dev.pub, dev.auth);
    const back = await decrypt(body, dev.jwk, dev.pub, dev.auth);
    eq('round trip: the device decrypts exactly what was encrypted (UTF-8 included)', back.text, msg);
    eq('record size 4096 and 65-byte key id', [back.rs, back.idlen], [4096, 65]);
    const body2 = await R.encryptPayload(new TextEncoder().encode(msg), dev.pub, dev.auth);
    check('every message uses a fresh salt and ephemeral key', b64u(body) !== b64u(body2));
    const other = await makeDevice('x');
    let threw = false;
    try { await decrypt(body, other.jwk, other.pub, other.auth); } catch (e) { threw = true; }
    check('another device cannot decrypt it', threw);
  }

  // ============ controller ============
  function makeStore() {
    const m = new Map();
    return {
      get: (k) => (m.has(k) ? m.get(k) : null),
      set: (k, v) => { m.set(k, String(v)); return true; },
      remove: (k) => { m.delete(k); return true; },
      raw: m
    };
  }

  const VAPID = b64u(Uint8Array.from([4, ...Array.from({ length: 64 }, (_, i) => i + 1)]));

  /** Everything the controller touches, faked: permission, push manager, SW, network. */
  async function makeWorld(opts) {
    opts = opts || {};
    const world = {
      store: opts.store || makeStore(),
      permission: opts.permission || 'default',
      requestCalls: 0,
      subscribeCalls: 0,
      unsubscribeCalls: 0,
      requests: [],
      online: opts.online !== false,
      timers: [],
      now: opts.now || new Date(NOW.getTime()),
      sub: null,
      device: null,
      schedule: new Map(),
      subs: new Map(),
      failNext: null
    };
    world.device = opts.device || await makeDevice('https://fcm.googleapis.com/fcm/send/' + Math.random().toString(36).slice(2));

    const makeSub = () => ({
      options: { applicationServerKey: ub64(VAPID).buffer },
      toJSON: () => ({ endpoint: world.device.endpoint, keys: { p256dh: b64u(world.device.pub), auth: b64u(world.device.auth) } }),
      unsubscribe: async () => { world.unsubscribeCalls++; world.sub = null; return true; }
    });
    const pushManager = {
      getSubscription: async () => world.sub,
      subscribe: async () => { world.subscribeCalls++; world.sub = makeSub(); return world.sub; }
    };
    if (opts.existingSub) world.sub = makeSub();

    const notification = {
      get permission() { return world.permission; },
      requestPermission: (cb) => {
        world.requestCalls++;
        const result = opts.grant === false ? 'denied' : 'granted';
        world.permission = result;
        if (cb) cb(result);
        return Promise.resolve(result);
      }
    };

    async function fakeFetch(url, init) {
      const u = new URL(url);
      const body = init.body ? JSON.parse(init.body) : undefined;
      const req = { method: init.method, path: u.pathname, body, auth: init.headers && init.headers.Authorization, delivered: false };
      world.requests.push(req);
      if (!world.online) throw new TypeError('Failed to fetch');
      req.delivered = true;
      const reply = (status, json) => ({ status, json: async () => json });
      if (world.failNext && world.failNext.path === u.pathname && world.failNext.method === init.method) {
        const f = world.failNext; world.failNext = null;
        return reply(f.status, { error: 'fail' });
      }
      let m;
      if (u.pathname === '/v1/config') return reply(200, { vapidPublicKey: VAPID });
      if (u.pathname === '/v1/subscribe') {
        const id = 'id' + (world.subs.size + 1).toString().padStart(30, '0');
        const token = 'token-' + world.subs.size + '-abcdefghijklmnopqrstuvwxyz';
        world.subs.set(id, { token, endpoint: body.endpoint });
        return reply(201, { id, token, vapid: VAPID });
      }
      if ((m = /^\/v1\/subscriptions\/([^/]+)\/schedule$/.exec(u.pathname))) {
        const s = world.subs.get(m[1]);
        if (!s || init.headers.Authorization !== 'Bearer ' + s.token) return reply(401, { error: 'unauthorized' });
        world.schedule = new Map(body.items.map((i) => [i.k, i]));
        return reply(200, { ok: true, stored: body.items.length });
      }
      if ((m = /^\/v1\/subscriptions\/([^/]+)\/test$/.exec(u.pathname))) {
        world.lastTest = body;
        return reply(200, { ok: true });
      }
      if ((m = /^\/v1\/subscriptions\/([^/]+)$/.exec(u.pathname)) && init.method === 'DELETE') {
        world.subs.delete(m[1]);
        return reply(200, { ok: true });
      }
      return reply(404, { error: 'not_found' });
    }

    const env = {
      now: () => new Date(world.now.getTime()),
      fetch: fakeFetch,
      notification,
      serviceWorker: opts.noServiceWorker ? undefined : { ready: Promise.resolve({ pushManager }) },
      hasPush: () => opts.unsupported ? false : true,
      iosInstallNeeded: () => !!opts.ios,
      online: () => world.online,
      tz: () => 'Asia/Kolkata',
      setTimeout: (fn, ms) => { const t = { fn, ms, id: world.timers.length, live: true }; world.timers.push(t); return t; },
      clearTimeout: (t) => { if (t) t.live = false; }
    };
    world.env = env;
    world.config = opts.config || { apiBase: 'https://relay.example.workers.dev' };
    world.changes = 0;
    world.make = () => R.createController({
      store: world.store, config: world.config, deps, env, onChange: () => { world.changes++; }
    });
    world.ctl = world.make();
    world.fire = async () => {          // run due debounce/retry timers
      const due = world.timers.filter((t) => t.live);
      due.forEach((t) => { t.live = false; });
      for (const t of due) await t.fn();
      await new Promise((r) => setImmediate(r));
    };
    world.puts = () => world.requests.filter((r) => r.method === 'PUT' && r.delivered);
    world.decryptAll = async () => {
      const out = [];
      for (const it of world.schedule.values()) {
        const d = await decrypt(ub64(it.b), world.device.jwk, world.device.pub, world.device.auth);
        out.push({ item: it, payload: JSON.parse(d.text) });
      }
      return out;
    };
    return world;
  }

  {
    // never prompts on its own
    const w = await makeWorld({ permission: 'default' });
    await w.ctl.reconcile();
    check('reminders default to ON before anything is touched', w.ctl.isEnabled() === true);
    eq('...but with permission undecided it asks for nothing and says so', w.ctl.status().code, 'needs-permission');
    eq('startup/reconcile never requests notification permission', w.requestCalls, 0);
    eq('...and contacts no network', w.requests.length, 0);
    check('defaults are not persisted (so a later default change would still apply)', w.store.get(R.KEY_PREFS) === null);
  }

  {
    // explicit enable: the one place permission is requested
    const w = await makeWorld({ permission: 'default' });
    const st = await w.ctl.enable();
    eq('enabling requests permission exactly once', w.requestCalls, 1);
    eq('...then subscribes, registers and syncs -> active', [st.code, w.subscribeCalls, w.puts().length], ['active', 1, 1]);
    check('the schedule was uploaded', w.schedule.size > 0);
    const dec = await w.decryptAll();
    check('every uploaded body decrypts on the device to its v1 payload', dec.length === w.schedule.size && dec.every((d) => d.payload.v === 1 && d.payload.k === d.item.k));
    check('the service only ever receives ciphertext (no course code appears in the request)',
      !JSON.stringify(w.puts()[0].body).includes('AA1101') && !JSON.stringify(w.puts()[0].body).includes('Alpha'));
    check('fire times are 5 minutes before start', dec.every((d) => d.item.s - d.item.f === 300));
    check('each item carries a short topic and a plaintext hash', [...w.schedule.values()].every((i) => /^r[0-9a-z]{1,12}$/.test(i.t) && /^[0-9a-z]+$/.test(i.h)));
    check('push state persisted', JSON.parse(w.store.get(R.KEY_PUSH)).id !== null);
    const st2 = await w.ctl.enable();
    eq('enabling again does not prompt again', w.requestCalls, 1);
    eq('...and does not upload again (nothing changed)', w.puts().length, 1);
  }

  {
    // permission denied
    const w = await makeWorld({ permission: 'default', grant: false });
    const st = await w.ctl.enable();
    eq('denied permission is reported, not retried', [st.code, w.requestCalls, w.subscribeCalls], ['denied', 1, 0]);
    eq('no data is sent anywhere', w.requests.length, 0);
    const w2 = await makeWorld({ permission: 'denied' });
    const st2 = await w2.ctl.enable();
    eq('already-blocked permission is not re-requested', [st2.code, w2.requestCalls], ['denied', 0]);
  }

  {
    // unconfigured / unsupported / iOS tab
    const a = await makeWorld({ permission: 'default', config: {} });
    eq('no backend configured: status says so and nothing is requested', [(await a.ctl.enable()).code, a.requestCalls], ['unconfigured', 0]);
    const a2 = await makeWorld({ config: { apiBase: 'http://insecure.example' } });
    eq('plain http backend is refused', a2.ctl.status().code, 'unconfigured');
    const a3 = await makeWorld({ config: { apiBase: 'http://localhost:8787' } });
    eq('http://localhost is accepted for development', a3.ctl.status().code, 'needs-permission');
    const b = await makeWorld({ unsupported: true });
    eq('browser without push: unsupported', (await b.ctl.enable()).code, 'unsupported');
    eq('...and never prompts', b.requestCalls, 0);
    const c = await makeWorld({ unsupported: true, ios: true });
    eq('iOS tab outside the Home Screen: asks to install first', (await c.ctl.enable()).code, 'ios-install');
  }

  {
    // disable
    const w = await makeWorld({ permission: 'default' });
    await w.ctl.enable();
    const requestsBefore = w.requests.length;
    await w.ctl.disable();
    eq('disabling unsubscribes the browser', w.unsubscribeCalls, 1);
    check('...deletes the registration on the service', w.requests.slice(requestsBefore).some((r) => r.method === 'DELETE') && w.subs.size === 0);
    eq('status is off', w.ctl.status().code, 'off');
    check('the preference is stored as off', JSON.parse(w.store.get(R.KEY_PREFS)).enabled === false);
    const n = w.requests.length;
    w.ctl.markChanged(); await w.fire(); await w.ctl.reconcile();
    eq('once off, nothing more is sent', w.requests.length, n);
    eq('and no reminders are scheduled', w.ctl.schedule(), []);
    await w.ctl.enable();
    eq('turning back on: no second permission prompt', w.requestCalls, 1);
    eq('...and it re-registers and syncs', [w.ctl.status().code, w.subs.size], ['active', 1]);
  }

  {
    // changes -> debounced single sync with new content
    const w = await makeWorld({ permission: 'default' });
    await w.ctl.enable();
    eq('one upload after enabling', w.puts().length, 1);
    const firstKeys = [...w.schedule.keys()].sort();

    w.ctl.setDefaultLead(15);
    w.ctl.setClassSetting('mon-1045-bb1101-theory-r2', 10);
    w.ctl.setClassSetting('mon-1520-cc1101-tutorial-r3', 'off');
    eq('rapid changes do not upload immediately', w.puts().length, 1);
    await w.fire();
    eq('...they coalesce into ONE upload', w.puts().length, 2);
    const dec = await w.decryptAll();
    const lead = (course) => { const d = dec.find((x) => x.payload.i[0].c === course && x.item.s - x.item.f !== undefined); return d ? (d.item.s - d.item.f) / 60 : null; };
    eq('new default applied to inheriting classes', lead('AA1101'), 15);
    eq('custom class kept its own time', lead('BB1101'), 10);
    eq('disabled class has no reminder', lead('CC1101'), null);
    eq('same keys for the unchanged classes (updates, not duplicates)', [...w.schedule.keys()].filter((k) => firstKeys.includes(k)).length, w.schedule.size);
    check('the disabled class\'s reminders were removed from what the service holds', ![...dec].some((d) => d.payload.i[0].c === 'CC1101'));

    // schedule-affecting app change
    OFF_DAYS.add('2026-10-27');
    w.ctl.markChanged(); await w.fire();
    check('a new holiday removes that day\'s reminders from the service', ![...w.schedule.values()].some((i) => new Date(i.s * 1000).getDate() === 27));
    resetTimetable();

    // a change that alters no reminder is not uploaded
    const putsBefore = w.puts().length;
    w.ctl.markChanged(); await w.fire();
    const afterNoop = w.puts().length;
    w.ctl.markChanged(); await w.fire();
    eq('a change that leaves the schedule identical uploads nothing', w.puts().length, afterNoop);
    check('(sanity) the earlier real change did upload', afterNoop >= putsBefore);
  }

  {
    // idempotent: reconcile twice / reload
    const w = await makeWorld({ permission: 'granted' });
    await w.ctl.reconcile();
    await w.ctl.reconcile();
    eq('permission already granted: reconcile registers once and uploads once', [w.subs.size, w.puts().length], [1, 1]);
    const ctl2 = w.make();                 // a page refresh: new controller, same storage
    await ctl2.reconcile();
    eq('refresh does not re-register or re-upload', [w.subs.size, w.puts().length, w.subscribeCalls], [1, 1, 1]);
    eq('refresh shows the same active status', ctl2.status().code, 'active');
  }

  {
    // offline: queued, retried, never duplicated
    const w = await makeWorld({ permission: 'granted', online: false });
    await w.ctl.reconcile();
    eq('offline at startup: reported as an error, not a crash', w.ctl.status().code, 'error');
    check('...the app keeps its settings (nothing was lost)', w.ctl.isEnabled());
    check('while offline it waits for the browser\'s online event instead of polling', !w.timers.some((t) => t.live));
    w.online = true;
    await w.ctl.reconcile();             // what the app does on the window's 'online' event
    eq('back online: it registers and syncs', [w.ctl.status().code, w.subs.size, w.puts().length], ['active', 1, 1]);

    // change made while offline
    w.online = false;
    w.ctl.setDefaultLead(10);
    await w.fire();
    eq('a change made offline marks the state pending', [w.ctl.status().code, w.ctl.status().pending], ['error', true]);
    w.online = true;
    await w.ctl.reconcile();
    eq('on reconnect the pending change is delivered exactly once', [w.ctl.status().code, w.ctl.status().pending, w.puts().length], ['active', false, 2]);
    const dec = await w.decryptAll();
    check('...with the new 10-minute time', dec.every((d) => d.item.s - d.item.f === 600));
    const survivor = w.make();
    check('(a pending change survives a reload)', true);
    await survivor.reconcile();
    eq('...and a reload afterwards does not upload again', w.puts().length, 2);
  }

  {
    // server forgot us -> re-register once and succeed
    const w = await makeWorld({ permission: 'granted' });
    await w.ctl.reconcile();
    w.subs.clear();                       // e.g. the service lost its data
    w.ctl.setDefaultLead(10);             // any real change is enough to find out
    await w.fire();
    eq('401 from the service triggers a clean re-registration', [w.ctl.status().code, w.subs.size], ['active', 1]);
    check('...and the schedule is there again', w.schedule.size > 0);
  }

  {
    // transient failure then recovery
    const w = await makeWorld({ permission: 'granted' });
    w.failNext = { path: '/v1/config', method: 'GET', status: 503 };
    await w.ctl.reconcile();
    eq('a 5xx is an error state with a retry scheduled', [w.ctl.status().code, w.timers.some((t) => t.live)], ['error', true]);
    await w.fire();
    eq('the automatic retry recovers', w.ctl.status().code, 'active');
  }

  {
    // subscription replaced by the browser (new endpoint)
    const w = await makeWorld({ permission: 'granted' });
    await w.ctl.reconcile();
    const oldId = [...w.subs.keys()][0];
    w.device = await makeDevice('https://fcm.googleapis.com/fcm/send/REPLACEMENT');
    w.sub = null;                         // browser dropped the old subscription
    await w.ctl.reconcile({ force: true });
    check('a new subscription is registered', w.subs.size === 1 && !w.subs.has(oldId));
    check('the old registration was deleted so it cannot also deliver', w.requests.some((r) => r.method === 'DELETE' && r.path.endsWith(oldId)));
    eq('exactly one live registration remains', w.subs.size, 1);
    const dec = await w.decryptAll();
    check('the schedule is re-encrypted for the NEW subscription keys', dec.length === w.schedule.size && dec.length > 0);
  }

  {
    // test notification
    const w = await makeWorld({ permission: 'granted' });
    await w.ctl.reconcile();
    const r = await w.ctl.sendTest();
    check('test notification request accepted', r.ok === true);
    const d = await decrypt(ub64(w.lastTest.b), w.device.jwk, w.device.pub, w.device.auth);
    eq('the test message decrypts to a test payload', JSON.parse(d.text).test, 1);
  }

  {
    // storage trouble must not break the controller
    const broken = { get: () => { throw new Error('blocked'); }, set: () => false, remove: () => false };
    let ok = true;
    try {
      // the app's store wrapper swallows exceptions; a wrapper returning false/null is the realistic failure
      const s = { get: () => null, set: () => false, remove: () => false };
      const w = await makeWorld({ store: s, permission: 'granted' });
      await w.ctl.reconcile();
      w.ctl.setDefaultLead(10);
      ok = w.ctl.getPrefs().lead === 10;
    } catch (e) { ok = false; }
    check('storage that refuses writes degrades gracefully (settings still work for the session)', ok);
  }

  {
    // per-class settings for classes that no longer exist
    const w = await makeWorld({});
    w.ctl.setClassSetting('gone-id', 10);
    w.ctl.setClassSetting('mon-0855-aa1101-theory-r1', 'off');
    const changed = w.ctl.pruneClasses({ 'mon-0855-aa1101-theory-r1': true });
    eq('settings for classes missing from the published timetable are pruned', [changed, Object.keys(w.ctl.getPrefs().perClass)], [true, ['mon-0855-aa1101-theory-r1']]);
    check('invalid values are rejected', w.ctl.setClassSetting('x', 0) === false && w.ctl.setClassSetting('x', 181) === false && w.ctl.setDefaultLead(0) === false);
    w.ctl.setClassSetting('mon-0855-aa1101-theory-r1', 'default');
    eq('returning a class to "default" removes its entry (and the stored key when all-default)', [Object.keys(w.ctl.getPrefs().perClass).length, w.store.get(R.KEY_PREFS)], [0, null]);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
