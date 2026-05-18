// Build the page view-model from a snapshot. Decouples DB shape from JSX templates.

import { config } from "../config.ts";
import type { TeamCode } from "../domain/ids.ts";
import type { DbReadHandle } from "../storage/d1-shim.ts";
import {
  type ChampionRow,
  type MatchOddsRow,
  type SnapshotMetaRow,
  type TeamProbabilityRow,
  type TeamRow,
  getChampionMarketOdds,
  getMatchOdds,
  getTeamProbabilities,
} from "../storage/repo.ts";

export type StalenessTier = "fresh" | "amber" | "red";

export interface TeamRowVM {
  code: TeamCode;
  fullName: string;
  shortName: string;
  pPlayoffs: number;
  pTop2: number;
  pChampion: number;
  status: "qualified" | "eliminated" | "live";
}

export interface CrossCheckVM {
  team: TeamCode;
  shortName: string;
  derived: number;
  market: number;
  deltaPp: number;
  flagged: boolean;
}

export interface PageVM {
  snapshotId: string;
  takenAtUtc: string;
  isHistorical: boolean;
  ageMinutes: number;
  staleness: StalenessTier;
  rows: TeamRowVM[];
  crossCheck: CrossCheckVM[];
  totalSnapshots?: number;
}

export interface ViewModelInputs {
  snapshot: SnapshotMetaRow;
  teams: TeamRow[];
  probabilities: TeamProbabilityRow[];
  champion: ChampionRow[];
  match: MatchOddsRow[];
  nowUtc: string;
  isHistorical: boolean;
}

const minutesBetween = (a: string, b: string) =>
  Math.max(0, (Date.parse(a) - Date.parse(b)) / 60000);

const stalenessFor = (ageMin: number): StalenessTier => {
  const amber = config.STALENESS_AMBER_MS / 60_000;
  const red = config.STALENESS_RED_MS / 60_000;
  if (ageMin >= red) return "red";
  if (ageMin >= amber) return "amber";
  return "fresh";
};

export function buildViewModel(inputs: ViewModelInputs): PageVM {
  const teamByCode = new Map(inputs.teams.map((t) => [t.code, t]));
  const probsByCode = new Map(inputs.probabilities.map((p) => [p.team_code, p]));
  const champByCode = new Map(inputs.champion.map((c) => [c.team_code, c]));

  // Build TeamRowVMs sorted by P(playoffs) desc, with status badges
  const rows: TeamRowVM[] = inputs.teams.map((t) => {
    const p = probsByCode.get(t.code);
    const pPlayoffs = p?.p_playoffs ?? 0;
    const pTop2 = p?.p_top2 ?? 0;
    const pChampion = p?.p_champion ?? 0;
    const status: TeamRowVM["status"] =
      pPlayoffs >= 0.999 ? "qualified" : pPlayoffs <= 0.001 ? "eliminated" : "live";
    return {
      code: t.code,
      fullName: t.full_name,
      shortName: t.short_name,
      pPlayoffs,
      pTop2,
      pChampion,
      status,
    };
  });
  rows.sort((a, b) => b.pPlayoffs - a.pPlayoffs || b.pChampion - a.pChampion);

  const crossCheck: CrossCheckVM[] = rows.map((r) => {
    const c = champByCode.get(r.code);
    const market = c?.avg_p ?? 0;
    const derived = r.pChampion;
    const deltaPp = derived - market;
    return {
      team: r.code,
      shortName: r.shortName,
      derived,
      market,
      deltaPp,
      flagged: Math.abs(deltaPp) >= config.CHAMPION_CROSS_CHECK_DELTA_PP,
    };
  });

  const ageMinutes = minutesBetween(inputs.nowUtc, inputs.snapshot.taken_at_utc);

  return {
    snapshotId: inputs.snapshot.id,
    takenAtUtc: inputs.snapshot.taken_at_utc,
    isHistorical: inputs.isHistorical,
    ageMinutes,
    staleness: stalenessFor(ageMinutes),
    rows,
    crossCheck,
  };
}

// Convenience loader — fetches all the pieces and returns the assembled view model.
export async function loadPageVM(
  db: DbReadHandle,
  teams: TeamRow[],
  snapshot: SnapshotMetaRow,
  nowUtc: string,
  isHistorical: boolean,
): Promise<PageVM> {
  const [probabilities, champion, match] = await Promise.all([
    getTeamProbabilities(db, snapshot.id),
    getChampionMarketOdds(db, snapshot.id),
    getMatchOdds(db, snapshot.id),
  ]);
  return buildViewModel({ snapshot, teams, probabilities, champion, match, nowUtc, isHistorical });
}
