import { config } from "../config.ts";
import { type Probability, type TeamCode, fixtureId, probability } from "../domain/ids.ts";
import type {
  ChampionMarketOdds,
  Confidence,
  Fixture,
  KalshiChampionMarket,
  KalshiGameMarket,
  MatchOdds,
  PolyChampionMarket,
  PolyGameMarket,
  SnapshotWarning,
  SourceTag,
} from "../domain/types.ts";
import { fixtureKeyDate } from "../shared/time.ts";
import { kalshiGameToKey, pairKey } from "./kalshi-parse.ts";
import { polyGameToKey } from "./polymarket-parse.ts";
import {
  TEAMS,
  fullNameToTeam,
  kalshiCodeToTeam,
  polyFullSlugFragmentToTeam,
  polyShortToTeam,
} from "./team-codes.ts";

const polyTeamFromRaw = (raw: string) => fullNameToTeam(raw) ?? polyShortToTeam(raw);

interface KalshiByKey {
  market: KalshiGameMarket;
  pA: Probability | null;
  pB: Probability | null;
  teamA: TeamCode;
  teamB: TeamCode;
}

interface PolyByKey {
  market: PolyGameMarket;
  pA: Probability | null;
  pB: Probability | null;
  teamA: TeamCode;
  teamB: TeamCode;
}

interface JoinInputs {
  fixtures: Fixture[];
  kalshiGames: KalshiGameMarket[];
  polyGames: PolyGameMarket[];
  kalshiChampion: KalshiChampionMarket[];
  polyChampion: PolyChampionMarket[];
}

export interface JoinOutput {
  matchOdds: MatchOdds[];
  championOdds: ChampionMarketOdds[];
  warnings: SnapshotWarning[];
}

// Convert a Kalshi YES-side market to teamA/teamB probabilities normalized to (pA,pB).
// We treat the team that sorts FIRST in pair as team A for the canonical row.
function kalshiToCanonicalAB(m: KalshiGameMarket): KalshiByKey | null {
  const key = kalshiGameToKey(m);
  if (!key) return null;
  const yesTeam = kalshiCodeToTeam(m.yesSideTeamCode);
  const pairedTeam = kalshiCodeToTeam(m.pairedTeamCode);
  if (!yesTeam || !pairedTeam) return null;
  const [a, b] = [yesTeam, pairedTeam].sort();
  if (!a || !b) return null;
  const teamA = a as TeamCode;
  const teamB = b as TeamCode;
  const yesP = m.midpoint;
  const pYesAsA = yesTeam === teamA ? yesP : yesP == null ? null : probability(1 - yesP);
  return {
    market: m,
    pA: pYesAsA,
    pB: pYesAsA == null ? null : probability(1 - pYesAsA),
    teamA,
    teamB,
  };
}

function polyToCanonicalAB(m: PolyGameMarket): PolyByKey | null {
  const teamA = polyTeamFromRaw(m.teamARaw);
  const teamB = polyTeamFromRaw(m.teamBRaw);
  if (!teamA || !teamB) return null;
  const [a, b] = [teamA, teamB].sort();
  if (!a || !b) return null;
  const sortedA = a as TeamCode;
  const sortedB = b as TeamCode;
  // Polymarket prices: outcomePriceA goes with raw teamA; flip if sort reordered.
  const pAsRawA = m.outcomePriceA;
  const pAsRawB = m.outcomePriceB;
  const pAFinal = teamA === sortedA ? pAsRawA : pAsRawB;
  const pBFinal = teamB === sortedB ? pAsRawB : pAsRawA;
  return { market: m, pA: pAFinal, pB: pBFinal, teamA: sortedA, teamB: sortedB };
}

const avg = (a: number, b: number): Probability => probability((a + b) / 2);

const confidenceFor = (sources: SourceTag, disagreementPp: number | null): Confidence => {
  if (sources === "fallback-50-50" || sources === "fallback-bt") return "low";
  if (sources === "kalshi-only" || sources === "poly-only") return "medium";
  if (disagreementPp != null && disagreementPp > config.DISAGREEMENT_PP) return "medium";
  return "high";
};

export function joinMarkets(inputs: JoinInputs): JoinOutput {
  const warnings: SnapshotWarning[] = [];

  // Index fixtures by (IST date, sorted pair). Only fixtures with both teams set
  // are eligible for matching (playoff stubs have NULL teams until bracket resolves).
  const fixturesByKey = new Map<string, Fixture>();
  for (const f of inputs.fixtures) {
    if (!f.teamA || !f.teamB) continue;
    if (f.status === "completed" || f.status === "abandoned") continue;
    const key = `${fixtureKeyDate(f.dateUtc)}|${pairKey(f.teamA, f.teamB)}`;
    fixturesByKey.set(key, f);
  }

  // Index venue markets by canonical key
  const kalshiByKey = new Map<string, KalshiByKey>();
  for (const m of inputs.kalshiGames) {
    const canon = kalshiToCanonicalAB(m);
    if (!canon) {
      warnings.push({
        level: "warn",
        code: "unmapped_market",
        detail: { source: "kalshi", ticker: m.ticker, reason: "team code unknown" },
      });
      continue;
    }
    const k = kalshiGameToKey(m);
    if (k) kalshiByKey.set(`${k.date}|${k.pair}`, canon);
  }

  const polyByKey = new Map<string, PolyByKey>();
  for (const m of inputs.polyGames) {
    const canon = polyToCanonicalAB(m);
    if (!canon) {
      warnings.push({
        level: "warn",
        code: "unmapped_market",
        detail: { source: "polymarket", slug: m.eventSlug, reason: "team name unknown" },
      });
      continue;
    }
    const k = polyGameToKey(m);
    if (k) polyByKey.set(`${k.date}|${k.pair}`, canon);
  }

  // Walk fixtures and produce one MatchOdds per (incomplete) fixture
  const matchOdds: MatchOdds[] = [];
  for (const [key, fixture] of fixturesByKey) {
    const k = kalshiByKey.get(key);
    const p = polyByKey.get(key);

    let avgPa: Probability | null = null;
    let avgPb: Probability | null = null;
    let sources: SourceTag;
    let disagreementPp: number | null = null;
    let volume: number | null = null;

    if (k?.pA != null && k.pB != null && p?.pA != null && p.pB != null) {
      avgPa = avg(k.pA, p.pA);
      avgPb = avg(k.pB, p.pB);
      sources = "both";
      disagreementPp = Math.abs(k.pA - p.pA);
      volume = p.market.volumeUsd ?? null;
    } else if (k?.pA != null && k.pB != null) {
      avgPa = k.pA;
      avgPb = k.pB;
      sources = "kalshi-only";
    } else if (p?.pA != null && p.pB != null) {
      avgPa = p.pA;
      avgPb = p.pB;
      sources = "poly-only";
      volume = p.market.volumeUsd ?? null;
    } else {
      // Phase A: 50/50 fallback. Phase B will swap in Bradley-Terry stub.
      avgPa = probability(0.5);
      avgPb = probability(0.5);
      sources = "fallback-50-50";
      warnings.push({
        level: "info",
        code: "fallback_used",
        detail: { matchNumber: fixture.matchNumber, key },
      });
    }

    matchOdds.push({
      matchNumber: fixtureId(fixture.matchNumber),
      kalshiPa: k?.pA ?? null,
      kalshiPb: k?.pB ?? null,
      polyPa: p?.pA ?? null,
      polyPb: p?.pB ?? null,
      avgPa,
      avgPb,
      sourcesUsed: sources,
      disagreementPp,
      combinedVolumeUsd: volume,
      confidence: confidenceFor(sources, disagreementPp),
    });

    if (disagreementPp != null && disagreementPp > config.DISAGREEMENT_PP) {
      warnings.push({
        level: "warn",
        code: "source_disagreement",
        detail: { matchNumber: fixture.matchNumber, disagreementPp },
      });
    }
  }

  // Champion-market join: by team code only (no date)
  const kalshiChampByTeam = new Map<TeamCode, KalshiChampionMarket>();
  for (const m of inputs.kalshiChampion) {
    const code = kalshiCodeToTeam(m.teamCodeRaw);
    if (!code) {
      warnings.push({
        level: "warn",
        code: "unmapped_market",
        detail: { source: "kalshi-champion", raw: m.teamCodeRaw },
      });
      continue;
    }
    kalshiChampByTeam.set(code, m);
  }

  const polyChampByTeam = new Map<TeamCode, PolyChampionMarket>();
  for (const m of inputs.polyChampion) {
    const code = polyFullSlugFragmentToTeam(m.teamCodeRaw);
    if (!code) {
      warnings.push({
        level: "warn",
        code: "unmapped_market",
        detail: { source: "polymarket-champion", raw: m.teamCodeRaw },
      });
      continue;
    }
    polyChampByTeam.set(code, m);
  }

  const championOdds: ChampionMarketOdds[] = [];
  for (const team of TEAMS) {
    const k = kalshiChampByTeam.get(team.code);
    const p = polyChampByTeam.get(team.code);
    // Resolved-market reconciliation: either venue says resolved → that's truth
    let resolvedSource: ChampionMarketOdds["resolvedSource"] = null;
    let avgP: Probability;
    let kalshiP: Probability | null = k?.yesMidpoint ?? null;
    let polyP: Probability | null = p?.yesPrice ?? null;

    if (k?.resolved) {
      resolvedSource = "kalshi";
      avgP = probability(k.resolvedYes ? 1 : 0);
      kalshiP = avgP;
    } else if (p?.resolved) {
      resolvedSource = "polymarket";
      avgP = probability(p.resolvedYes ? 1 : 0);
      polyP = avgP;
    } else if (kalshiP != null && polyP != null) {
      avgP = avg(kalshiP, polyP);
    } else if (kalshiP != null) {
      avgP = kalshiP;
    } else if (polyP != null) {
      avgP = polyP;
    } else {
      // No data for this team — skip (e.g., a missing champion market for some reason)
      continue;
    }

    championOdds.push({
      team: team.code,
      kalshiP,
      polyP,
      avgP,
      resolvedSource,
      disagreementPp: kalshiP != null && polyP != null ? Math.abs(kalshiP - polyP) : null,
    });
  }

  return { matchOdds, championOdds, warnings };
}
