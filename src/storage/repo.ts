// Read-side repository functions. Both production (D1 binding) and dev (better-sqlite3 shim)
// satisfy the same minimal `DbReadHandle` interface.

import type { TeamCode } from "../domain/ids.ts";
import type { DbReadHandle } from "./d1-shim.ts";

export interface SnapshotMetaRow {
  id: string;
  taken_at_utc: string;
  trigger: string;
  schema_version: number;
  tiebreak_algorithm_version: number;
  mc_iterations: number | null;
  content_hash: string | null;
  committed_at: string | null;
  payload_json: string | null;
}

export interface TeamProbabilityRow {
  snapshot_id: string;
  team_code: TeamCode;
  p_playoffs: number;
  p_top2: number;
  p_champion: number;
  simulated_wins_mean: number | null;
  simulated_nrr_mean: number | null;
}

export interface ChampionRow {
  snapshot_id: string;
  team_code: TeamCode;
  kalshi_p: number | null;
  poly_p: number | null;
  avg_p: number;
  resolved_source: string | null;
  disagreement_pp: number | null;
}

export interface MatchOddsRow {
  snapshot_id: string;
  match_number: number;
  avg_p_a: number;
  avg_p_b: number;
  sources_used: string;
  disagreement_pp: number | null;
  confidence: string;
}

export interface TeamRow {
  code: TeamCode;
  full_name: string;
  short_name: string;
  primary_color_hex: string;
}

export const getLatestSnapshot = async (db: DbReadHandle): Promise<SnapshotMetaRow | null> =>
  db
    .prepare(
      "SELECT * FROM snapshots WHERE committed_at IS NOT NULL ORDER BY taken_at_utc DESC LIMIT 1",
    )
    .first<SnapshotMetaRow>();

// Snap to the latest committed snapshot ≤ requested timestamp. Returns null if none earlier.
export const getSnapshotAtOrBefore = async (
  db: DbReadHandle,
  isoUtc: string,
): Promise<SnapshotMetaRow | null> =>
  db
    .prepare(
      `SELECT * FROM snapshots
       WHERE committed_at IS NOT NULL AND taken_at_utc <= ?
       ORDER BY taken_at_utc DESC LIMIT 1`,
    )
    .bind(isoUtc)
    .first<SnapshotMetaRow>();

export const getSnapshotById = async (
  db: DbReadHandle,
  id: string,
): Promise<SnapshotMetaRow | null> =>
  db
    .prepare("SELECT * FROM snapshots WHERE id = ? AND committed_at IS NOT NULL")
    .bind(id)
    .first<SnapshotMetaRow>();

export const listSnapshotTimes = async (
  db: DbReadHandle,
  sinceUtc: string,
): Promise<{ taken_at_utc: string }[]> => {
  const r = await db
    .prepare(
      "SELECT taken_at_utc FROM snapshots WHERE committed_at IS NOT NULL AND taken_at_utc >= ? ORDER BY taken_at_utc DESC LIMIT 500",
    )
    .bind(sinceUtc)
    .all<{ taken_at_utc: string }>();
  return r.results;
};

export const getTeamProbabilities = async (
  db: DbReadHandle,
  snapshotId: string,
): Promise<TeamProbabilityRow[]> => {
  const r = await db
    .prepare("SELECT * FROM team_probabilities WHERE snapshot_id = ?")
    .bind(snapshotId)
    .all<TeamProbabilityRow>();
  return r.results;
};

export const getChampionMarketOdds = async (
  db: DbReadHandle,
  snapshotId: string,
): Promise<ChampionRow[]> => {
  const r = await db
    .prepare("SELECT * FROM champion_market_odds WHERE snapshot_id = ?")
    .bind(snapshotId)
    .all<ChampionRow>();
  return r.results;
};

export const getMatchOdds = async (
  db: DbReadHandle,
  snapshotId: string,
): Promise<MatchOddsRow[]> => {
  const r = await db
    .prepare("SELECT * FROM match_odds WHERE snapshot_id = ?")
    .bind(snapshotId)
    .all<MatchOddsRow>();
  return r.results;
};

export const getAllTeams = async (db: DbReadHandle): Promise<TeamRow[]> => {
  const r = await db.prepare("SELECT * FROM teams ORDER BY code").all<TeamRow>();
  return r.results;
};
