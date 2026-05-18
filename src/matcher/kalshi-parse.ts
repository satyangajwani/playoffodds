import type { KalshiGameMarket } from "../domain/types.ts";
import { fixtureKeyDate } from "../shared/time.ts";
import { kalshiCodeToTeam } from "./team-codes.ts";

// Canonical fixture key: (date_in_IST, sorted_team_pair). Joinable across venues + fixture table.
export interface CanonicalKey {
  date: string; // 'YYYY-MM-DD' in IST
  pair: string; // 'CSK|SRH' (sorted alphabetically)
  // For per-match markets, also include which side is "team_a" relative to the YES quote
  yesSide: string; // TeamCode of the team whose YES contract is being priced
}

export const pairKey = (a: string, b: string): string => [a, b].sort().join("|");

export function kalshiGameToKey(m: KalshiGameMarket): CanonicalKey | null {
  const yesTeam = kalshiCodeToTeam(m.yesSideTeamCode);
  const pairTeam = kalshiCodeToTeam(m.pairedTeamCode);
  if (!yesTeam || !pairTeam) return null;
  return {
    date: fixtureKeyDate(m.startUtc),
    pair: pairKey(yesTeam, pairTeam),
    yesSide: yesTeam,
  };
}
