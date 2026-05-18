import { describe, expect, it } from "vitest";
import {
  fixtureId,
  isoUtc,
  kalshiTicker,
  polyEventSlug,
  probability,
  teamCode,
} from "../domain/ids.ts";
import type { Fixture, KalshiGameMarket, PolyGameMarket } from "../domain/types.ts";
import { joinMarkets } from "./join.ts";

const fixtureCskSrh: Fixture = {
  matchNumber: fixtureId(67),
  dateUtc: isoUtc("2026-05-18T14:00:00Z"),
  venue: "Chennai",
  teamA: teamCode("CSK"),
  teamB: teamCode("SRH"),
  kalshiGameTicker: null,
  polyEventSlug: null,
  status: "scheduled",
  stage: "league",
};

const kalshi: KalshiGameMarket = {
  ticker: kalshiTicker("KXIPLGAME-26MAY181400CSKSRH-CSK"),
  title: "Chennai Super Kings vs Sunrisers Hyderabad Winner?",
  status: "open",
  yesSideTeamCode: "CSK",
  pairedTeamCode: "SRH",
  startUtc: isoUtc("2026-05-18T14:00:00Z"),
  yesBidDollars: 0.46,
  yesAskDollars: 0.5,
  lastPriceDollars: 0.48,
  midpoint: probability(0.48),
  volumeFp: null,
  resolved: false,
  resolvedYes: null,
};

const poly: PolyGameMarket = {
  eventSlug: polyEventSlug("cricipl-che-sun-2026-05-18"),
  dateUtc: isoUtc("2026-05-18T12:00:00Z"),
  teamARaw: "Chennai Super Kings",
  teamBRaw: "Sunrisers Hyderabad",
  outcomePriceA: probability(0.46),
  outcomePriceB: probability(0.54),
  resolved: false,
  resolvedWinnerRaw: null,
  volumeUsd: 21500,
};

describe("joinMarkets", () => {
  it("averages both sources when both present", () => {
    const out = joinMarkets({
      fixtures: [fixtureCskSrh],
      kalshiGames: [kalshi],
      polyGames: [poly],
      kalshiChampion: [],
      polyChampion: [],
    });
    expect(out.matchOdds).toHaveLength(1);
    const row = out.matchOdds[0];
    expect(row?.sourcesUsed).toBe("both");
    // CSK is the alphabetically-first code in (CSK, SRH), so pA = avg(kalshi YES on CSK, poly outcome A which is CSK)
    expect(row?.avgPa).toBeCloseTo(0.47, 4);
    expect(row?.avgPb).toBeCloseTo(0.53, 4);
    expect(row?.confidence).toBe("high");
    expect(row?.disagreementPp).toBeCloseTo(0.02, 4);
  });

  it("falls back to kalshi-only when polymarket missing", () => {
    const out = joinMarkets({
      fixtures: [fixtureCskSrh],
      kalshiGames: [kalshi],
      polyGames: [],
      kalshiChampion: [],
      polyChampion: [],
    });
    expect(out.matchOdds[0]?.sourcesUsed).toBe("kalshi-only");
    expect(out.matchOdds[0]?.confidence).toBe("medium");
  });

  it("falls back to 50/50 when neither source has data", () => {
    const out = joinMarkets({
      fixtures: [fixtureCskSrh],
      kalshiGames: [],
      polyGames: [],
      kalshiChampion: [],
      polyChampion: [],
    });
    expect(out.matchOdds[0]?.sourcesUsed).toBe("fallback-50-50");
    expect(out.matchOdds[0]?.confidence).toBe("low");
    expect(out.matchOdds[0]?.avgPa).toBeCloseTo(0.5, 4);
    expect(out.warnings.some((w) => w.code === "fallback_used")).toBe(true);
  });

  it("excludes completed fixtures from match_odds output", () => {
    const completed: Fixture = { ...fixtureCskSrh, status: "completed" };
    const out = joinMarkets({
      fixtures: [completed],
      kalshiGames: [kalshi],
      polyGames: [poly],
      kalshiChampion: [],
      polyChampion: [],
    });
    expect(out.matchOdds).toHaveLength(0);
  });

  it("flags source disagreement > 15pp as warning", () => {
    const wildPoly: PolyGameMarket = {
      ...poly,
      outcomePriceA: probability(0.22),
      outcomePriceB: probability(0.78),
    };
    const out = joinMarkets({
      fixtures: [fixtureCskSrh],
      kalshiGames: [kalshi],
      polyGames: [wildPoly],
      kalshiChampion: [],
      polyChampion: [],
    });
    expect(out.warnings.some((w) => w.code === "source_disagreement")).toBe(true);
  });
});
