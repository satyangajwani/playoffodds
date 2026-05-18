import { describe, expect, it } from "vitest";
import { simulatePlayoffs } from "./playoffs.ts";
import { seededRng } from "./rng.ts";

describe("simulatePlayoffs", () => {
  it("with a dominant seed1, seed1 wins championship ≥75% of trials", () => {
    // Strength model: seed1 always 80%, others 50% vs each other
    const winProb = (a: number, b: number) => (a === 0 || b === 0 ? (a === 0 ? 0.8 : 0.2) : 0.5);
    const rng = seededRng("test");
    let s1Wins = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const r = simulatePlayoffs([0, 1, 2, 3], winProb, rng);
      if (r.champion === 0) s1Wins++;
    }
    expect(s1Wins / N).toBeGreaterThan(0.75);
  });

  it("all teams 50/50 → seeds 1-2 win ~37.5%, seeds 3-4 win ~12.5% (Q1-advantage structural)", () => {
    // Bracket math at 50/50:
    //   seed1: P(direct to Final) = 0.5 → 0.5 win = 0.25, plus P(Q2 path) = 0.5*0.5*0.5 = 0.125
    //   → 0.375. Symmetric for seed2.
    //   seeds 3-4 only reach final via the Eliminator → Q2 path: 0.5 * 0.5 * 0.5 = 0.125
    const winProb = () => 0.5;
    const rng = seededRng("test");
    const counts = new Array(4).fill(0);
    const N = 8000;
    for (let i = 0; i < N; i++) {
      const r = simulatePlayoffs([0, 1, 2, 3], winProb, rng);
      counts[r.champion]++;
    }
    expect(counts[0]! / N).toBeGreaterThan(0.33);
    expect(counts[0]! / N).toBeLessThan(0.42);
    expect(counts[1]! / N).toBeGreaterThan(0.33);
    expect(counts[1]! / N).toBeLessThan(0.42);
    expect(counts[2]! / N).toBeGreaterThan(0.09);
    expect(counts[2]! / N).toBeLessThan(0.16);
    expect(counts[3]! / N).toBeGreaterThan(0.09);
    expect(counts[3]! / N).toBeLessThan(0.16);
  });

  it("is deterministic given a seeded RNG", () => {
    const winProb = (a: number, b: number) => 0.4 + (a - b) * 0.05;
    const r1 = seededRng("seed-A");
    const r2 = seededRng("seed-A");
    const a = Array.from({ length: 100 }, () => simulatePlayoffs([0, 1, 2, 3], winProb, r1));
    const b = Array.from({ length: 100 }, () => simulatePlayoffs([0, 1, 2, 3], winProb, r2));
    expect(a).toEqual(b);
  });
});
