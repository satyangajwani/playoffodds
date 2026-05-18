import { describe, expect, it } from "vitest";
import { parsePointsTable } from "./parse.ts";

// Synthetic __NEXT_DATA__-style payload — matches the shape our extractor walks.
const syntheticNextData = {
  props: {
    pageProps: {
      data: {
        pointsTable: [
          {
            team: { name: "Royal Challengers Bengaluru", abbreviation: "RCB" },
            matches: 13,
            won: 9,
            lost: 4,
            noResult: 0,
            points: 18,
            netRunRate: 1.065,
          },
          {
            team: { name: "Gujarat Titans", abbreviation: "GT" },
            matches: 13,
            won: 8,
            lost: 5,
            noResult: 0,
            points: 16,
            netRunRate: 0.4,
          },
          {
            team: { name: "Sunrisers Hyderabad", abbreviation: "SRH" },
            matches: 12,
            won: 7,
            lost: 5,
            noResult: 0,
            points: 14,
            netRunRate: 0.331,
          },
          {
            team: { name: "Punjab Kings", abbreviation: "PBKS" },
            matches: 13,
            won: 6,
            lost: 6,
            noResult: 1,
            points: 13,
            netRunRate: 0.227,
          },
          {
            team: { name: "Chennai Super Kings", abbreviation: "CSK" },
            matches: 12,
            won: 6,
            lost: 6,
            noResult: 0,
            points: 12,
            netRunRate: 0.027,
          },
          {
            team: { name: "Rajasthan Royals", abbreviation: "RR" },
            matches: 12,
            won: 6,
            lost: 6,
            noResult: 0,
            points: 12,
            netRunRate: 0.027,
          },
          {
            team: { name: "Delhi Capitals", abbreviation: "DC" },
            matches: 13,
            won: 6,
            lost: 7,
            noResult: 0,
            points: 12,
            netRunRate: -0.871,
          },
          {
            team: { name: "Kolkata Knight Riders", abbreviation: "KKR" },
            matches: 12,
            won: 5,
            lost: 6,
            noResult: 1,
            points: 11,
            netRunRate: -0.038,
          },
          {
            team: { name: "Mumbai Indians", abbreviation: "MI" },
            matches: 12,
            won: 4,
            lost: 8,
            noResult: 0,
            points: 8,
            netRunRate: -0.504,
          },
          {
            team: { name: "Lucknow Super Giants", abbreviation: "LSG" },
            matches: 12,
            won: 4,
            lost: 8,
            noResult: 0,
            points: 8,
            netRunRate: -0.701,
          },
        ],
      },
    },
  },
};

const wrap = (json: object): string =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(json)}</script></body></html>`;

describe("cricket parsePointsTable", () => {
  it("extracts 10 teams from __NEXT_DATA__", () => {
    const rows = parsePointsTable(wrap(syntheticNextData));
    expect(rows).toHaveLength(10);
    expect(rows?.[0]?.team).toBe("RCB");
    expect(rows?.[0]?.points).toBe(18);
    expect(rows?.[0]?.nrr).toBeCloseTo(1.065, 3);
    expect(rows?.find((r) => r.team === "MI")?.played).toBe(12);
  });

  it("returns null when the page isn't parseable", () => {
    expect(parsePointsTable("<html>no next data here</html>")).toBeNull();
  });

  it("returns null when fewer than 10 teams are present", () => {
    const partial = {
      ...syntheticNextData,
      props: {
        pageProps: {
          data: { pointsTable: syntheticNextData.props.pageProps.data.pointsTable.slice(0, 5) },
        },
      },
    };
    expect(parsePointsTable(wrap(partial))).toBeNull();
  });
});
