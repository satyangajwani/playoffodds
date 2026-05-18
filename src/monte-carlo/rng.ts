// sfc32 — Small Fast Counter, 128-bit state. Per the deepening: mulberry32's 2^32 period
// is too tight at 25K × ~40 matches/sim × backfill ≈ 2M+ draws/run. sfc32 passes PractRand
// and BigCrush.
//
// Reference: https://github.com/bryc/code/blob/master/jshash/PRNGs.md
//
// Returns a [0, 1) double per call. Seed via four uint32s (or hashSeed below).

export type Rng = () => number;

export function sfc32(a: number, b: number, c: number, d: number): Rng {
  return () => {
    // biome-ignore lint/style/noParameterAssign: state mutation is the algorithm
    a |= 0;
    // biome-ignore lint/style/noParameterAssign: ditto
    b |= 0;
    // biome-ignore lint/style/noParameterAssign: ditto
    c |= 0;
    // biome-ignore lint/style/noParameterAssign: ditto
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    // biome-ignore lint/style/noParameterAssign: ditto
    d = (d + 1) | 0;
    // biome-ignore lint/style/noParameterAssign: ditto
    a = b ^ (b >>> 9);
    // biome-ignore lint/style/noParameterAssign: ditto
    b = (c + (c << 3)) | 0;
    // biome-ignore lint/style/noParameterAssign: ditto
    c = (c << 21) | (c >>> 11);
    // biome-ignore lint/style/noParameterAssign: ditto
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

// Cheap deterministic hash → 4 uint32s for seeding. Same string → same RNG state.
export function hashSeed(input: string): [number, number, number, number] {
  // FNV-1a → split into four 32-bit words via rotation
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = h >>> 0;
  const b = Math.imul(a, 2246822507) >>> 0;
  const c = Math.imul(b, 3266489917) >>> 0;
  const d = Math.imul(c, 668265263) >>> 0;
  return [a, b, c, d];
}

export const seededRng = (seed: string): Rng => {
  const [a, b, c, d] = hashSeed(seed);
  return sfc32(a, b, c, d);
};
