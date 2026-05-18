import {
  isoUtc,
  kalshiEventTicker,
  kalshiTicker,
  probability,
} from "../../domain/ids.ts";
import type {
  KalshiChampionMarket,
  KalshiGameMarket,
} from "../../domain/types.ts";
import { midpoint } from "../base.ts";
import type { KalshiMarketRaw } from "./schema.ts";

// Ticker grammar:
//   KXIPLGAME-<YY><MMM><DD><HHMM><AWAY><HOME>-<YES_TEAM>
// Example: KXIPLGAME-26MAY180600CSKSRH-CSK
// MMM is uppercase 3-letter month abbrev.
const GAME_TICKER_RE = /^KXIPLGAME-(\d{2})([A-Z]{3})(\d{2})(\d{4})([A-Z]+)-([A-Z]+)$/;
const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

// Champion ticker:
//   KXIPL-26-<TEAM>
const CHAMP_TICKER_RE = /^KXIPL-26-([A-Z]+)$/;

// Split AWAYHOME concatenation. Tries longest-prefix-first against known team codes;
// returns [away, home] or null if both halves can't be a valid code.
const KNOWN_KALSHI_CODES = ["CSK", "MI", "RCB", "RR", "KKR", "DC", "PBKS", "SRH", "GT", "LSG"];
const splitTeams = (combined: string): [string, string] | null => {
  for (const a of KNOWN_KALSHI_CODES) {
    if (combined.startsWith(a)) {
      const b = combined.slice(a.length);
      if (KNOWN_KALSHI_CODES.includes(b)) return [a, b];
    }
  }
  return null;
};

const probOrNull = (n: number | null): ReturnType<typeof probability> | null => {
  if (n === null || !Number.isFinite(n) || n < 0 || n > 1) return null;
  return probability(n);
};

export function parseGameMarket(raw: KalshiMarketRaw): KalshiGameMarket | null {
  const m = raw.ticker.match(GAME_TICKER_RE);
  if (!m) return null;
  const [, yy, mmm, dd, hhmm, combined, yesSide] = m;
  if (!yy || !mmm || !dd || !hhmm || !combined || !yesSide) return null;
  const split = splitTeams(combined);
  if (!split) return null;
  const [away, home] = split;
  if (yesSide !== away && yesSide !== home) return null;
  const paired = yesSide === away ? home : away;

  const year = 2000 + Number.parseInt(yy, 10);
  const month = MONTHS[mmm];
  if (month === undefined) return null;
  const day = Number.parseInt(dd, 10);
  const hh = Number.parseInt(hhmm.slice(0, 2), 10);
  const mm = Number.parseInt(hhmm.slice(2), 10);
  const startUtcMs = Date.UTC(year, month, day, hh, mm, 0);
  if (!Number.isFinite(startUtcMs)) return null;

  const yesBid = raw.yes_bid_dollars ?? null;
  const yesAsk = raw.yes_ask_dollars ?? null;
  const last = raw.last_price_dollars ?? null;
  const mid = midpoint(yesBid, yesAsk, last);

  const resolved = raw.status === "settled";
  const resolvedYes = resolved ? (raw.settlement_value ?? 0) >= 1 : null;

  return {
    ticker: kalshiTicker(raw.ticker),
    title: raw.title,
    status: raw.status,
    yesSideTeamCode: yesSide,
    pairedTeamCode: paired,
    startUtc: isoUtc(new Date(startUtcMs).toISOString()),
    yesBidDollars: yesBid,
    yesAskDollars: yesAsk,
    lastPriceDollars: last,
    midpoint: probOrNull(mid),
    volumeFp: raw.volume_fp ?? null,
    resolved,
    resolvedYes,
  };
}

export function parseChampionMarket(raw: KalshiMarketRaw): KalshiChampionMarket | null {
  const m = raw.ticker.match(CHAMP_TICKER_RE);
  if (!m) return null;
  const team = m[1];
  if (!team) return null;

  const mid = midpoint(
    raw.yes_bid_dollars ?? null,
    raw.yes_ask_dollars ?? null,
    raw.last_price_dollars ?? null,
  );
  const resolved = raw.status === "settled";
  const resolvedYes = resolved ? (raw.settlement_value ?? 0) >= 1 : null;

  return {
    eventTicker: kalshiEventTicker("KXIPL-26"),
    ticker: kalshiTicker(raw.ticker),
    teamCodeRaw: team,
    yesMidpoint: probOrNull(mid),
    resolved,
    resolvedYes,
  };
}
