import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type TeamCode, teamCode } from "../domain/ids.ts";
import { type RemainingMatch, type SimulateOptions, simulate } from "./simulate.ts";
import { strengthWinProb, teamStrengths } from "./strength.ts";

const TEAMS: TeamCode[] = ["RCB", "GT", "SRH", "PBKS", "CSK", "RR", "DC", "KKR", "MI", "LSG"].map(
  (s) => teamCode(s) as TeamCode,
);

const baseInitial = new Map<
  TeamCode,
  { wins: number; losses: number; noResults: number; nrr: number }
>([
  [TEAMS[0]!, { wins: 9, losses: 4, noResults: 0, nrr: 1.065 }], // RCB
  [TEAMS[1]!, { wins: 8, losses: 5, noResults: 0, nrr: 0.4 }], // GT
  [TEAMS[2]!, { wins: 7, losses: 5, noResults: 0, nrr: 0.331 }], // SRH
  [TEAMS[3]!, { wins: 6, losses: 6, noResults: 1, nrr: 0.227 }], // PBKS
  [TEAMS[4]!, { wins: 6, losses: 6, noResults: 0, nrr: 0.027 }], // CSK
  [TEAMS[5]!, { wins: 6, losses: 6, noResults: 0, nrr: 0.027 }], // RR
  [TEAMS[6]!, { wins: 6, losses: 7, noResults: 0, nrr: -0.871 }], // DC
  [TEAMS[7]!, { wins: 5, losses: 6, noResults: 1, nrr: -0.038 }], // KKR
  [TEAMS[8]!, { wins: 4, losses: 8, noResults: 0, nrr: -0.504 }], // MI
  [TEAMS[9]!, { wins: 4, losses: 8, noResults: 0, nrr: -0.701 }], // LSG
]);

const remainingMay2026: RemainingMatch[] = [
  { matchNumber: 63, teamA: TEAMS[4]!, teamB: TEAMS[2]!, pA: 0.521 }, // CSK vs SRH
  { matchNumber: 64, teamA: TEAMS[5]!, teamB: TEAMS[9]!, pA: 0.44 }, // RR vs LSG
  { matchNumber: 65, teamA: TEAMS[7]!, teamB: TEAMS[8]!, pA: 0.61 }, // KKR vs MI
  { matchNumber: 66, teamA: TEAMS[4]!, teamB: TEAMS[1]!, pA: 0.405 }, // CSK vs GT
  { matchNumber: 67, teamA: TEAMS[0]!, teamB: TEAMS[2]!, pA: 0.535 }, // RCB vs SRH
  { matchNumber: 68, teamA: TEAMS[3]!, teamB: TEAMS[9]!, pA: 0.41 }, // PBKS vs LSG
  { matchNumber: 69, teamA: TEAMS[6]!, teamB: TEAMS[7]!, pA: 0.49 }, // DC vs KKR
  { matchNumber: 70, teamA: TEAMS[8]!, teamB: TEAMS[5]!, pA: 0.525 }, // MI vs RR
];

const baseOpts = (overrides: Partial<SimulateOptions> = {}): SimulateOptions => ({
  iterations: 5_000,
  seed: "test-seed",
  teams: TEAMS,
  initial: { byTeam: baseInitial },
  remaining: remainingMay2026,
  ...overrides,
});

describe("simulate", () => {
  it("is fully deterministic — same inputs produce byte-identical outputs", () => {
    const a = simulate(baseOpts());
    const b = simulate(baseOpts());
    for (const t of TEAMS) {
      expect(a.pPlayoffs.get(t)).toBe(b.pPlayoffs.get(t));
      expect(a.pTop2.get(t)).toBe(b.pTop2.get(t));
      expect(a.pChampion.get(t)).toBe(b.pChampion.get(t));
    }
  });

  it("respects probability invariants: ∈ [0,1] and p_top2 ≤ p_playoffs, p_champion ≤ p_playoffs", () => {
    // Important: p_champion is NOT bounded by p_top2 — a 3rd/4th seed can win via the
    // Eliminator → Q2 → Final path. The only structural bound is p_champion ≤ p_playoffs
    // (you can't win the championship without making the top 4).
    const r = simulate(baseOpts());
    for (const t of TEAMS) {
      const pl = r.pPlayoffs.get(t)!;
      const t2 = r.pTop2.get(t)!;
      const ch = r.pChampion.get(t)!;
      expect(pl).toBeGreaterThanOrEqual(0);
      expect(pl).toBeLessThanOrEqual(1);
      expect(t2).toBeLessThanOrEqual(pl + 1e-9);
      expect(ch).toBeLessThanOrEqual(pl + 1e-9);
    }
  });

  it("sums satisfy P(playoffs)≈4, P(top2)≈2, P(champion)≈1", () => {
    const r = simulate(baseOpts());
    let sP = 0;
    let sT = 0;
    let sC = 0;
    for (const t of TEAMS) {
      sP += r.pPlayoffs.get(t)!;
      sT += r.pTop2.get(t)!;
      sC += r.pChampion.get(t)!;
    }
    expect(sP).toBeCloseTo(4.0, 5);
    expect(sT).toBeCloseTo(2.0, 5);
    expect(sC).toBeCloseTo(1.0, 5);
  });

  it("RCB (1st place, 18pts, +1.065 NRR) makes playoffs with ≥99% probability", () => {
    const r = simulate(baseOpts());
    expect(r.pPlayoffs.get(TEAMS[0]!)!).toBeGreaterThan(0.99);
  });

  it("MI and LSG (8pts, badly negative NRR) make playoffs <5%", () => {
    const r = simulate(baseOpts());
    expect(r.pPlayoffs.get(TEAMS[8]!)!).toBeLessThan(0.05);
    expect(r.pPlayoffs.get(TEAMS[9]!)!).toBeLessThan(0.05);
  });

  it("changing one match's probability shifts probabilities monotonically (CRN)", () => {
    // If we bump RCB-vs-SRH (match 67) in RCB's favor, RCB's champion probability should
    // not decrease. With CRN, the noise from other matches is held constant.
    const lo = simulate({
      ...baseOpts(),
      remaining: remainingMay2026.map((m) => (m.matchNumber === 67 ? { ...m, pA: 0.2 } : m)),
    });
    const hi = simulate({
      ...baseOpts(),
      remaining: remainingMay2026.map((m) => (m.matchNumber === 67 ? { ...m, pA: 0.9 } : m)),
    });
    expect(hi.pChampion.get(TEAMS[0]!)!).toBeGreaterThanOrEqual(
      lo.pChampion.get(TEAMS[0]!)! - 0.02,
    );
    expect(hi.pPlayoffs.get(TEAMS[0]!)!).toBeGreaterThanOrEqual(
      lo.pPlayoffs.get(TEAMS[0]!)! - 0.02,
    );
  });

  it("property: every probability in [0,1] for arbitrary remaining-match probs", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0.05, max: 0.95, noNaN: true }), {
          minLength: remainingMay2026.length,
          maxLength: remainingMay2026.length,
        }),
        (probs) => {
          const remaining = remainingMay2026.map((m, i) => ({ ...m, pA: probs[i]! }));
          const r = simulate({ ...baseOpts(), iterations: 1500, remaining });
          for (const t of TEAMS) {
            const pl = r.pPlayoffs.get(t)!;
            const t2 = r.pTop2.get(t)!;
            const ch = r.pChampion.get(t)!;
            expect(pl).toBeGreaterThanOrEqual(0);
            expect(pl).toBeLessThanOrEqual(1);
            expect(t2).toBeLessThanOrEqual(pl + 1e-9);
            expect(ch).toBeLessThanOrEqual(pl + 1e-9);
          }
        },
      ),
      { numRuns: 8 },
    );
  });
});

describe("strength.teamStrengths + simulate playoffWinProb integration", () => {
  it("uses champion-market-derived strengths to differentiate playoff matchups", () => {
    // Champion odds: RCB 0.35, GT 0.24, SRH 0.20, PBKS 0.07, others tiny
    const champion = new Map<TeamCode, number>([
      [TEAMS[0]!, 0.35],
      [TEAMS[1]!, 0.24],
      [TEAMS[2]!, 0.2],
      [TEAMS[3]!, 0.07],
      [TEAMS[4]!, 0.06],
      [TEAMS[5]!, 0.05],
      [TEAMS[6]!, 0.01],
      [TEAMS[7]!, 0.01],
      [TEAMS[8]!, 0.005],
      [TEAMS[9]!, 0.005],
    ]);
    const strengths = teamStrengths(TEAMS, { perTeamProbs: new Map(), championAvgP: champion });
    const wp = strengthWinProb(strengths, TEAMS);
    // RCB (index 0) should be favoured over LSG (index 9) by a clear margin
    expect(wp(0, 9)).toBeGreaterThan(0.55);
    // Tight teams (RCB vs GT) should be close to 0.5 but RCB slightly ahead
    const rcbVsGt = wp(0, 1);
    expect(rcbVsGt).toBeGreaterThan(0.5);
    expect(rcbVsGt).toBeLessThan(0.6);
  });
});
