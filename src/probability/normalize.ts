// Display-rounding utilities. The simulator outputs raw [0,1] probabilities that may not
// sum exactly to the target (4.0 for P(playoffs), 2.0 for P(top2), 1.0 for P(champion)).
// We round to 1 decimal (matching the cricbuzz-style display) then apply largest-remainder
// to enforce the sum invariant.

export interface RoundedEntry<K> {
  key: K;
  value: number; // already rounded to 1 decimal
}

// Largest-remainder rounding of `entries` to 1 decimal so they sum to `targetSum`.
// Order of input is preserved in the output.
export function roundToSum<K>(
  entries: Map<K, number>,
  targetSum: number,
  decimals = 1,
): Map<K, number> {
  const factor = 10 ** decimals;
  const targetUnits = Math.round(targetSum * factor);
  const items = Array.from(entries.entries()).map(([k, v]) => {
    const scaled = v * factor;
    const floor = Math.floor(scaled);
    return { k, scaled, floor, remainder: scaled - floor };
  });
  const assignedSum = items.reduce((s, it) => s + it.floor, 0);
  let deficit = targetUnits - assignedSum;
  // Sort by remainder descending so the largest fractional parts get the +1 rounding bump.
  // Use an index alongside to preserve key order in the output map.
  const remainderOf = (i: number) => items[i]?.remainder ?? 0;
  const indices = items.map((_, i) => i).sort((a, b) => remainderOf(b) - remainderOf(a));
  const bumps = new Set<number>();
  for (let i = 0; i < indices.length && deficit > 0; i++) {
    const idx = indices[i];
    if (idx === undefined) break;
    bumps.add(idx);
    deficit--;
  }
  // If we somehow over-allocated (deficit < 0), subtract from the smallest remainders.
  const negIndices = items.map((_, i) => i).sort((a, b) => remainderOf(a) - remainderOf(b));
  const subtracts = new Set<number>();
  for (let i = 0; i < negIndices.length && deficit < 0; i++) {
    const idx = negIndices[i];
    if (idx === undefined) break;
    subtracts.add(idx);
    deficit++;
  }

  const out = new Map<K, number>();
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const adj = (bumps.has(i) ? 1 : 0) - (subtracts.has(i) ? 1 : 0);
    out.set(it.k, (it.floor + adj) / factor);
  }
  return out;
}
