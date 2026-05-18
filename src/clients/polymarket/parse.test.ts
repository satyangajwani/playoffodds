import { describe, expect, it } from "vitest";
import { clobTokenIds, parseChampionSubMarket, parsePerMatchEvent } from "./parse.ts";

const rawPerMatchEvent = {
  id: "12345",
  slug: "cricipl-che-sun-2026-05-18",
  title: "Indian Premier League: Chennai Super Kings vs Sunrisers Hyderabad",
  startDate: "2026-05-18T14:00:00Z",
  endDate: "2026-05-18T22:00:00Z",
  markets: [
    {
      id: "678",
      slug: "cricipl-che-sun-2026-05-18",
      outcomes: ["Chennai Super Kings", "Sunrisers Hyderabad"],
      outcomePrices: ["0.48", "0.52"],
      closed: false,
      volume: "21500",
    },
  ],
};

const rawChampionSubMarket = {
  id: "1012319",
  slug: "will-royal-challengers-bengaluru-win-the-2026-indian-premier-league",
  question: "Will Royal Challengers Bengaluru win the 2026 Indian Premier League?",
  outcomes: ["Yes", "No"],
  outcomePrices: ["0.355", "0.645"],
  clobTokenIds: ["78489029316276", "61180451164714"],
  closed: false,
  volume: "78185.61",
};

describe("polymarket parse", () => {
  it("parses per-match event slug into team names + date", () => {
    const m = parsePerMatchEvent(rawPerMatchEvent);
    expect(m).not.toBeNull();
    if (!m) return;
    expect(m.teamARaw).toBe("Chennai Super Kings");
    expect(m.teamBRaw).toBe("Sunrisers Hyderabad");
    expect(m.dateUtc.startsWith("2026-05-18")).toBe(true);
    expect(m.outcomePriceA).toBeCloseTo(0.48, 4);
    expect(m.outcomePriceB).toBeCloseTo(0.52, 4);
  });

  it("returns null on unrelated slugs", () => {
    expect(parsePerMatchEvent({ ...rawPerMatchEvent, slug: "nba-finals-2026" })).toBeNull();
  });

  it("parses champion sub-market slug into team fragment", () => {
    const m = parseChampionSubMarket(rawChampionSubMarket);
    expect(m).not.toBeNull();
    expect(m?.teamCodeRaw).toBe("royal-challengers-bengaluru");
    expect(m?.yesPrice).toBeCloseTo(0.355, 4);
  });

  it("returns null on non-champion sub-market", () => {
    expect(
      parseChampionSubMarket({ ...rawChampionSubMarket, slug: "some-other-thing" }),
    ).toBeNull();
  });

  it("extracts CLOB token IDs from a sub-market", () => {
    const ids = clobTokenIds(rawChampionSubMarket);
    expect(ids).toEqual(["78489029316276", "61180451164714"]);
  });

  it("falls back to slug abbreviations when outcomes are Yes/No (binary markets)", () => {
    const yesNo = {
      ...rawPerMatchEvent,
      slug: "cricipl-che-sun-2026-05-18",
      markets: [
        {
          id: "999",
          slug: "cricipl-che-sun-2026-05-18",
          outcomes: ["Yes", "No"],
          outcomePrices: ["0.55", "0.45"],
          closed: false,
        },
      ],
    };
    const m = parsePerMatchEvent(yesNo);
    expect(m).not.toBeNull();
    expect(m?.teamARaw).toBe("che");
    expect(m?.teamBRaw).toBe("sun");
    expect(m?.outcomePriceA).toBeCloseTo(0.55, 4);
  });

  it("handles stringified arrays from gamma JSON quirks", () => {
    const m = parseChampionSubMarket({
      ...rawChampionSubMarket,
      outcomes: JSON.stringify(["Yes", "No"]),
      outcomePrices: JSON.stringify(["0.40", "0.60"]),
    });
    expect(m?.yesPrice).toBeCloseTo(0.4, 4);
  });
});
