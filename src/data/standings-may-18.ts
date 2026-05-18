// Initial standings as of May 18, 2026 — the day Phase A-D were built. Pulled from
// ESPNcricinfo + sportsboardindia cross-check during planning.
//
// This is a temporary anchor: when cricket scraping is wired in Phase E, this constant
// goes away in favor of deriving standings from completed `fixture_results` rows.

import type { TeamCode } from "../domain/ids.ts";

export interface InitialStanding {
  wins: number;
  losses: number;
  noResults: number;
  nrr: number;
}

export const STANDINGS_MAY_18: Record<string, InitialStanding> = {
  RCB:  { wins: 9, losses: 4, noResults: 0, nrr: 1.065 },
  GT:   { wins: 8, losses: 5, noResults: 0, nrr: 0.4 },
  SRH:  { wins: 7, losses: 5, noResults: 0, nrr: 0.331 },
  PBKS: { wins: 6, losses: 6, noResults: 1, nrr: 0.227 },
  CSK:  { wins: 6, losses: 6, noResults: 0, nrr: 0.027 },
  RR:   { wins: 6, losses: 6, noResults: 0, nrr: 0.027 },
  DC:   { wins: 6, losses: 7, noResults: 0, nrr: -0.871 },
  KKR:  { wins: 5, losses: 6, noResults: 1, nrr: -0.038 },
  MI:   { wins: 4, losses: 8, noResults: 0, nrr: -0.504 },
  LSG:  { wins: 4, losses: 8, noResults: 0, nrr: -0.701 },
};

export const initialStandingsMap = (teams: TeamCode[]): Map<TeamCode, InitialStanding> =>
  new Map(teams.map((c) => [c, STANDINGS_MAY_18[c] ?? { wins: 0, losses: 0, noResults: 0, nrr: 0 }]));
