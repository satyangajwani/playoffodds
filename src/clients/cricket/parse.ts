import type { StandingRow } from "../../domain/types.ts";
import { teamCode } from "../../domain/ids.ts";

// Minimal cricinfo points-table extractor. Cricinfo embeds a Next.js __NEXT_DATA__
// JSON blob in the page that's much more stable than the rendered DOM. We try that first;
// fall back to a regex over the HTML if the JSON shape changes.

interface NextDataRow {
  team?: { name?: string; abbreviation?: string };
  matches?: number;
  won?: number;
  lost?: number;
  noResult?: number;
  points?: number;
  netRunRate?: number;
}

const TEAM_NAME_TO_CODE: Record<string, string> = {
  "Mumbai Indians": "MI",
  "Chennai Super Kings": "CSK",
  "Royal Challengers Bengaluru": "RCB",
  "Royal Challengers Bangalore": "RCB",
  "Kolkata Knight Riders": "KKR",
  "Delhi Capitals": "DC",
  "Punjab Kings": "PBKS",
  "Rajasthan Royals": "RR",
  "Sunrisers Hyderabad": "SRH",
  "Gujarat Titans": "GT",
  "Lucknow Super Giants": "LSG",
};

const ABBR_TO_CODE: Record<string, string> = {
  MI: "MI", CSK: "CSK", RCB: "RCB", KKR: "KKR", DC: "DC",
  PBKS: "PBKS", RR: "RR", SRH: "SRH", GT: "GT", LSG: "LSG",
  // Sometimes cricinfo uses BLR for Bangalore/Bengaluru and PK for Punjab Kings
  BLR: "RCB", PK: "PBKS",
};

const codeFor = (name: string | undefined, abbr: string | undefined): string | null => {
  if (abbr && ABBR_TO_CODE[abbr.toUpperCase()]) return ABBR_TO_CODE[abbr.toUpperCase()] ?? null;
  if (name && TEAM_NAME_TO_CODE[name]) return TEAM_NAME_TO_CODE[name] ?? null;
  return null;
};

export function parsePointsTable(html: string): StandingRow[] | null {
  const standings = tryNextDataExtract(html);
  if (standings) return standings;
  return tryRegexFallback(html);
}

function tryNextDataExtract(html: string): StandingRow[] | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m || !m[1]) return null;
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const rows = findPointsArray(data);
  if (!rows) return null;

  const out: StandingRow[] = [];
  for (const r of rows) {
    const code = codeFor(r.team?.name, r.team?.abbreviation);
    if (!code) continue;
    out.push({
      team: teamCode(code),
      played: r.matches ?? 0,
      wins: r.won ?? 0,
      losses: r.lost ?? 0,
      noResults: r.noResult ?? 0,
      points: r.points ?? 0,
      nrr: r.netRunRate ?? 0,
    });
  }
  return out.length === 10 ? out : null;
}

// Walk an object tree looking for an array of points-table rows.
function findPointsArray(node: unknown, depth = 0): NextDataRow[] | null {
  if (depth > 12 || node === null) return null;
  if (Array.isArray(node)) {
    if (
      node.length >= 8 &&
      node.length <= 12 &&
      node.every(
        (x) =>
          typeof x === "object" &&
          x !== null &&
          ("netRunRate" in x || "points" in x) &&
          "team" in x,
      )
    ) {
      return node as NextDataRow[];
    }
    for (const child of node) {
      const r = findPointsArray(child, depth + 1);
      if (r) return r;
    }
  } else if (typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      const r = findPointsArray(v, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

// Crude fallback: scan the rendered HTML for team rows. Won't be precise — used to confirm
// cricinfo is at least serving content. Returns null if it can't find 10 teams.
function tryRegexFallback(html: string): StandingRow[] | null {
  const teams = Object.keys(TEAM_NAME_TO_CODE);
  const hits = teams.filter((t) => html.includes(t));
  if (hits.length < 8) return null;
  return null; // signal "served but unparseable" rather than fabricating numbers
}
