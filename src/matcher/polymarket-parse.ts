import type { PolyGameMarket } from "../domain/types.ts";
import type { CanonicalKey } from "./kalshi-parse.ts";
import { pairKey } from "./kalshi-parse.ts";
import { fullNameToTeam, polyShortToTeam } from "./team-codes.ts";

// Polymarket per-match raw teams come either as full names ("Rajasthan Royals")
// or as slug abbreviations ("raj", "che") depending on whether the event has
// team-name outcomes or Yes/No outcomes. We try full names first, then short codes.
const SLUG_DATE_RE = /(\d{4}-\d{2}-\d{2})$/;

const teamFromRaw = (raw: string) => fullNameToTeam(raw) ?? polyShortToTeam(raw);

export function polyGameToKey(m: PolyGameMarket): CanonicalKey | null {
  const dateMatch = m.eventSlug.match(SLUG_DATE_RE);
  if (!dateMatch || !dateMatch[1]) return null;
  const teamA = teamFromRaw(m.teamARaw);
  const teamB = teamFromRaw(m.teamBRaw);
  if (!teamA || !teamB) return null;
  return {
    date: dateMatch[1],
    pair: pairKey(teamA, teamB),
    yesSide: teamA, // Polymarket "outcome[0] price" is for team A
  };
}
