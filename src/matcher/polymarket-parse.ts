import type { PolyGameMarket } from "../domain/types.ts";
import type { CanonicalKey } from "./kalshi-parse.ts";
import { pairKey } from "./kalshi-parse.ts";
import { fullNameToTeam } from "./team-codes.ts";

// Polymarket per-match outcomes carry full team names. We extract the IST date
// from the event slug (date is the literal part of `cricipl-x-y-YYYY-MM-DD`).
const SLUG_DATE_RE = /(\d{4}-\d{2}-\d{2})$/;

export function polyGameToKey(m: PolyGameMarket): CanonicalKey | null {
  const dateMatch = m.eventSlug.match(SLUG_DATE_RE);
  if (!dateMatch || !dateMatch[1]) return null;
  const teamA = fullNameToTeam(m.teamARaw);
  const teamB = fullNameToTeam(m.teamBRaw);
  if (!teamA || !teamB) return null;
  return {
    date: dateMatch[1],
    pair: pairKey(teamA, teamB),
    yesSide: teamA, // Polymarket "outcome[0] price" is for team A
  };
}
