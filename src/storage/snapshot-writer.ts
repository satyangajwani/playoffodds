// Snapshot writer abstracted over an opaque DB handle so the same code works against
// better-sqlite3 (Phase A local dev) and the D1 binding (Phase B Workers cron).

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
  teamProbabilities: TeamProbabilityRow[];
  warnings: SnapshotWarning[];
  mcMeta?: { iterations: number; seedHash: number };
}

const nowIso = () => new Date().toISOString();

export function writeSnapshot(db: DbAdapter, payload: SnapshotPayload): void {
  const { meta, matchOdds, championOdds, teamProbabilities, warnings, mcMeta } = payload;

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
      mcIter: mcMeta?.iterations ?? null,
      mcSeed: mcMeta?.seedHash ?? null,
      hash: meta.contentHash,
      payload: JSON.stringify({ matchOdds, championOdds, teamProbabilities, warnings }),
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

  // 2b. Per-team Monte Carlo probabilities (Phase B)
  for (const row of teamProbabilities) {
    db.exec(
      `INSERT INTO team_probabilities
         (snapshot_id, team_code, p_playoffs, p_top2, p_champion,
          simulated_wins_mean, simulated_nrr_mean)
       VALUES (@sid, @team, @pp, @pt, @pc, @sw, @sn)`,
      {
        sid: meta.id,
        team: row.team,
        pp: row.pPlayoffs,
        pt: row.pTop2,
        pc: row.pChampion,
        sw: row.simulatedWinsMean,
        sn: row.simulatedNrrMean,
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
