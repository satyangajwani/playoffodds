import type {
  FixtureId,
  IsoUtc,
  KalshiEventTicker,
  KalshiTicker,
  PolyEventSlug,
  Probability,
  SnapshotId,
  TeamCode,
} from "./ids.ts";

// ---------- Reference data ----------
export interface Team {
  code: TeamCode;
  fullName: string;
  shortName: string;
  primaryColorHex: string;
  kalshiCode: string;
  polyShortCodes: string[]; // ['mum', 'mi']
}

export type FixtureStatus = "scheduled" | "live" | "completed" | "abandoned";
export type FixtureStage = "league" | "qualifier_1" | "eliminator" | "qualifier_2" | "final";

export interface Fixture {
  matchNumber: FixtureId;
  dateUtc: IsoUtc;
  venue: string;
  teamA: TeamCode | null; // null for playoff stubs before bracket is set
  teamB: TeamCode | null;
  kalshiGameTicker: KalshiTicker | null;
  polyEventSlug: PolyEventSlug | null;
  status: FixtureStatus;
  stage: FixtureStage;
}

export interface FixtureResult {
  matchNumber: FixtureId;
  winner: TeamCode | null; // null on no-result
  marginRuns: number | null;
  marginWickets: number | null;
  teamARuns: number | null;
  teamAOvers: number | null;
  teamBRuns: number | null;
  teamBOvers: number | null;
  completedAtUtc: IsoUtc;
}

// ---------- Standings (derived from results) ----------
export interface StandingRow {
  team: TeamCode;
  played: number;
  wins: number;
  losses: number;
  noResults: number;
  points: number; // 2 * wins + 1 * noResults
  nrr: number;
}

// ---------- Market-side records (BEFORE matcher join) ----------
export interface KalshiGameMarket {
  ticker: KalshiTicker;
  title: string;
  status: string; // 'unopened'|'open'|'active'|'paused'|'closed'|'settled' (only 'settled' is load-bearing)
  yesSideTeamCode: string; // raw, not branded — matcher normalizes
  pairedTeamCode: string; // raw
  startUtc: IsoUtc;
  yesBidDollars: number | null;
  yesAskDollars: number | null;
  lastPriceDollars: number | null;
  midpoint: Probability | null; // computed
  volumeFp: number | null;
  resolved: boolean;
  resolvedYes: boolean | null;
}

export interface KalshiChampionMarket {
  eventTicker: KalshiEventTicker;
  ticker: KalshiTicker; // 'KXIPL-26-RCB'
  teamCodeRaw: string;
  yesMidpoint: Probability | null;
  resolved: boolean;
  resolvedYes: boolean | null;
}

export interface PolyGameMarket {
  eventSlug: PolyEventSlug; // 'cricipl-che-sun-2026-05-18'
  dateUtc: IsoUtc;
  teamARaw: string;
  teamBRaw: string;
  outcomePriceA: Probability | null;
  outcomePriceB: Probability | null;
  resolved: boolean;
  resolvedWinnerRaw: string | null;
  volumeUsd: number | null;
}

export interface PolyChampionMarket {
  eventSlug: PolyEventSlug; // '2026-ipl-champion'
  teamSlugRaw: string; // 'will-royal-challengers-bengaluru-win-...'
  teamCodeRaw: string; // raw, matcher normalizes
  yesPrice: Probability | null;
  resolved: boolean;
  resolvedYes: boolean | null;
  volumeUsd: number | null;
}

// ---------- Matched (AFTER matcher join) ----------
export type SourceTag = "both" | "kalshi-only" | "poly-only" | "fallback-bt" | "fallback-50-50";
export type Confidence = "high" | "medium" | "low";

export interface MatchOdds {
  matchNumber: FixtureId;
  kalshiPa: Probability | null;
  kalshiPb: Probability | null;
  polyPa: Probability | null;
  polyPb: Probability | null;
  avgPa: Probability;
  avgPb: Probability;
  sourcesUsed: SourceTag;
  disagreementPp: number | null;
  combinedVolumeUsd: number | null;
  confidence: Confidence;
}

export interface ChampionMarketOdds {
  team: TeamCode;
  kalshiP: Probability | null;
  polyP: Probability | null;
  avgP: Probability;
  resolvedSource: "kalshi" | "polymarket" | null;
  disagreementPp: number | null;
}

// ---------- Snapshot envelope ----------
export type SnapshotTrigger = "cron" | "manual" | "backfill" | "snapshot-dev";

export interface SnapshotMeta {
  id: SnapshotId;
  takenAtUtc: IsoUtc;
  trigger: SnapshotTrigger;
  schemaVersion: number;
  tiebreakAlgorithmVersion: number;
  contentHash: string | null;
}

export interface SnapshotWarning {
  level: "info" | "warn" | "error";
  code: string;
  detail: Record<string, unknown>;
}

export interface PhaseAResult {
  meta: SnapshotMeta;
  matchOdds: MatchOdds[];
  championOdds: ChampionMarketOdds[];
  warnings: SnapshotWarning[];
}
