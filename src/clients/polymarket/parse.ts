import {
  isoUtc,
  polyEventSlug,
  polyTokenId,
  probability,
  type PolyTokenId,
} from "../../domain/ids.ts";
import type {
  PolyChampionMarket,
  PolyGameMarket,
} from "../../domain/types.ts";
import type { PolyEventRaw, PolyMarketRaw } from "./schema.ts";

// Per-match event slug: cricipl-<team3letter>-<team3letter>-YYYY-MM-DD
const PER_MATCH_RE = /^cricipl-([a-z]+)-([a-z]+)-(\d{4}-\d{2}-\d{2})$/;

// Champion sub-market slug: will-<team-kebab-case>-win-the-2026-indian-premier-league
const CHAMP_SLUG_RE = /^will-(.+)-win-the-2026-indian-premier-league$/;

const parseArrLike = <T>(x: T[] | string | undefined): T[] | undefined => {
  if (Array.isArray(x)) return x;
  if (typeof x !== "string") return undefined;
  try {
    const v = JSON.parse(x);
    return Array.isArray(v) ? (v as T[]) : undefined;
  } catch {
    return undefined;
  }
};

const probOrNull = (n: number | null) => {
  if (n === null || !Number.isFinite(n) || n < 0 || n > 1) return null;
  return probability(n);
};

// Convert a per-match event with its single (or paired) market.
export function parsePerMatchEvent(event: PolyEventRaw): PolyGameMarket | null {
  const m = event.slug.match(PER_MATCH_RE);
  if (!m) return null;
  const [, aRaw, bRaw, ymd] = m;
  if (!aRaw || !bRaw || !ymd) return null;

  // Per-match events have a single market with two outcomes
  const market = event.markets?.[0];
  if (!market) return null;
  const outcomes = parseArrLike<string>(market.outcomes);
  const prices = parseArrLike<string>(market.outcomePrices);
  if (!outcomes || outcomes.length !== 2) return null;
  if (!prices || prices.length !== 2) return null;

  const aPrice = Number(prices[0]);
  const bPrice = Number(prices[1]);

  // Outcomes contain full team names (e.g., "Chennai Super Kings", "Sunrisers Hyderabad")
  return {
    eventSlug: polyEventSlug(event.slug),
    dateUtc: isoUtc(`${ymd}T12:00:00Z`), // midday IST stand-in; matcher uses date only
    teamARaw: outcomes[0] ?? "",
    teamBRaw: outcomes[1] ?? "",
    outcomePriceA: probOrNull(aPrice),
    outcomePriceB: probOrNull(bPrice),
    resolved: market.closed === true,
    resolvedWinnerRaw: null,
    volumeUsd: market.volume != null ? Number(market.volume) : null,
  };
}

// Convert a single sub-market from the 2026-ipl-champion event into a champion record.
export function parseChampionSubMarket(market: PolyMarketRaw): PolyChampionMarket | null {
  const m = market.slug.match(CHAMP_SLUG_RE);
  if (!m) return null;
  const slugFragment = m[1];
  if (!slugFragment) return null;

  const prices = parseArrLike<string>(market.outcomePrices);
  if (!prices || prices.length < 1) return null;
  const yesPrice = Number(prices[0]);

  // teamCodeRaw is the slug fragment (e.g., "royal-challengers-bengaluru"). Matcher normalizes.
  return {
    eventSlug: polyEventSlug(market.slug),
    teamSlugRaw: market.slug,
    teamCodeRaw: slugFragment,
    yesPrice: probOrNull(yesPrice),
    resolved: market.closed === true,
    resolvedYes: market.closed === true ? yesPrice >= 0.99 : null,
    volumeUsd: market.volume != null ? Number(market.volume) : null,
  };
}

// Extract the two CLOB token IDs from a sub-market for live mid-price fetches (champion event)
export function clobTokenIds(market: PolyMarketRaw): [PolyTokenId, PolyTokenId] | null {
  const tokens = parseArrLike<string>(market.clobTokenIds);
  if (!tokens || tokens.length < 2) return null;
  const [a, b] = tokens;
  if (!a || !b) return null;
  return [polyTokenId(a), polyTokenId(b)];
}
