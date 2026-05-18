// Single snapshot orchestrator. Pure of any I/O backend — accepts:
//   - the four external fetches (Kalshi games/champion, Polymarket games/champion) as Result-typed callables
//   - a way to load fixtures + standings
//   - a "trigger" tag for the snapshot metadata
// Returns the assembled SnapshotPayload ready to hand to buildSnapshotWrites().
//
// Both the Worker scheduled handler and the Node-side scripts/snapshot-dev.ts call this.

import { config } from "../config.ts";
import {
  isoUtc,
  type IsoUtc,
  snapshotId,
  type TeamCode,
} from "../domain/ids.ts";
import type {
  Fixture,
  KalshiChampionMarket,
  KalshiGameMarket,
  PolyChampionMarket,
  PolyGameMarket,
  SnapshotMeta,
  SnapshotTrigger,
  SnapshotWarning,
} from "../domain/types.ts";
import { joinMarkets } from "../matcher/join.ts";
import { simulate, type RemainingMatch } from "../monte-carlo/simulate.ts";
import { strengthWinProb, teamStrengths } from "../monte-carlo/strength.ts";
import type { ClientError } from "../shared/errors.ts";
import type { Result } from "../shared/result.ts";
import { uuidv7 } from "../shared/uuid.ts";
import type {
  SnapshotPayload,
  TeamProbabilityRow,
} from "../storage/snapshot-writer.ts";

export interface ClientCalls {
  kalshiGames: () => Promise<Result<KalshiGameMarket[], ClientError>>;
  kalshiChampion: () => Promise<Result<KalshiChampionMarket[], ClientError>>;
  polyGames: () => Promise<Result<PolyGameMarket[], ClientError>>;
  polyChampion: () => Promise<Result<PolyChampionMarket[], ClientError>>;
}

export interface InitialStanding {
  wins: number;
  losses: number;
  noResults: number;
  nrr: number;
}

export interface RunInputs {
  trigger: SnapshotTrigger;
  teamCodes: TeamCode[];
  fixtures: Fixture[];
  initialStandings: Map<TeamCode, InitialStanding>;
  clients: ClientCalls;
  nowUtc?: IsoUtc;
}

// Result-aware Promise.allSettled wrapper so one venue failure produces a warning,
// not a thrown error.
async function fetchOrWarn<T>(
  source: string,
  fn: () => Promise<Result<T, ClientError>>,
  warnings: SnapshotWarning[],
): Promise<T | null> {
  try {
    const r = await fn();
    if (r.ok) return r.value;
    warnings.push({
      level: "error",
      code: `${source}_fetch_failed`,
      detail: { kind: r.error.kind, status: r.error.status ?? null, detail: r.error.detail },
    });
    return null;
  } catch (e) {
    warnings.push({
      level: "error",
      code: `${source}_fetch_threw`,
      detail: { error: String((e as Error).message ?? e) },
    });
    return null;
  }
}

export async function runSnapshot(inputs: RunInputs): Promise<SnapshotPayload> {
  const warnings: SnapshotWarning[] = [];
  const nowUtc = inputs.nowUtc ?? isoUtc(new Date().toISOString());

  // Parallel fetches — fault-isolated per venue.
  const [kGames, kChamp, pGames, pChamp] = await Promise.all([
    fetchOrWarn("kalshi_games", inputs.clients.kalshiGames, warnings),
    fetchOrWarn("kalshi_champion", inputs.clients.kalshiChampion, warnings),
    fetchOrWarn("polymarket_games", inputs.clients.polyGames, warnings),
    fetchOrWarn("polymarket_champion", inputs.clients.polyChampion, warnings),
  ]);

  const join = joinMarkets({
    fixtures: inputs.fixtures,
    kalshiGames: kGames ?? [],
    polyGames: pGames ?? [],
    kalshiChampion: kChamp ?? [],
    polyChampion: pChamp ?? [],
  });

  // Build the strength model from per-match probs + champion market view, then run MC.
  const fixturesById = new Map(inputs.fixtures.map((f) => [f.matchNumber, f]));
  const perTeamProbs = new Map<TeamCode, number[]>();
  for (const t of inputs.teamCodes) perTeamProbs.set(t, []);
  const remaining: RemainingMatch[] = [];
  for (const mo of join.matchOdds) {
    const f = fixturesById.get(mo.matchNumber);
    if (!f || !f.teamA || !f.teamB) continue;
    const sorted = [f.teamA, f.teamB].sort();
    const sortedA = sorted[0];
    const sortedB = sorted[1];
    if (!sortedA || !sortedB) continue;
    perTeamProbs.get(sortedA)?.push(mo.avgPa);
    perTeamProbs.get(sortedB)?.push(mo.avgPb);
    remaining.push({
      matchNumber: mo.matchNumber,
      teamA: sortedA,
      teamB: sortedB,
      pA: mo.avgPa,
    });
  }

  const championAvg = new Map(join.championOdds.map((c) => [c.team, c.avgP]));
  const strengths = teamStrengths(inputs.teamCodes, { perTeamProbs, championAvgP: championAvg });
  const playoffWinProb = strengthWinProb(strengths, inputs.teamCodes);

  const simSeed = `playoffodds:${nowUtc.slice(0, 10)}`;
  const sim = simulate({
    iterations: config.MC_ITERATIONS,
    seed: simSeed,
    teams: inputs.teamCodes,
    initial: { byTeam: inputs.initialStandings },
    remaining,
    playoffWinProb,
  });

  const teamProbabilities: TeamProbabilityRow[] = inputs.teamCodes.map((t) => ({
    team: t,
    pPlayoffs: sim.pPlayoffs.get(t) ?? 0,
    pTop2: sim.pTop2.get(t) ?? 0,
    pChampion: sim.pChampion.get(t) ?? 0,
    simulatedWinsMean: sim.meanWins.get(t) ?? null,
    simulatedNrrMean: sim.meanNrr.get(t) ?? null,
  }));

  const contentHash = await sha256(
    JSON.stringify({
      k: (kGames ?? []).map((m) => [m.ticker, m.midpoint]).sort(),
      p: (pGames ?? []).map((m) => [m.eventSlug, m.outcomePriceA]).sort(),
      kC: (kChamp ?? []).map((m) => [m.ticker, m.yesMidpoint]).sort(),
      pC: (pChamp ?? []).map((m) => [m.teamCodeRaw, m.yesPrice]).sort(),
    }),
  );

  const meta: SnapshotMeta = {
    id: snapshotId(uuidv7()),
    takenAtUtc: nowUtc,
    trigger: inputs.trigger,
    schemaVersion: 1,
    tiebreakAlgorithmVersion: config.MC_TIEBREAK_ALGO_VERSION,
    contentHash,
  };

  return {
    meta,
    matchOdds: join.matchOdds,
    championOdds: join.championOdds,
    teamProbabilities,
    warnings: [...join.warnings, ...warnings],
    mcMeta: { iterations: sim.iterations, seedHash: 0 },
  };
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
