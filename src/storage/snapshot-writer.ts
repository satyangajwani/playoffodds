// Snapshot writer abstracted over an opaque DB handle so the same code works against
// better-sqlite3 (Phase A local dev) and the D1 binding (Phase B Workers cron).

import type {
  ChampionMarketOdds,
  MatchOdds,
  SnapshotMeta,
  SnapshotWarning,
} from "../domain/types.ts";

// Minimal interface that better-sqlite3 and D1 both satisfy enough of for our needs.
// In Phase A we instantiate this from better-sqlite3; in Phase B we wrap D1.prepare().
export interface DbAdapter {
  exec(sql: string, params?: Record<string, unknown> | unknown[]): void;
  // Used for diagnostic SELECTs in the writer (e.g., row counts after insert)
  count(table: string, where?: { snapshotId?: string }): number;
}

export interface SnapshotPayload {
  meta: SnapshotMeta;
  matchOdds: MatchOdds[];
  championOdds: ChampionMarketOdds[];
  warnings: SnapshotWarning[];
}

const nowIso = () => new Date().toISOString();

export function writeSnapshot(db: DbAdapter, payload: SnapshotPayload): void {
  const { meta, matchOdds, championOdds, warnings } = payload;

  // 1. Insert snapshot envelope (committed_at left NULL until the very end)
  db.exec(
    `INSERT INTO snapshots
      (id, taken_at_utc, trigger, schema_version, tiebreak_algorithm_version,
       mc_iterations, mc_seed, content_hash, payload_json, committed_at)
     VALUES (@id, @taken, @trigger, @schemaV, @tbV, @mcIter, @mcSeed, @hash, @payload, NULL)`,
    {
      id: meta.id,
      taken: meta.takenAtUtc,
      trigger: meta.trigger,
      schemaV: meta.schemaVersion,
      tbV: meta.tiebreakAlgorithmVersion,
      mcIter: null,
      mcSeed: null,
      hash: meta.contentHash,
      payload: JSON.stringify({ matchOdds, championOdds, warnings }),
    },
  );

  // 2. Per-fixture match odds rows
  for (const row of matchOdds) {
    db.exec(
      `INSERT INTO match_odds
         (snapshot_id, match_number, kalshi_p_a, kalshi_p_b, poly_p_a, poly_p_b,
          avg_p_a, avg_p_b, sources_used, disagreement_pp, combined_volume_usd, confidence)
       VALUES (@sid, @mn, @ka, @kb, @pa, @pb, @aa, @ab, @src, @dis, @vol, @conf)`,
      {
        sid: meta.id,
        mn: row.matchNumber,
        ka: row.kalshiPa,
        kb: row.kalshiPb,
        pa: row.polyPa,
        pb: row.polyPb,
        aa: row.avgPa,
        ab: row.avgPb,
        src: row.sourcesUsed,
        dis: row.disagreementPp,
        vol: row.combinedVolumeUsd,
        conf: row.confidence,
      },
    );
  }

  // 3. Per-team champion-market odds (cross-check input for Phase B renderer)
  for (const row of championOdds) {
    db.exec(
      `INSERT INTO champion_market_odds
         (snapshot_id, team_code, kalshi_p, poly_p, avg_p, resolved_source, disagreement_pp)
       VALUES (@sid, @team, @kp, @pp, @ap, @rs, @dis)`,
      {
        sid: meta.id,
        team: row.team,
        kp: row.kalshiP,
        pp: row.polyP,
        ap: row.avgP,
        rs: row.resolvedSource,
        dis: row.disagreementPp,
      },
    );
  }

  // 4. Warnings
  const ts = nowIso();
  for (const w of warnings) {
    db.exec(
      `INSERT INTO snapshot_warnings (snapshot_id, level, code, detail_json, created_at)
       VALUES (@sid, @lvl, @code, @detail, @ts)`,
      {
        sid: meta.id,
        lvl: w.level,
        code: w.code,
        detail: JSON.stringify(w.detail),
        ts,
      },
    );
  }

  // 5. Commit marker LAST. Readers filter WHERE committed_at IS NOT NULL so a Worker
  // killed mid-write can't surface partial state.
  db.exec("UPDATE snapshots SET committed_at = @ts WHERE id = @id", { ts, id: meta.id });
}
