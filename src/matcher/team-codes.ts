import { teamCode, type TeamCode } from "../domain/ids.ts";

// Single source of truth for team identity across venues.
// Per pattern-recognition reviewer: a hand-written table beats fuzzy matching for 10 teams.

export interface TeamRecord {
  code: TeamCode;
  fullName: string;
  shortName: string;
  primaryColorHex: string;
  kalshiCode: string;
  // Polymarket uses both 3-letter slug codes (in event slugs like 'cricipl-che-sun-...')
  // AND kebab-cased full names (in champion sub-market slugs).
  polyShortCodes: string[]; // 3-letter venue codes used in per-match slugs
  polyFullSlugFragments: string[]; // kebab-case fragments used in champion sub-market slugs
}

export const TEAMS: TeamRecord[] = [
  {
    code: teamCode("MI"),
    fullName: "Mumbai Indians",
    shortName: "Mumbai",
    primaryColorHex: "#004BA0",
    kalshiCode: "MI",
    polyShortCodes: ["mum", "mi"],
    polyFullSlugFragments: ["mumbai-indians"],
  },
  {
    code: teamCode("CSK"),
    fullName: "Chennai Super Kings",
    shortName: "Chennai",
    primaryColorHex: "#FBBF24",
    kalshiCode: "CSK",
    polyShortCodes: ["che", "csk"],
    polyFullSlugFragments: ["chennai-super-kings"],
  },
  {
    code: teamCode("RCB"),
    fullName: "Royal Challengers Bengaluru",
    shortName: "Bengaluru",
    primaryColorHex: "#DA1818",
    kalshiCode: "RCB",
    polyShortCodes: ["ben", "rcb", "blr"],
    polyFullSlugFragments: [
      "royal-challengers-bengaluru",
      "royal-challengers-bangalore",
    ],
  },
  {
    code: teamCode("KKR"),
    fullName: "Kolkata Knight Riders",
    shortName: "Kolkata",
    primaryColorHex: "#3A225D",
    kalshiCode: "KKR",
    polyShortCodes: ["kol", "kkr"],
    polyFullSlugFragments: ["kolkata-knight-riders"],
  },
  {
    code: teamCode("DC"),
    fullName: "Delhi Capitals",
    shortName: "Delhi",
    primaryColorHex: "#17449B",
    kalshiCode: "DC",
    polyShortCodes: ["del", "dc"],
    polyFullSlugFragments: ["delhi-capitals"],
  },
  {
    code: teamCode("PBKS"),
    fullName: "Punjab Kings",
    shortName: "Punjab",
    primaryColorHex: "#DD1F2D",
    kalshiCode: "PBKS",
    polyShortCodes: ["pun", "pbks", "pk"],
    polyFullSlugFragments: ["punjab-kings"],
  },
  {
    code: teamCode("RR"),
    fullName: "Rajasthan Royals",
    shortName: "Rajasthan",
    primaryColorHex: "#EA1A85",
    kalshiCode: "RR",
    polyShortCodes: ["raj", "rr"],
    polyFullSlugFragments: ["rajasthan-royals"],
  },
  {
    code: teamCode("SRH"),
    fullName: "Sunrisers Hyderabad",
    shortName: "Hyderabad",
    primaryColorHex: "#FF822A",
    kalshiCode: "SRH",
    polyShortCodes: ["hyd", "sun", "srh"],
    polyFullSlugFragments: ["sunrisers-hyderabad"],
  },
  {
    code: teamCode("GT"),
    fullName: "Gujarat Titans",
    shortName: "Gujarat",
    primaryColorHex: "#1C2C4D",
    kalshiCode: "GT",
    polyShortCodes: ["guj", "gt"],
    polyFullSlugFragments: ["gujarat-titans"],
  },
  {
    code: teamCode("LSG"),
    fullName: "Lucknow Super Giants",
    shortName: "Lucknow",
    primaryColorHex: "#00B5D8",
    kalshiCode: "LSG",
    polyShortCodes: ["luc", "lsg"],
    polyFullSlugFragments: ["lucknow-super-giants"],
  },
];

const BY_KALSHI = new Map(TEAMS.map((t) => [t.kalshiCode.toUpperCase(), t.code] as const));
const BY_POLY_SHORT = new Map<string, TeamCode>();
const BY_POLY_FULL_FRAG = new Map<string, TeamCode>();
for (const t of TEAMS) {
  for (const s of t.polyShortCodes) BY_POLY_SHORT.set(s.toLowerCase(), t.code);
  for (const f of t.polyFullSlugFragments) BY_POLY_FULL_FRAG.set(f.toLowerCase(), t.code);
}

export const kalshiCodeToTeam = (raw: string): TeamCode | null =>
  BY_KALSHI.get(raw.toUpperCase()) ?? null;

export const polyShortToTeam = (raw: string): TeamCode | null =>
  BY_POLY_SHORT.get(raw.toLowerCase()) ?? null;

export const polyFullSlugFragmentToTeam = (raw: string): TeamCode | null =>
  BY_POLY_FULL_FRAG.get(raw.toLowerCase()) ?? null;

// "Chennai Super Kings" (Polymarket's per-match outcomes array) → TeamCode
const BY_FULL_NAME = new Map(TEAMS.map((t) => [t.fullName.toLowerCase(), t.code] as const));
// Also accept the older "Bangalore" spelling
BY_FULL_NAME.set("royal challengers bangalore", teamCode("RCB"));
export const fullNameToTeam = (raw: string): TeamCode | null =>
  BY_FULL_NAME.get(raw.toLowerCase().trim()) ?? null;
