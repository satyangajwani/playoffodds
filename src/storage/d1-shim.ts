// Minimal D1Database-compatible shim over better-sqlite3 for Node-side dev.
// Implements just what we actually call on the read path: prepare().bind(...).first() / .all().
// Phase D will wire the real D1 binding in the deployed Worker; this shim only runs locally.

import type { Database as SqliteDb } from "better-sqlite3";

type Row = Record<string, unknown>;

interface ShimStatement {
  bind(...values: unknown[]): ShimStatement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: true; meta: { changes: number } }>;
}

interface ShimDb {
  prepare(sql: string): ShimStatement;
  batch<T = Row>(statements: ShimStatement[]): Promise<{ results: T[] }[]>;
}

export function d1ShimFromSqlite(db: SqliteDb): ShimDb {
  return {
    prepare(sql: string): ShimStatement {
      let boundValues: unknown[] = [];
      const stmt: ShimStatement = {
        bind(...values: unknown[]) {
          boundValues = values;
          return stmt;
        },
        async first<T = Row>(): Promise<T | null> {
          const row = db.prepare(sql).get(...boundValues) as T | undefined;
          return row ?? null;
        },
        async all<T = Row>(): Promise<{ results: T[] }> {
          const rows = db.prepare(sql).all(...boundValues) as T[];
          return { results: rows };
        },
        async run() {
          const info = db.prepare(sql).run(...boundValues);
          return { success: true as const, meta: { changes: info.changes } };
        },
      };
      return stmt;
    },
    async batch<T = Row>(statements: ShimStatement[]) {
      // We don't call batch on the read path; provide a no-op-ish implementation for completeness.
      const out: { results: T[] }[] = [];
      for (const s of statements) {
        out.push(await s.all<T>());
      }
      return out;
    },
  };
}

export type { ShimDb as DbReadHandle };
