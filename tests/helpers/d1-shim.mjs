// A minimal stand-in for Cloudflare D1 built on Node's SQLite, so the real Worker
// code (JSON functions, upserts, RETURNING, batches) runs against a real SQL engine.
// Only the slice of the D1 API the Worker uses is implemented.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCHEMA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'worker', 'schema.sql');

class Statement {
  constructor(db, sql, params, stats) { this.db = db; this.sql = sql; this.params = params || []; this.stats = stats; }
  bind(...params) { return new Statement(this.db, this.sql, params, this.stats); }
  get returnsRows() { return /^\s*select\b/i.test(this.sql) || /\breturning\b/i.test(this.sql); }
  _exec() {
    this.stats.queries++;
    const stmt = this.db.prepare(this.sql);
    if (this.returnsRows) return { results: stmt.all(...this.params).map((r) => ({ ...r })), meta: { changes: 0 } };
    const info = stmt.run(...this.params);
    this.stats.writes += Number(info.changes);
    return { results: [], meta: { changes: Number(info.changes) } };
  }
  async first() { const r = this._exec().results; return r.length ? r[0] : null; }
  async all() { return this._exec(); }
  async run() { return this._exec(); }
}

export function createD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(SCHEMA, 'utf8'));
  const stats = { queries: 0, writes: 0 };
  return {
    db, stats,
    prepare(sql) { return new Statement(db, sql, [], stats); },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const out = statements.map((s) => s._exec());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    // test conveniences
    rows(sql, ...params) { return db.prepare(sql).all(...params).map((r) => ({ ...r })); }
  };
}
