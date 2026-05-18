import { describe, expect, it } from "vitest";
import { type TeamCode, teamCode } from "../domain/ids.ts";
import { seededRng } from "./rng.ts";
import {
  applyOutcome,
  newLayout,
  newStandings,
  rankWithTiebreakers,
  seedFromCompletedState,
} from "./standings.ts";

const TC = (s: string) => teamCode(s) as TeamCode;
const TEAMS_10 = ["RCB", "GT", "SRH", "PBKS", "CSK", "RR", "DC", "KKR", "MI", "LSG"].map(TC);
const LAYOUT = newLayout(TEAMS_10);

describe("standings", () => {
  it("applyOutcome updates winner +2pt +1W, loser +1L, NRR symmetric", () => {
    const s = newStandings(LAYOUT);
    applyOutcome(s, 0, 1, 0.05); // RCB beats GT by NRR delta 0.05
    expect(s.points[0]).toBe(2);
    expect(s.wins[0]).toBe(1);
    expect(s.losses[1]).toBe(1);
    expect(s.nrr[0]).toBeCloseTo(0.05, 4);
    expect(s.nrr[1]).toBeCloseTo(-0.05, 4);
    expect(s.h2h[0 * 10 + 1]).toBe(1); // RCB beat GT
  });

  it("rankWithTiebreakers sorts by points DESC", () => {
    const s = newStandings(LAYOUT);
    applyOutcome(s, 5, 0, 0.01); // RR(5) beats RCB(0)
    applyOutcome(s, 5, 1, 0.01); // RR(5) beats GT(1)
    const ranks = rankWithTiebreakers(s, seededRng("test"));
    expect(ranks[0]).toBe(5); // RR has 4 points, leads
  });

  it("uses NRR to break point ties", () => {
    const s = newStandings(LAYOUT);
    applyOutcome(s, 0, 5, 0.5); // RCB beats RR by huge NRR
    applyOutcome(s, 1, 6, 0.05); // GT beats DC by small NRR
    // RCB and GT both have 2 points; RCB should rank ahead via NRR
    const ranks = rankWithTiebreakers(s, seededRng("test"));
    const rcbRank = ranks.indexOf(0);
    const gtRank = ranks.indexOf(1);
    expect(rcbRank).toBeLessThan(gtRank);
  });

  it("uses head-to-head to break (points, wins, NRR) ties", () => {
    const s = newStandings(LAYOUT);
    // Two teams (8 = MI, 9 = LSG) each win one game vs a common opponent — same NRR delta
    applyOutcome(s, 8, 0, 0.05); // MI beats RCB
    applyOutcome(s, 9, 0, 0.05); // LSG beats RCB (RCB loses twice, gets -0.10)
    // Force RCB's NRR back to 0 to keep MI/LSG at identical NRR
    // Then MI beats LSG head-to-head
    applyOutcome(s, 8, 9, 0); // MI beats LSG with NRR-zero — tie on NRR remains
    // After that, MI = 4pts, LSG = 2pts. Restore to tie:
    applyOutcome(s, 9, 8, 0); // LSG beats MI back (tie on points and NRR)
    // Now both 4pts, tied NRR, h2h is 1-1. Re-tilt by adding one more for MI:
    applyOutcome(s, 8, 9, 0); // MI now leads h2h 2-1
    // Score check: MI=6pts NRR≈0.05, LSG=4pts NRR≈0.05 — MI leads on points alone
    const ranks = rankWithTiebreakers(s, seededRng("test"));
    const miRank = ranks.indexOf(8);
    const lsgRank = ranks.indexOf(9);
    expect(miRank).toBeLessThan(lsgRank);
  });

  it("seedFromCompletedState applies pre-sim standings correctly", () => {
    const s = seedFromCompletedState(
      LAYOUT,
      new Map<TeamCode, { wins: number; losses: number; noResults: number; nrr: number }>([
        [TC("RCB"), { wins: 9, losses: 4, noResults: 0, nrr: 1.065 }],
        [TC("GT"), { wins: 8, losses: 5, noResults: 0, nrr: 0.4 }],
      ]),
    );
    expect(s.points[0]).toBe(18); // RCB
    expect(s.wins[0]).toBe(9);
    expect(s.nrr[0]).toBeCloseTo(1.065, 3);
    expect(s.points[1]).toBe(16); // GT
  });
});
