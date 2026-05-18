import { config } from "../config.ts";
import { type ClientError, clientError } from "../shared/errors.ts";
import { type Result, err, ok } from "../shared/result.ts";

export type FetchJson = <T>(
  source: ClientError["source"],
  url: string,
  init?: RequestInit,
) => Promise<Result<T, ClientError>>;

export const fetchJson: FetchJson = async (source, url, init) => {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "User-Agent": config.USER_AGENT, ...(init?.headers ?? {}) },
    });
  } catch (e) {
    return err(clientError(source, "network", `fetch failed: ${(e as Error).message}`));
  }
  if (res.status === 429) {
    return err(clientError(source, "rate_limited", "HTTP 429", 429));
  }
  if (res.status === 404) {
    return err(clientError(source, "not_found", "HTTP 404", 404));
  }
  if (!res.ok) {
    return err(clientError(source, "unknown", `HTTP ${res.status}`, res.status));
  }
  try {
    return ok((await res.json()) as never);
  } catch (e) {
    return err(clientError(source, "schema_invalid", `JSON parse: ${(e as Error).message}`));
  }
};

// Vig check: in a binary YES/NO market, p(yes) + p(no) should ≈ 1.
// Returns the absolute deviation from 1; caller decides whether to normalize or warn.
export const vigDeviation = (a: number, b: number): number => Math.abs(a + b - 1);

// Normalize a YES/NO pair: clamp each to [0.005, 0.995] (defends against zero-priced markets)
// then rescale so they sum to 1.
export const normalizeBookSide = (yes: number, no: number): { yes: number; no: number } => {
  const c = (x: number) => Math.max(0.005, Math.min(0.995, x));
  const y = c(yes);
  const n = c(no);
  const total = y + n;
  return { yes: y / total, no: n / total };
};

// Mid from bid+ask. Falls back to last price if both sides empty.
export const midpoint = (
  bid: number | null,
  ask: number | null,
  last: number | null,
): number | null => {
  if (bid != null && ask != null && bid > 0 && ask > 0) return (bid + ask) / 2;
  if (last != null && last > 0) return last;
  return null;
};
