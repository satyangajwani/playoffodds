// Lightweight team-strength model for PLAYOFF matches (where the matchup is unknown until
// the bracket resolves). Per the resolved decision (#3), the full Bradley-Terry fit is cut
// for v1; this stub derives strength from per-match remaining-game probabilities + champion-
// market odds as a sanity backstop.
//
// For v2, replace with proper Bradley-Terry fit over completed + remaining games.

import type { TeamCode } from "../domain/ids.ts";
import type { WinProb } from "./playoffs.ts";

interface StrengthInputs {
  // For each team: list of (this season's per-match win probabilities) where they appeared.
  perTeamProbs: Map<TeamCode, number[]>;
  // Direct champion-market avg_p as a sanity anchor (sums to ~1 across teams).
  championAvgP?: Map<TeamCode, number>;
}

// Strength estimate: mean of per-team win probabilities blended with a champion-market
// signal. Champion price already lives on [0,1]; we use it directly (NOT cube-rooted) so
// stronger teams keep a clear edge. Strengths are unscaled; only their ratio matters for
// Bradley-Terry pairwise probabilities.
const clip = (x: number, lo = 0.05, hi = 0.95) => Math.max(lo, Math.min(hi, x));

export function teamStrengths(
  teams: readonly TeamCode[],
  inputs: StrengthInputs,
): Map<TeamCode, number> {
  const out = new Map<TeamCode, number>();
  for (const t of teams) {
    const probs = inputs.perTeamProbs.get(t) ?? [];
    const seasonMean = probs.length ? probs.reduce((s, x) => s + x, 0) / probs.length : 0.5;
    const champP = inputs.championAvgP?.get(t);
    // If champion price is available, weight it more heavily (it's the market's all-in view).
    // Otherwise fall back to season per-match mean.
    const championDerived = champP !== undefined && champP > 0 ? champP : seasonMean;
    out.set(t, clip(0.4 * seasonMean + 0.6 * championDerived));
  }
  return out;
}

export function strengthWinProb(
  strengths: Map<TeamCode, number>,
  teams: readonly TeamCode[],
): WinProb {
  return (ai: number, bi: number): number => {
    const ta = teams[ai];
    const tb = teams[bi];
    if (!ta || !tb) return 0.5;
    const sA = strengths.get(ta) ?? 0.5;
    const sB = strengths.get(tb) ?? 0.5;
    // Bradley-Terry-style: P(A wins) = s_A / (s_A + s_B)
    return sA / (sA + sB);
  };
}
