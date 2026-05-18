// Node-side dev runner. Wires the shared orchestrator at src/snapshot/run.ts to
// local better-sqlite3 storage. The actual snapshot logic (fetch → match → MC) lives
// in src/snapshot/run.ts so the same code drives the Worker scheduled handler.

import type { Database as DatabaseT } from "better-sqlite3";
import * as kalshiFetch from "../src/clients/kalshi/fetch.ts";
import {
  parseChampionMarket as parseKalshiChamp,
  parseGameMarket as parseKalshiGame,
} from "../src/clients/kalshi/parse.ts";
import * as polyFetch from "../src/clients/polymarket/fetch.ts";
import {
  parseChampionSubMarket as parsePolyChamp,
  parsePerMatchEvent as parsePolyGame,
} from "../src/clients/polymarket/parse.ts";
import {
  fixtureId,
  isoUtc,
  kalshiTicker,
  polyEventSlug,
  teamCode,
  type TeamCode,
} from "../src/domain/ids.ts";
import type {
  Fixture,
  KalshiChampionMarket,
  KalshiGameMarket,
  PolyChampionMarket,
  PolyGameMarket,
} from "../src/domain/types.ts";
import { TEAMS } from "../src/matcher/team-codes.ts";
import { runSnapshot, type InitialStanding } from "../src/snapshot/run.ts";
import type { ClientError } from "../src/shared/errors.ts";
import { ok, type Result } from "../src/shared/result.ts";
import { applyWritesSync, buildSnapshotWrites } from "../src/storage/snapshot-writer.ts";
import { openDb } from "./db.ts";
import { STANDINGS_MAY_18 } from "../src/data/standings-may-18.ts";

interface FixtureRow {
  match_number: number;
  date_utc: string;
  venue: string;
  team_a_code: string | null;
  team_b_code: string | null;
  kalshi_game_ticker: string | null;
  poly_event_slug: string | null;
  status: "scheduled" | "live" | "completed" | "abandoned";
  stage: Fixture["stage"];
}

function loadFixtures(db: DatabaseT): Fixture[] {
  const rows = db.prepare("SELECT * FROM fixtures ORDER BY match_number").all() as FixtureRow[];
  return rows.map((r) => ({
    matchNumber: fixtureId(r.match_number),
    dateUtc: isoUtc(r.date_utc),
    venue: r.venue,
    teamA: r.team_a_code ? teamCode(r.team_a_code) : null,
    teamB: r.team_b_code ? teamCode(r.team_b_code) : null,
    kalshiGameTicker: r.kalshi_game_ticker ? kalshiTicker(r.kalshi_game_ticker) : null,
    polyEventSlug: r.poly_event_slug ? polyEventSlug(r.poly_event_slug) : null,
    status: r.status,
    stage: r.stage,
  }));
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const db = openDb();
  const fixtures = loadFixtures(db);
  console.log(`[snapshot:dev] loaded ${fixtures.length} fixtures from dev.db`);

  const teamCodes = TEAMS.map((t) => t.code);
  const initial = new Map<TeamCode, InitialStanding>(
    teamCodes.map((c) => [c, STANDINGS_MAY_18[c] ?? { wins: 0, losses: 0, noResults: 0, nrr: 0 }]),
  );

  const payload = await runSnapshot({
    trigger: "snapshot-dev",
    teamCodes,
    fixtures,
    initialStandings: initial,
    clients: {
      kalshiGames: async () => parseAll(await kalshiFetch.fetchGameMarkets(), parseKalshiGame),
      kalshiChampion: async () =>
        parseAll(await kalshiFetch.fetchChampionMarkets(), parseKalshiChamp),
      polyGames: async () => {
        const r = await polyFetch.fetchPerMatchEvents();
        if (!r.ok) return r;
        const out: PolyGameMarket[] = [];
        for (const ev of r.value) {
          const p = parsePolyGame(ev);
          if (p) out.push(p);
        }
        return ok(out);
      },
      polyChampion: async () => {
        const r = await polyFetch.fetchChampionEvent();
        if (!r.ok) return r;
        const event = r.value[0];
        const out: PolyChampionMarket[] = [];
        for (const m of event?.markets ?? []) {
          const p = parsePolyChamp(m);
          if (p) out.push(p);
        }
        return ok(out);
      },
    },
  });

  console.log(
    `[snapshot:dev] matched: ${payload.matchOdds.length} match_odds, ${payload.championOdds.length} champion, ${payload.warnings.length} warnings`,
  );

  const writes = buildSnapshotWrites(payload);
  applyWritesSync(db, writes);

  console.log(`[snapshot:dev] wrote snapshot ${payload.meta.id} in ${Date.now() - startedAt}ms`);
  console.log(`  ${writes.length} statements applied`);
  const dist = db
    .prepare(
      `SELECT sources_used, COUNT(*) AS c FROM match_odds WHERE snapshot_id = ? GROUP BY sources_used`,
    )
    .all(payload.meta.id) as Array<{ sources_used: string; c: number }>;
  for (const r of dist) console.log(`  ${r.sources_used}: ${r.c}`);
  db.close();
}

function parseAll<I, O>(
  r: Result<I[], ClientError>,
  parse: (i: I) => O | null,
): Result<O[], ClientError> {
  if (!r.ok) return r;
  const out: O[] = [];
  for (const i of r.value) {
    const p = parse(i);
    if (p) out.push(p);
  }
  return ok(out);
}

// Type the kalshi inputs (which are raw zod-output objects)
type KGame = Parameters<typeof parseKalshiGame>[0];
type KChamp = Parameters<typeof parseKalshiChamp>[0];
type _ks = [KGame, KChamp, KalshiGameMarket, KalshiChampionMarket];

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
