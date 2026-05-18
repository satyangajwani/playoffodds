// Phase A acceptance entry point. Runs the full ingestion pipeline against local dev.db:
//   - Pull fixtures from local DB
//   - Fetch Kalshi + Polymarket markets in parallel (Promise.allSettled, no partial-write)
//   - Run the matcher
//   - Write a snapshot (rows + payload_json + committed_at)
// Phase B will move this into the Worker scheduled handler against D1.

import type { Database as DatabaseT } from "better-sqlite3";
import * as kalshi from "../src/clients/kalshi/fetch.ts";
import {
  parseChampionMarket as parseKalshiChamp,
  parseGameMarket as parseKalshiGame,
} from "../src/clients/kalshi/parse.ts";
import * as poly from "../src/clients/polymarket/fetch.ts";
import {
  parseChampionSubMarket as parsePolyChamp,
  parsePerMatchEvent as parsePolyGame,
} from "../src/clients/polymarket/parse.ts";
import {
  fixtureId,
  isoUtc,
  kalshiTicker,
  polyEventSlug,
  snapshotId,
  teamCode,
} from "../src/domain/ids.ts";
import type {
  Fixture,
  KalshiChampionMarket,
  KalshiGameMarket,
  PolyChampionMarket,
  PolyGameMarket,
} from "../src/domain/types.ts";
import { joinMarkets } from "../src/matcher/join.ts";
import { uuidv7 } from "../src/shared/uuid.ts";
import { type DbAdapter, writeSnapshot } from "../src/storage/snapshot-writer.ts";
import { openDb } from "./db.ts";

// ---------- Adapter ----------
function adapterFor(db: DatabaseT): DbAdapter {
  return {
    exec(sql, params) {
      db.prepare(sql).run((params ?? {}) as Record<string, unknown>);
    },
    count(table, where) {
      if (where?.snapshotId) {
        const r = db
          .prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE snapshot_id = ?`)
          .get(where.snapshotId) as { c: number };
        return r.c;
      }
      const r = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number };
      return r.c;
    },
  };
}

// ---------- Load fixtures from DB ----------
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

// ---------- Main ----------
async function main(): Promise<void> {
  const startedAt = Date.now();
  const db = openDb();
  const fixtures = loadFixtures(db);
  console.log(`[snapshot:dev] loaded ${fixtures.length} fixtures from dev.db`);

  // Fan-out fetches in parallel; tolerate per-source failure via allSettled.
  const [kGames, kChamp, pChamp, pGames] = await Promise.allSettled([
    kalshi.fetchGameMarkets(),
    kalshi.fetchChampionMarkets(),
    poly.fetchChampionEvent(),
    poly.fetchPerMatchEvents(),
  ]);

  const kalshiGames: KalshiGameMarket[] = [];
  const kalshiChampion: KalshiChampionMarket[] = [];
  const polyGames: PolyGameMarket[] = [];
  const polyChampion: PolyChampionMarket[] = [];
  const sourceWarnings: {
    level: "warn" | "error";
    code: string;
    detail: Record<string, unknown>;
  }[] = [];

  if (kGames.status === "fulfilled" && kGames.value.ok) {
    for (const raw of kGames.value.value) {
      const parsed = parseKalshiGame(raw);
      if (parsed) kalshiGames.push(parsed);
    }
    console.log(`[snapshot:dev] kalshi games: ${kalshiGames.length}`);
  } else {
    const detail = kGames.status === "fulfilled" ? kGames.value : { reason: String(kGames.reason) };
    sourceWarnings.push({
      level: "error",
      code: "kalshi_games_fetch_failed",
      detail: detail as Record<string, unknown>,
    });
    console.warn("[snapshot:dev] kalshi games FAILED:", detail);
  }

  if (kChamp.status === "fulfilled" && kChamp.value.ok) {
    for (const raw of kChamp.value.value) {
      const parsed = parseKalshiChamp(raw);
      if (parsed) kalshiChampion.push(parsed);
    }
    console.log(`[snapshot:dev] kalshi champion: ${kalshiChampion.length}`);
  } else {
    sourceWarnings.push({
      level: "error",
      code: "kalshi_champion_fetch_failed",
      detail:
        kChamp.status === "fulfilled"
          ? (kChamp.value as Record<string, unknown>)
          : { reason: String(kChamp.reason) },
    });
    console.warn("[snapshot:dev] kalshi champion FAILED");
  }

  if (pChamp.status === "fulfilled" && pChamp.value.ok) {
    const event = pChamp.value.value[0];
    for (const m of event?.markets ?? []) {
      const parsed = parsePolyChamp(m);
      if (parsed) polyChampion.push(parsed);
    }
    console.log(`[snapshot:dev] polymarket champion: ${polyChampion.length}`);
  } else {
    sourceWarnings.push({
      level: "error",
      code: "polymarket_champion_fetch_failed",
      detail:
        pChamp.status === "fulfilled"
          ? (pChamp.value as Record<string, unknown>)
          : { reason: String(pChamp.reason) },
    });
    console.warn("[snapshot:dev] polymarket champion FAILED");
  }

  if (pGames.status === "fulfilled" && pGames.value.ok) {
    for (const ev of pGames.value.value) {
      const parsed = parsePolyGame(ev);
      if (parsed) polyGames.push(parsed);
    }
    console.log(`[snapshot:dev] polymarket games: ${polyGames.length}`);
  } else {
    sourceWarnings.push({
      level: "error",
      code: "polymarket_games_fetch_failed",
      detail:
        pGames.status === "fulfilled"
          ? (pGames.value as Record<string, unknown>)
          : { reason: String(pGames.reason) },
    });
    console.warn("[snapshot:dev] polymarket games FAILED");
  }

  // Run the join
  const join = joinMarkets({
    fixtures,
    kalshiGames,
    polyGames,
    kalshiChampion,
    polyChampion,
  });
  console.log(
    `[snapshot:dev] matched: ${join.matchOdds.length} match_odds rows, ${join.championOdds.length} champion rows, ${join.warnings.length} warnings`,
  );

  // Compute content hash
  const inputDigest = await sha256(
    JSON.stringify({
      kalshiGames: kalshiGames.map((m) => [m.ticker, m.midpoint]).sort(),
      polyGames: polyGames.map((m) => [m.eventSlug, m.outcomePriceA]).sort(),
      kalshiChampion: kalshiChampion.map((m) => [m.ticker, m.yesMidpoint]).sort(),
      polyChampion: polyChampion.map((m) => [m.teamCodeRaw, m.yesPrice]).sort(),
    }),
  );

  const meta = {
    id: snapshotId(uuidv7()),
    takenAtUtc: isoUtc(new Date().toISOString()),
    trigger: "snapshot-dev" as const,
    schemaVersion: 1,
    tiebreakAlgorithmVersion: 1,
    contentHash: inputDigest,
  };

  // Write to DB inside a single transaction. better-sqlite3 transactions are synchronous;
  // we wrap writeSnapshot in db.transaction so a thrown error rolls everything back.
  const adapter = adapterFor(db);
  const txn = db.transaction(() => {
    writeSnapshot(adapter, {
      meta,
      matchOdds: join.matchOdds,
      championOdds: join.championOdds,
      warnings: [...join.warnings, ...sourceWarnings],
    });
  });

  try {
    txn();
  } catch (e) {
    console.error("[snapshot:dev] FAILED to write snapshot:", e);
    process.exit(1);
  }

  // Verify acceptance criteria
  const snapshots = adapter.count("snapshots");
  const matchRows = adapter.count("match_odds", { snapshotId: meta.id });
  const champRows = adapter.count("champion_market_odds", { snapshotId: meta.id });
  const warnRows = adapter.count("snapshot_warnings", { snapshotId: meta.id });

  console.log("---");
  console.log("[snapshot:dev] ACCEPTANCE");
  console.log(`  snapshots total in DB:           ${snapshots}`);
  console.log(`  match_odds rows for snapshot:    ${matchRows}`);
  console.log(`  champion_odds rows for snapshot: ${champRows}`);
  console.log(`  warnings for snapshot:           ${warnRows}`);
  console.log(`  elapsed:                         ${Date.now() - startedAt}ms`);
  console.log(`  snapshot id:                     ${meta.id}`);
  console.log("---");

  // Distribution of sources_used on this snapshot
  const dist = db
    .prepare(
      "SELECT sources_used, COUNT(*) AS c FROM match_odds WHERE snapshot_id = ? GROUP BY sources_used ORDER BY c DESC",
    )
    .all(meta.id) as Array<{ sources_used: string; c: number }>;
  for (const r of dist) console.log(`  sources_used=${r.sources_used}: ${r.c}`);

  db.close();
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
