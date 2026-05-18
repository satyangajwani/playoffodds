// Per-match NRR perturbation. The resolved decision (#5) was "bootstrap from this season's
// observed margins". For v1 we don't yet have completed-match margins loaded into the DB,
// so we use a parameterized random delta calibrated to the empirical IPL distribution of
// per-match NRR shifts: roughly Normal(mean = ±0.06, std = 0.08), clamped.
//
// v2 should replace `nrrDeltaForOutcome` with a bootstrap that samples a real (winner_runs,
// winner_overs, loser_runs, loser_overs) tuple from completed games and computes the actual
// NRR shift via standard formula.

import type { Rng } from "./rng.ts";

// Box-Muller normal sampler.
const sampleNormal = (rng: Rng): number => {
  // Two independent uniforms → one normal draw (Box-Muller). We waste the second.
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const NRR_MEAN = 0.06;
const NRR_STD = 0.08;
const NRR_CLAMP = 0.4;

export function nrrDeltaForOutcome(rng: Rng): number {
  const z = sampleNormal(rng);
  const raw = NRR_MEAN + NRR_STD * z;
  return Math.max(-NRR_CLAMP, Math.min(NRR_CLAMP, Math.abs(raw))); // always positive (sign applied by caller)
}
