// Main Monte Carlo loop. Per resolved decisions:
//   - 25,000 iterations (Wilson 95% CI ±0.62pp at p=0.5, below 1-decimal display precision)
//   - sfc32 PRNG seeded from the snapshot ID for full determinism
//   - Common Random Numbers: each remaining match gets a FIXED slot in the RNG stream,
//     so probability changes between snapshots reflect input changes, not RNG noise
//   - NRR tie-break via per-outcome normal perturbation (bootstrap from real margins is v2)

import { config } from "../config.ts";
import type { TeamCode } from "../domain/ids.ts";
import { nrrDeltaForOutcome } from "./nrr-perturb.ts";
import { type WinProb, simulatePlayoffs } from "./playoffs.ts";
import { hashSeed, sfc32 } from "./rng.ts";
import {
  type MutStandings,
  type StandingsLayout,
  applyOutcome,
  copyInto,
  newLayout,
  newStandings,
  rankWithTiebreakers,
} from "./standings.ts";

export interface RemainingMatch {
  matchNumber: number;
  teamA: TeamCode;
  teamB: TeamCode;
  pA: number; // P(team A wins), already averaged
}

export interface InitialStandings {
  // Per-team: completed-game state at simulation start
  byTeam: Map<TeamCode, { wins: number; losses: number; noResults: number; nrr: number }>;
  // Head-to-head from completed games (optional; if empty, tiebreak collapses to NRR + random)
  h2h?: Map<TeamCode, Map<TeamCode, number>>;
}

export interface SimResult {
  // For each team: P(top4), P(top2), P(champion)
  pPlayoffs: Map<TeamCode, number>;
  pTop2: Map<TeamCode, number>;
  pChampion: Map<TeamCode, number>;
  // Means of simulated end-of-season wins + NRR (useful for view/debug)
  meanWins: Map<TeamCode, number>;
  meanNrr: Map<TeamCode, number>;
  iterations: number;
  seed: string;
}

export interface SimulateOptions {
  iterations?: number;
  seed: string;
  teams: TeamCode[]; // canonical ordering
  initial: InitialStandings;
  remaining: RemainingMatch[];
  // P(A beats B) for playoff matches. Caller can pass any model; v1 uses a strength model
  // derived from regular-season probabilities, see strength.ts. Falls back to 0.5 if absent.
  playoffWinProb?: WinProb;
}

export function simulate(opts: SimulateOptions): SimResult {
  const iterations = opts.iterations ?? config.MC_ITERATIONS;
  const layout = newLayout(opts.teams);
  const N = opts.teams.length;

  // Initial standings (computed once, reused per iteration via copyInto)
  const initial = newStandings(layout);
  for (const [code, init] of opts.initial.byTeam) {
    const i = layout.teamIndex.get(code);
    if (i === undefined) continue;
    initial.wins[i] = init.wins;
    initial.losses[i] = init.losses;
    initial.noResults[i] = init.noResults;
    initial.nrr[i] = init.nrr;
    initial.points[i] = 2 * init.wins + init.noResults;
  }
  if (opts.initial.h2h) {
    for (const [winner, opponents] of opts.initial.h2h) {
      const wi = layout.teamIndex.get(winner);
      if (wi === undefined) continue;
      for (const [loser, count] of opponents) {
        const li = layout.teamIndex.get(loser);
        if (li === undefined) continue;
        initial.h2h[wi * N + li] = count;
      }
    }
  }

  // Resolve remaining matches into index pairs once
  const remainingIdx = opts.remaining.flatMap((m) => {
    const ai = layout.teamIndex.get(m.teamA);
    const bi = layout.teamIndex.get(m.teamB);
    if (ai === undefined || bi === undefined) return [];
    return [{ matchNumber: m.matchNumber, ai, bi, pA: m.pA }];
  });

  // Common Random Numbers: each remaining match gets a fixed RNG sub-stream so changing
  // one match's probability between snapshots doesn't reshuffle every other draw.
  // We achieve this by deriving a per-iteration, per-match seed = hash(snapshotSeed, iter, matchNumber).
  // Cheap approach: one master RNG per iteration, with per-match draws taken as a function of iter+match.
  const masterRng = (() => {
    const [a, b, c, d] = hashSeed(opts.seed);
    return sfc32(a, b, c, d);
  })();

  // Pre-allocate the per-iteration working standings
  const work = newStandings(layout);

  // Accumulators
  const playoffCounts = new Uint32Array(N);
  const top2Counts = new Uint32Array(N);
  const championCounts = new Uint32Array(N);
  const winsSum = new Float64Array(N);
  const nrrSum = new Float64Array(N);

  const playoffWinProb: WinProb = opts.playoffWinProb ?? (() => 0.5);

  for (let iter = 0; iter < iterations; iter++) {
    copyInto(work, initial);

    // Iterate remaining matches. CRN-style: we still use the master stream, but the OUTCOME
    // of match m at iteration k depends only on hash(seed, k, m). That gives true CRN.
    for (const m of remainingIdx) {
      // Draw uniform from a sub-stream keyed by (iter, matchNumber). Cheap and deterministic.
      const u = subStreamDraw(opts.seed, iter, m.matchNumber);
      const aWins = u < m.pA;
      const nrrDelta = nrrDeltaForOutcome(masterRng);
      if (aWins) applyOutcome(work, m.ai, m.bi, nrrDelta);
      else applyOutcome(work, m.bi, m.ai, nrrDelta);
    }

    const ranks = rankWithTiebreakers(work, masterRng);
    const r0 = ranks[0];
    const r1 = ranks[1];
    const r2 = ranks[2];
    const r3 = ranks[3];
    if (r0 === undefined || r1 === undefined || r2 === undefined || r3 === undefined) continue;

    playoffCounts[r0] = (playoffCounts[r0] ?? 0) + 1;
    playoffCounts[r1] = (playoffCounts[r1] ?? 0) + 1;
    playoffCounts[r2] = (playoffCounts[r2] ?? 0) + 1;
    playoffCounts[r3] = (playoffCounts[r3] ?? 0) + 1;
    top2Counts[r0] = (top2Counts[r0] ?? 0) + 1;
    top2Counts[r1] = (top2Counts[r1] ?? 0) + 1;

    const { champion } = simulatePlayoffs([r0, r1, r2, r3], playoffWinProb, masterRng);
    championCounts[champion] = (championCounts[champion] ?? 0) + 1;

    // Accumulate means
    for (let i = 0; i < N; i++) {
      winsSum[i] = (winsSum[i] ?? 0) + (work.wins[i] ?? 0);
      nrrSum[i] = (nrrSum[i] ?? 0) + (work.nrr[i] ?? 0);
    }
  }

  const pPlayoffs = new Map<TeamCode, number>();
  const pTop2 = new Map<TeamCode, number>();
  const pChampion = new Map<TeamCode, number>();
  const meanWins = new Map<TeamCode, number>();
  const meanNrr = new Map<TeamCode, number>();
  for (let i = 0; i < N; i++) {
    const t = opts.teams[i];
    if (!t) continue;
    pPlayoffs.set(t, (playoffCounts[i] ?? 0) / iterations);
    pTop2.set(t, (top2Counts[i] ?? 0) / iterations);
    pChampion.set(t, (championCounts[i] ?? 0) / iterations);
    meanWins.set(t, (winsSum[i] ?? 0) / iterations);
    meanNrr.set(t, (nrrSum[i] ?? 0) / iterations);
  }

  return { pPlayoffs, pTop2, pChampion, meanWins, meanNrr, iterations, seed: opts.seed };
}

// --- CRN sub-stream draw ---
// Draws a uniform in [0,1) deterministically from (seed, iter, matchNumber). We construct
// a one-shot RNG state from a 3-way hash; small but adequate for one draw per call.
const KNUTH_HASH = 2654435761; // golden-ratio integer
function subStreamDraw(seed: string, iter: number, matchNumber: number): number {
  const [a] = hashSeed(seed);
  let h = a ^ Math.imul(iter + 1, KNUTH_HASH);
  h = Math.imul(h ^ matchNumber, 1597334677);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
