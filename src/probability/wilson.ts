// Wilson score confidence interval for a binomial proportion. Used by the view layer
// to display ±error bars. Closed-form, no extra cost.
// https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval#Wilson_score_interval

const Z_95 = 1.959964; // 1.96 to 6sf

export interface WilsonInterval {
  low: number;
  high: number;
}

export function wilsonCi(successes: number, trials: number, z: number = Z_95): WilsonInterval {
  if (trials <= 0) return { low: 0, high: 0 };
  const p = successes / trials;
  const z2 = z * z;
  const denom = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials));
  return {
    low: Math.max(0, (centre - margin) / denom),
    high: Math.min(1, (centre + margin) / denom),
  };
}

export function wilsonCiFromP(p: number, trials: number, z: number = Z_95): WilsonInterval {
  return wilsonCi(Math.round(p * trials), trials, z);
}
