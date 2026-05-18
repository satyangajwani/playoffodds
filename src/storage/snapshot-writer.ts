// Pure data layer for writing a snapshot. `buildSnapshotWrites` returns a flat list of
// (sql, params) pairs that are transport-agnostic — both better-sqlite3 (Node dev) and
// the D1 binding (Workers prod) execute them via their own batching semantics.
//
// The 'committed_at' row is written LAST so readers filter `WHERE committed_at IS NOT NULL`
// and never surface partial state.

import type { TeamCode } from "../domain/ids.ts";
import type {
  ChampionMarketOdds,
  MatchOdds,
  SnapshotMeta,
  SnapshotWarning,
} from "../domain/types.ts";

export interface TeamProbabilityRow {
  team: TeamCode;
  pPlayoffs: number;
  pTop2: number;
  pChampion: number;
  simulatedWinsMean: number | null;
  simulatedNrrMean: number | null;
}

export interface SnapshotPayload {
  meta: SnapshotMeta;
  matchOdds: MatchOdds[];
  championOdds: ChampionMarketOdds[];
  teamProbabilities: TeamProbabilityRow[];
  warnings: SnapshotWarning[];
  mcMeta?: { iterations: number; seedHash: number };
}

// Positional bindings — D1 supports only `.bind(...values)` positionally; better-sqlite3
// accepts the same when we pass `.run(...values)`. Named-param syntax (@name) is dropped
// to keep both paths working.
export interface SqlWrite {
  sql: string;
  values: unknown[];
}

const nowIso = () => new Date().toISOString();

export function buildSnapshotWrites(payload: SnapshotPayload): SqlWrite[] {
  const { meta, matchOdds, championOdds, teamProbabilities, warnings, mcMeta } = payload;
  const writes: SqlWrite[] = [];
  const ts = nowIso();

  // 1. Snapshot envelope (committed_at NULL until the final write)
  writes.push({
    sql: `INSERT INTO snapshots
      (id, taken_at_utc, trigger, schema_version, tiebreak_algorithm_version,
       mc_iterations, mc_seed, content_hash, payload_json, committed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    values: [
      meta.id,
      meta.takenAtUtc,
      meta.trigger,
      meta.schemaVersion,
      meta.tiebreakAlgorithmVersion,
      mcMeta?.iterations ?? null,
      mcMeta?.seedHash ?? null,
      meta.contentHash,
      JSON.stringify({ matchOdds, championOdds, teamProbabilities, warnings }),
    ],
  });

  // 2. Match odds per fixture
  for (const row of matchOdds) {
    writes.push({
      sql: `INSERT INTO match_odds
         (snapshot_id, match_number, kalshi_p_a, kalshi_p_b, poly_p_a, poly_p_b,
          avg_p_a, avg_p_b, sources_used, disagreement_pp, combined_volume_usd, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        meta.id,
        row.matchNumber,
        row.kalshiPa,
        row.kalshiPb,
        row.polyPa,
        row.polyPb,
        row.avgPa,
        row.avgPb,
        row.sourcesUsed,
        row.disagreementPp,
        row.combinedVolumeUsd,
        row.confidence,
      ],
    });
  }

  // 3. Team probabilities (Phase B)
  for (const row of teamProbabilities) {
    writes.push({
      sql: `INSERT INTO team_probabilities
         (snapshot_id, team_code, p_playoffs, p_top2, p_champion,
          simulated_wins_mean, simulated_nrr_mean)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values: [
        meta.id,
        row.team,
        row.pPlayoffs,
        row.pTop2,
        row.pChampion,
        row.simulatedWinsMean,
        row.simulatedNrrMean,
      ],
    });
  }

  // 4. Champion market odds
  for (const row of championOdds) {
    writes.push({
      sql: `INSERT INTO champion_market_odds
         (snapshot_id, team_code, kalshi_p, poly_p, avg_p, resolved_source, disagreement_pp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values: [
        meta.id,
        row.team,
        row.kalshiP,
        row.polyP,
        row.avgP,
        row.resolvedSource,
        row.disagreementPp,
      ],
    });
  }

  // 5. Warnings
  for (const w of warnings) {
    writes.push({
      sql: `INSERT INTO snapshot_warnings (snapshot_id, level, code, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      values: [meta.id, w.level, w.code, JSON.stringify(w.detail), ts],
    });
  }

  // 6. Commit marker LAST. Readers filter on this so a half-written snapshot is invisible.
  writes.push({
    sql: "UPDATE snapshots SET committed_at = ? WHERE id = ?",
    values: [ts, meta.id],
  });

  return writes;
}

// Convenience: execute writes synchronously against a better-sqlite3 handle. Used by
// the Node dev path (scripts/snapshot-dev.ts and scripts/dev-server.ts).
// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 transaction generic is awkward to thread; we just need a callable that runs in a txn
export function applyWritesSync(db: any, writes: SqlWrite[]): void {
  const txn = db.transaction(() => {
    for (const w of writes) db.prepare(w.sql).run(...w.values);
  });
  txn();
}

// D1 path used by the Worker. Single batch = atomic per Cloudflare D1 semantics.
export async function applyWritesD1(
  db: { prepare(sql: string): { bind(...v: unknown[]): unknown } },
  writes: SqlWrite[],
): Promise<void> {
  type D1Stmt = { bind(...v: unknown[]): unknown };
  // We can't reference D1Database at runtime, so we duck-type the binding.
  const stmts = writes.map((w) => (db.prepare(w.sql) as D1Stmt).bind(...w.values));
  // biome-ignore lint/suspicious/noExplicitAny: D1 batch type isn't statically visible here
  await (db as any).batch(stmts);
}
