import { describe, expect, it } from "vitest";
import { hashSeed, seededRng, sfc32 } from "./rng.ts";

describe("sfc32", () => {
  it("is deterministic for a given seed", () => {
    const r1 = sfc32(1, 2, 3, 4);
    const r2 = sfc32(1, 2, 3, 4);
    const seq1 = Array.from({ length: 50 }, () => r1());
    const seq2 = Array.from({ length: 50 }, () => r2());
    expect(seq1).toEqual(seq2);
  });

  it("produces values in [0, 1)", () => {
    const r = sfc32(42, 43, 44, 45);
    for (let i = 0; i < 10_000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("has a rough mean near 0.5 over 10k draws", () => {
    const r = sfc32(7, 11, 13, 17);
    let sum = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) sum += r();
    const mean = sum / N;
    expect(mean).toBeGreaterThan(0.49);
    expect(mean).toBeLessThan(0.51);
  });

  it("differs across distinct seeds", () => {
    const a = sfc32(1, 2, 3, 4);
    const b = sfc32(5, 6, 7, 8);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });
});

describe("seededRng + hashSeed", () => {
  it("same string seed → same sequence", () => {
    const a = seededRng("snapshot-123");
    const b = seededRng("snapshot-123");
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it("different string seeds → different sequences", () => {
    const a = seededRng("snapshot-A");
    const b = seededRng("snapshot-B");
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("hashSeed never returns zero state", () => {
    for (const s of ["", "a", "long-string-seed", "snapshot-id-with-uuid-019e..."]) {
      const [a, b, c, d] = hashSeed(s);
      expect(a | b | c | d).not.toBe(0);
    }
  });
});
