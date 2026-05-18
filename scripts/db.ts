// Local dev database helper. Phase A uses a plain better-sqlite3 file at ./dev.db so
// snapshot:dev can run as a normal Node script. Phase B will move snapshot writes into
// the Worker and use the D1 binding; the schema is identical.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database, { type Database as DatabaseT } from "better-sqlite3";

export const DB_PATH = "./dev.db";

export function openDb(path: string = DB_PATH): DatabaseT {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function applyMigrations(db: DatabaseT): void {
  // D1 expects forward-only migrations under migrations/. For local we just apply 0001_init.sql.
  // The SQL file is idempotent-ish: we rely on `CREATE TABLE IF NOT EXISTS` being absent so
  // a re-run errors out — caller should delete dev.db to reset.
  const sql = readFileSync(join(import.meta.dirname, "..", "migrations", "0001_init.sql"), "utf8");
  db.exec(sql);
}
