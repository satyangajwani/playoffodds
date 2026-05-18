import { describe, expect, it } from "vitest";
import { roundToSum } from "./normalize.ts";
import { wilsonCi } from "./wilson.ts";

describe("roundToSum (largest-remainder)", () => {
  it("preserves the sum exactly", () => {
    const m = new Map([
      ["a", 0.333],
      ["b", 0.333],
      ["c", 0.334],
    ]);
    const out = roundToSum(m, 1);
    let sum = 0;
    for (const v of out.values()) sum += v;
    expect(sum).toBeCloseTo(1.0, 6);
  });

  it("rounds to one decimal by default", () => {
    const m = new Map([
      ["a", 0.355],
      ["b", 0.239],
      ["c", 0.196],
      ["d", 0.066],
      ["e", 0.062],
      ["f", 0.057],
    ]);
    const out = roundToSum(m, 1);
    for (const v of out.values()) {
      // Check that v is rounded to 1 decimal
      expect(Math.round(v * 10) / 10).toBeCloseTo(v, 6);
    }
  });

  it("scales to a non-unit target sum (P(playoffs) = 4.0)", () => {
    const m = new Map([
      ["RCB", 0.95],
      ["GT", 0.72],
      ["SRH", 0.61],
      ["PBKS", 0.5],
      ["CSK", 0.45],
      ["RR", 0.32],
      ["DC", 0.28],
      ["KKR", 0.17],
      ["MI", 0.0],
      ["LSG", 0.0],
    ]);
    const out = roundToSum(m, 4.0);
    let sum = 0;
    for (const v of out.values()) sum += v;
    expect(sum).toBeCloseTo(4.0, 6);
  });

  it("preserves key order", () => {
    const m = new Map([
      ["b", 0.6],
      ["a", 0.4],
    ]);
    const out = roundToSum(m, 1);
    expect(Array.from(out.keys())).toEqual(["b", "a"]);
  });
});

describe("wilsonCi", () => {
  it("returns [0,0] for zero trials", () => {
    expect(wilsonCi(0, 0)).toEqual({ low: 0, high: 0 });
  });

  it("half-width at p=0.5, N=25000 is ~0.62pp (per plan)", () => {
    const ci = wilsonCi(12500, 25000);
    const halfWidth = (ci.high - ci.low) / 2;
    expect(halfWidth).toBeGreaterThan(0.005);
    expect(halfWidth).toBeLessThan(0.008);
  });

  it("never returns intervals outside [0,1]", () => {
    for (const { s, n } of [
      { s: 0, n: 100 },
      { s: 100, n: 100 },
      { s: 1, n: 25_000 },
    ]) {
      const ci = wilsonCi(s, n);
      expect(ci.low).toBeGreaterThanOrEqual(0);
      expect(ci.high).toBeLessThanOrEqual(1);
      expect(ci.high).toBeGreaterThanOrEqual(ci.low);
    }
  });

  it("is asymmetric near boundaries (sanity check)", () => {
    const ci = wilsonCi(2, 100);
    // At p=0.02, Wilson should be asymmetric (upper > 0.02 + (0.02 - lower))
    const upperDistance = ci.high - 0.02;
    const lowerDistance = 0.02 - ci.low;
    expect(upperDistance).toBeGreaterThan(lowerDistance);
  });
});
