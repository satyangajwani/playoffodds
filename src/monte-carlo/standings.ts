// Mutable standings array, indexed by team-position in a fixed TEAMS ordering.
// Per perf review: use Float64Array/Uint32Array to avoid per-iteration object allocation.

import type { TeamCode } from "../domain/ids.ts";

export interface StandingsLayout {
  teams: TeamCode[]; // index → team code
  teamIndex: Map<TeamCode, number>; // team → index
}

export interface MutStandings {
  layout: StandingsLayout;
  points: Float64Array; // 2 * wins + 1 * no-result
  wins: Uint32Array;
  losses: Uint32Array;
  noResults: Uint32Array;
  nrr: Float64Array;
  // head-to-head wins: h2h[i*N + j] = wins of team i over team j (this season + sim)
  h2h: Uint16Array;
}

const N = 10;

export const newLayout = (teams: TeamCode[]): StandingsLayout => ({
  teams,
  teamIndex: new Map(teams.map((t, i) => [t, i])),
});

export const newStandings = (layout: StandingsLayout): MutStandings => ({
  layout,
  points: new Float64Array(N),
  wins: new Uint32Array(N),
  losses: new Uint32Array(N),
  noResults: new Uint32Array(N),
  nrr: new Float64Array(N),
  h2h: new Uint16Array(N * N),
});

export const copyInto = (dst: MutStandings, src: MutStandings): void => {
  dst.points.set(src.points);
  dst.wins.set(src.wins);
  dst.losses.set(src.losses);
  dst.noResults.set(src.noResults);
  dst.nrr.set(src.nrr);
  dst.h2h.set(src.h2h);
};

// Apply a single simulated match outcome: winner gains 2 points + 1 win, loser +1 loss.
// nrrDelta is in NRR units (small positive number); winner adds half, loser subtracts half.
// (NRR is league-wide aggregated, so this is an approximation — see nrr-perturb.ts.)
export const applyOutcome = (
  s: MutStandings,
  winnerIdx: number,
  loserIdx: number,
  nrrDelta: number,
): void => {
  s.points[winnerIdx] = (s.points[winnerIdx] ?? 0) + 2;
  s.wins[winnerIdx] = (s.wins[winnerIdx] ?? 0) + 1;
  s.losses[loserIdx] = (s.losses[loserIdx] ?? 0) + 1;
  s.nrr[winnerIdx] = (s.nrr[winnerIdx] ?? 0) + nrrDelta;
  s.nrr[loserIdx] = (s.nrr[loserIdx] ?? 0) - nrrDelta;
  s.h2h[winnerIdx * N + loserIdx] = (s.h2h[winnerIdx * N + loserIdx] ?? 0) + 1;
};

// Rank teams. Returns an array of team indices in descending order.
// Tiebreak order: points → wins → NRR → head-to-head among tied set → random (via rng).
export const rankWithTiebreakers = (s: MutStandings, rng: () => number): number[] => {
  const indices = Array.from({ length: N }, (_, i) => i);
  indices.sort((ai, bi) => {
    const dp = (s.points[bi] ?? 0) - (s.points[ai] ?? 0);
    if (dp !== 0) return dp;
    const dw = (s.wins[bi] ?? 0) - (s.wins[ai] ?? 0);
    if (dw !== 0) return dw;
    const dn = (s.nrr[bi] ?? 0) - (s.nrr[ai] ?? 0);
    if (dn !== 0) return dn;
    // Head-to-head: prefer team that beat the other more often this season
    const h2hAB = s.h2h[ai * N + bi] ?? 0;
    const h2hBA = s.h2h[bi * N + ai] ?? 0;
    if (h2hAB !== h2hBA) return h2hBA - h2hAB;
    // Final tiebreak: random (per IPL rules, ultimately a draw of lots)
    return rng() - 0.5;
  });
  return indices;
};

// Build a fresh standings instance from completed-game state (called once per simulation
// before applying remaining-game outcomes).
export const seedFromCompletedState = (
  layout: StandingsLayout,
  initial: Map<TeamCode, { wins: number; losses: number; noResults: number; nrr: number }>,
): MutStandings => {
  const s = newStandings(layout);
  for (const [code, init] of initial) {
    const i = layout.teamIndex.get(code);
    if (i === undefined) continue;
    s.wins[i] = init.wins;
    s.losses[i] = init.losses;
    s.noResults[i] = init.noResults;
    s.nrr[i] = init.nrr;
    s.points[i] = 2 * init.wins + init.noResults;
  }
  return s;
};
