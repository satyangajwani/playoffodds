// Production Cloudflare Worker entry. Combines:
//   - the web routes from Phase C (Hono + JSX SSR + OG)
//   - the scheduled handler that runs the snapshot pipeline against D1 every 10 min
//   - a /admin/refresh route for first-deploy manual snapshots (Cloudflare Access guards it)

import * as kalshiFetch from "./clients/kalshi/fetch.ts";
import {
  parseChampionMarket as parseKalshiChamp,
  parseGameMarket as parseKalshiGame,
} from "./clients/kalshi/parse.ts";
import * as polyFetch from "./clients/polymarket/fetch.ts";
import {
  parseChampionSubMarket as parsePolyChamp,
  parsePerMatchEvent as parsePolyGame,
} from "./clients/polymarket/parse.ts";
import { config } from "./config.ts";
import { STANDINGS_MAY_18, type InitialStanding } from "./data/standings-may-18.ts";
import {
  fixtureId,
  isoUtc,
  kalshiTicker,
  polyEventSlug,
  teamCode,
  type TeamCode,
} from "./domain/ids.ts";
import type {
  Fixture,
  PolyChampionMarket,
  PolyGameMarket,
  SnapshotTrigger,
} from "./domain/types.ts";
import { TEAMS } from "./matcher/team-codes.ts";
import { runSnapshot } from "./snapshot/run.ts";
import type { ClientError } from "./shared/errors.ts";
import { ok, type Result } from "./shared/result.ts";
import { applyWritesD1, buildSnapshotWrites } from "./storage/snapshot-writer.ts";
import { attachAdminRoutes } from "./web/admin.ts";
import { attachOgRoutes } from "./web/og.ts";
import { buildApp } from "./web/routes.tsx";

interface Env {
  DB: D1Database;
  ADMIN_TOKEN?: string;
}

const app = buildApp();
attachOgRoutes(app);
attachAdminRoutes(app, (env, trigger) => runScheduledSnapshot(env as Env, trigger));

async function loadFixtures(db: D1Database): Promise<Fixture[]> {
  interface Row {
    match_number: number;
    date_utc: string;
    venue: string;
    team_a_code: string | null;
    team_b_code: string | null;
    kalshi_game_ticker: string | null;
    poly_event_slug: string | null;
    status: Fixture["status"];
    stage: Fixture["stage"];
  }
  const rs = await db
    .prepare("SELECT * FROM fixtures ORDER BY match_number")
    .all<Row>();
  return rs.results.map((r) => ({
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

async function idempotencyGuard(db: D1Database): Promise<boolean> {
  // Skip if the most recent committed snapshot is within IDEMPOTENCY_GUARD_MS.
  const last = await db
    .prepare(
      "SELECT taken_at_utc FROM snapshots WHERE committed_at IS NOT NULL ORDER BY taken_at_utc DESC LIMIT 1",
    )
    .first<{ taken_at_utc: string }>();
  if (!last) return false;
  const age = Date.now() - Date.parse(last.taken_at_utc);
  return age < config.IDEMPOTENCY_GUARD_MS;
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

export async function runScheduledSnapshot(
  env: Env,
  trigger: SnapshotTrigger = "cron",
): Promise<void> {
  if (await idempotencyGuard(env.DB)) {
    console.log("[scheduled] skipping — last snapshot inside idempotency window");
    return;
  }

  const fixtures = await loadFixtures(env.DB);
  const teamCodes = TEAMS.map((t) => t.code);
  const initial = new Map<TeamCode, InitialStanding>(
    teamCodes.map((c) => [c, STANDINGS_MAY_18[c] ?? { wins: 0, losses: 0, noResults: 0, nrr: 0 }]),
  );

  const payload = await runSnapshot({
    trigger,
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

  const writes = buildSnapshotWrites(payload);
  await applyWritesD1(env.DB, writes);
  console.log(
    `[scheduled] wrote snapshot ${payload.meta.id} — ${payload.matchOdds.length} matches, ${payload.warnings.length} warnings`,
  );
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runScheduledSnapshot(env).catch((e) => {
        console.error("[scheduled] failed:", e);
      }),
    );
  },
} satisfies ExportedHandler<Env>;
