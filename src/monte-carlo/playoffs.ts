// Simulate the 4-team IPL playoff bracket:
//   Q1:         seed1 vs seed2 → winner direct to Final, loser to Q2
//   Eliminator: seed3 vs seed4 → loser eliminated, winner to Q2
//   Q2:         Q1-loser vs Eliminator-winner → winner to Final
//   Final:      Q1-winner vs Q2-winner → champion

import type { Rng } from "./rng.ts";

export interface PlayoffResult {
  finalists: [number, number]; // team indices
  champion: number;
}

// `winProb(a, b)` returns P(team a beats team b). Sourced from a strength model that's
// caller-supplied so we can swap in BT/Elo in v2.
export type WinProb = (a: number, b: number) => number;

const sample = (pA: number, rng: Rng, a: number, b: number): [winner: number, loser: number] =>
  rng() < pA ? [a, b] : [b, a];

export function simulatePlayoffs(
  seeds: readonly [number, number, number, number],
  winProb: WinProb,
  rng: Rng,
): PlayoffResult {
  const [s1, s2, s3, s4] = seeds;

  // Qualifier 1
  const [q1Winner, q1Loser] = sample(winProb(s1, s2), rng, s1, s2);
  // Eliminator
  const [elimWinner] = sample(winProb(s3, s4), rng, s3, s4);
  // Qualifier 2
  const [q2Winner] = sample(winProb(q1Loser, elimWinner), rng, q1Loser, elimWinner);
  // Final
  const [champion] = sample(winProb(q1Winner, q2Winner), rng, q1Winner, q2Winner);

  return { finalists: [q1Winner, q2Winner], champion };
}
