// One-shot bootstrap: creates dev.db, applies the migration, seeds teams + upcoming fixtures.
// Idempotent at the (teams, fixtures) row level — re-running upserts rather than duplicating.

import { existsSync } from "node:fs";
import { TEAMS } from "../src/matcher/team-codes.ts";
import { DB_PATH, applyMigrations, openDb } from "./db.ts";

interface FixtureSeed {
  matchNumber: number;
  dateUtc: string;
  venue: string;
  teamA: string | null;
  teamB: string | null;
  stage: "league" | "qualifier_1" | "eliminator" | "qualifier_2" | "final";
}

// Remaining IPL 2026 league fixtures as exposed by Kalshi's KXIPLGAME series on 2026-05-18,
// plus a Polymarket-only fixture for May 18. Times are scheduled start in UTC (= IST -5:30).
// Re-run `tsx scripts/inspect-schedule.ts` to validate against the venues.
const REMAINING_LEAGUE: FixtureSeed[] = [
  {
    matchNumber: 63,
    dateUtc: "2026-05-18T14:00:00Z",
    venue: "Chepauk, Chennai",
    teamA: "CSK",
    teamB: "SRH",
    stage: "league",
  },
  {
    matchNumber: 64,
    dateUtc: "2026-05-19T14:00:00Z",
    venue: "Sawai Mansingh, Jaipur",
    teamA: "RR",
    teamB: "LSG",
    stage: "league",
  },
  {
    matchNumber: 65,
    dateUtc: "2026-05-20T14:00:00Z",
    venue: "Eden Gardens, Kolkata",
    teamA: "KKR",
    teamB: "MI",
    stage: "league",
  },
  {
    matchNumber: 66,
    dateUtc: "2026-05-21T14:00:00Z",
    venue: "Chepauk, Chennai",
    teamA: "CSK",
    teamB: "GT",
    stage: "league",
  },
  {
    matchNumber: 67,
    dateUtc: "2026-05-22T14:00:00Z",
    venue: "Chinnaswamy, Bengaluru",
    teamA: "RCB",
    teamB: "SRH",
    stage: "league",
  },
  {
    matchNumber: 68,
    dateUtc: "2026-05-23T14:00:00Z",
    venue: "Mullanpur, Mohali",
    teamA: "PBKS",
    teamB: "LSG",
    stage: "league",
  },
  {
    matchNumber: 69,
    dateUtc: "2026-05-24T10:00:00Z",
    venue: "Kotla, Delhi",
    teamA: "DC",
    teamB: "KKR",
    stage: "league",
  },
  {
    matchNumber: 70,
    dateUtc: "2026-05-24T14:00:00Z",
    venue: "Wankhede, Mumbai",
    teamA: "MI",
    teamB: "RR",
    stage: "league",
  },
];

const PLAYOFF_STUBS: FixtureSeed[] = [
  {
    matchNumber: 71,
    dateUtc: "2026-05-26T14:00:00Z",
    venue: "TBD",
    teamA: null,
    teamB: null,
    stage: "qualifier_1",
  },
  {
    matchNumber: 72,
    dateUtc: "2026-05-27T14:00:00Z",
    venue: "TBD",
    teamA: null,
    teamB: null,
    stage: "eliminator",
  },
  {
    matchNumber: 73,
    dateUtc: "2026-05-29T14:00:00Z",
    venue: "TBD",
    teamA: null,
    teamB: null,
    stage: "qualifier_2",
  },
  {
    matchNumber: 74,
    dateUtc: "2026-05-31T14:00:00Z",
    venue: "Narendra Modi Stadium, Ahmd.",
    teamA: null,
    teamB: null,
    stage: "final",
  },
];

const ALL_FIXTURES: FixtureSeed[] = [...REMAINING_LEAGUE, ...PLAYOFF_STUBS];

function main(): void {
  const freshDb = !existsSync(DB_PATH);
  const db = openDb();
  if (freshDb) {
    console.log(`[seed] applying migration to fresh ${DB_PATH}`);
    applyMigrations(db);
  } else {
    console.log("[seed] dev.db exists; upserting rows only");
  }

  // Teams: full UPSERT on (code)
  const upsertTeam = db.prepare(`
    INSERT INTO teams (code, full_name, short_name, primary_color_hex, kalshi_code, poly_short_codes)
    VALUES (@code, @full_name, @short_name, @primary_color_hex, @kalshi_code, @poly_short_codes)
    ON CONFLICT(code) DO UPDATE SET
      full_name = excluded.full_name,
      short_name = excluded.short_name,
      primary_color_hex = excluded.primary_color_hex,
      kalshi_code = excluded.kalshi_code,
      poly_short_codes = excluded.poly_short_codes
  `);

  const insertTeams = db.transaction(() => {
    for (const t of TEAMS) {
      upsertTeam.run({
        code: t.code,
        full_name: t.fullName,
        short_name: t.shortName,
        primary_color_hex: t.primaryColorHex,
        kalshi_code: t.kalshiCode,
        poly_short_codes: JSON.stringify(t.polyShortCodes),
      });
    }
  });
  insertTeams();
  console.log(`[seed] upserted ${TEAMS.length} teams`);

  // Fixtures: full UPSERT on (match_number)
  const upsertFixture = db.prepare(`
    INSERT INTO fixtures (match_number, date_utc, venue, team_a_code, team_b_code, status, stage)
    VALUES (@match_number, @date_utc, @venue, @team_a, @team_b, 'scheduled', @stage)
    ON CONFLICT(match_number) DO UPDATE SET
      date_utc = excluded.date_utc,
      venue = excluded.venue,
      team_a_code = excluded.team_a_code,
      team_b_code = excluded.team_b_code,
      stage = excluded.stage
  `);

  const insertFixtures = db.transaction(() => {
    for (const f of ALL_FIXTURES) {
      upsertFixture.run({
        match_number: f.matchNumber,
        date_utc: f.dateUtc,
        venue: f.venue,
        team_a: f.teamA,
        team_b: f.teamB,
        stage: f.stage,
      });
    }
  });
  insertFixtures();
  console.log(
    `[seed] upserted ${ALL_FIXTURES.length} fixtures (${REMAINING_LEAGUE.length} league + ${PLAYOFF_STUBS.length} playoff stubs)`,
  );

  // Quick sanity printouts
  const teamCount = db.prepare("SELECT COUNT(*) AS c FROM teams").get() as { c: number };
  const fixtureCount = db.prepare("SELECT COUNT(*) AS c FROM fixtures").get() as { c: number };
  const scheduled = db
    .prepare("SELECT COUNT(*) AS c FROM fixtures WHERE status = 'scheduled'")
    .get() as { c: number };
  console.log(
    `[seed] sanity: teams=${teamCount.c}, fixtures=${fixtureCount.c}, scheduled=${scheduled.c}`,
  );
  db.close();
}

main();
