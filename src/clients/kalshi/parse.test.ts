import { describe, expect, it } from "vitest";
import { parseChampionMarket, parseGameMarket } from "./parse.ts";

const rawGame = {
  ticker: "KXIPLGAME-26MAY180600CSKSRH-CSK",
  title: "Chennai Super Kings vs Sunrisers Hyderabad Winner?",
  status: "open" as const,
  yes_bid_dollars: 0.42,
  yes_ask_dollars: 0.46,
  last_price_dollars: 0.44,
  volume_fp: 12345.6,
};

const rawChampion = {
  ticker: "KXIPL-26-RCB",
  event_ticker: "KXIPL-26",
  title: "Will Royal Challengers Bengaluru win the IPL?",
  status: "open" as const,
  yes_bid_dollars: 0.34,
  yes_ask_dollars: 0.37,
  last_price_dollars: 0.355,
};

describe("kalshi parse", () => {
  it("parses a game market ticker into teams + UTC start", () => {
    const m = parseGameMarket(rawGame);
    expect(m).not.toBeNull();
    if (!m) return;
    expect(m.yesSideTeamCode).toBe("CSK");
    expect(m.pairedTeamCode).toBe("SRH");
    expect(m.startUtc).toBe("2026-05-18T06:00:00.000Z");
    expect(m.midpoint).toBeCloseTo(0.44, 4);
    expect(m.resolved).toBe(false);
  });

  it("returns null on non-IPL tickers", () => {
    expect(parseGameMarket({ ...rawGame, ticker: "KXNFLGAME-26..." })).toBeNull();
    expect(parseGameMarket({ ...rawGame, ticker: "KXIPLGAME-MALFORMED" })).toBeNull();
  });

  it("uses last_price when bid/ask absent", () => {
    const m = parseGameMarket({ ...rawGame, yes_bid_dollars: null, yes_ask_dollars: null });
    expect(m?.midpoint).toBeCloseTo(0.44, 4);
  });

  it("marks settled markets resolved", () => {
    const m = parseGameMarket({ ...rawGame, status: "settled", settlement_value: 1 });
    expect(m?.resolved).toBe(true);
    expect(m?.resolvedYes).toBe(true);
  });

  it("parses a champion ticker", () => {
    const m = parseChampionMarket(rawChampion);
    expect(m?.teamCodeRaw).toBe("RCB");
    expect(m?.yesMidpoint).toBeCloseTo(0.355, 4);
  });

  it("returns null on non-champion tickers", () => {
    expect(parseChampionMarket({ ...rawChampion, ticker: "KXIPLGAME-..." })).toBeNull();
  });
});
