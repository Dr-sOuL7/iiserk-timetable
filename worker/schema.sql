-- D1 schema for the IISER-K Timetable reminder relay.
-- Apply with:  npx wrangler d1 execute iiserk-reminders --remote --file=./schema.sql
-- (idempotent: safe to re-run after upgrades)

-- One row per browser push subscription. The server never stores the
-- subscription's encryption keys: reminders arrive already encrypted.
CREATE TABLE IF NOT EXISTS subscriptions (
  id            TEXT PRIMARY KEY,              -- sha256(endpoint), first 32 hex chars
  endpoint      TEXT NOT NULL,                 -- push-service URL (a capability: treated as secret)
  proof_hash    TEXT NOT NULL,                 -- sha256(client proof); lets a device that lost its token re-register
  token_hash    TEXT NOT NULL,                 -- sha256(bearer token); the token itself is never stored
  tz            TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,              -- unix seconds
  last_sync_at  INTEGER NOT NULL,
  sync_window   INTEGER NOT NULL DEFAULT 0,    -- start (unix s) of the current rate-limit hour
  sync_count    INTEGER NOT NULL DEFAULT 0,
  last_test_at  INTEGER NOT NULL DEFAULT 0,
  failures      INTEGER NOT NULL DEFAULT 0     -- consecutive rejected deliveries (stale/foreign subscription)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created ON subscriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_sync ON subscriptions(last_sync_at);

-- One row per scheduled notification. `body` is the complete, already-encrypted
-- aes128gcm message (base64url): the relay cannot read it.
--   state: 0 pending, 1 claimed (being sent), 2 sent, 3 given up
CREATE TABLE IF NOT EXISTS reminders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_id     TEXT NOT NULL,
  key        TEXT NOT NULL,                    -- stable per class occurrence; the client's dedupe key
  fire_at    INTEGER NOT NULL,                 -- unix seconds
  start_at   INTEGER NOT NULL,                 -- class start, unix seconds (never deliver after this)
  topic      TEXT NOT NULL,
  h          TEXT NOT NULL,                    -- client hash of the plaintext: skip rewriting unchanged rows
  body       TEXT NOT NULL,
  state      INTEGER NOT NULL DEFAULT 0,
  claimed_at INTEGER,
  sent_at    INTEGER,
  attempts   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (sub_id, key)
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(fire_at) WHERE state = 0;
CREATE INDEX IF NOT EXISTS idx_reminders_claimed ON reminders(claimed_at) WHERE state = 1;
CREATE INDEX IF NOT EXISTS idx_reminders_start ON reminders(start_at);
