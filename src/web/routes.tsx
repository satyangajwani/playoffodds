import { Hono } from "hono";
import { html, raw } from "hono/html";
import type { DbReadHandle } from "../storage/d1-shim.ts";
import { getAllTeams, getLatestSnapshot, getSnapshotAtOrBefore } from "../storage/repo.ts";
import { istDateTime, parseTtParam, pct, ttPath } from "./format.ts";
import { ChampionCrossCheck } from "./templates/ChampionCrossCheck.tsx";
import { Footer } from "./templates/Footer.tsx";
import { Hero } from "./templates/Hero.tsx";
import { Layout } from "./templates/Layout.tsx";
import { ProbabilityTable } from "./templates/ProbabilityTable.tsx";
import { StalenessBanner } from "./templates/StalenessBanner.tsx";
import { TimeTravel } from "./templates/TimeTravel.tsx";
import { loadPageVM } from "./view-model.ts";

export interface AppEnv {
  Bindings: { DB: DbReadHandle };
}

export const buildApp = () => {
  const app = new Hono<AppEnv>();

  // -------- Security headers --------
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    // /embed allows framing anywhere; everything else refuses framing.
    if (c.req.path === "/embed") {
      c.header("Content-Security-Policy", "frame-ancestors *");
    } else {
      c.header("Content-Security-Policy", "frame-ancestors 'none'");
    }
  });

  // -------- Page: current snapshot --------
  app.get("/", async (c) => {
    const db = c.env.DB;
    const [snapshot, teams] = await Promise.all([getLatestSnapshot(db), getAllTeams(db)]);
    if (!snapshot) {
      return c.text("No snapshots yet. Run `npm run snapshot:dev` to populate dev.db.", 503);
    }
    const vm = await loadPageVM(db, teams, snapshot, new Date().toISOString(), false);
    c.header("Cache-Control", "public, max-age=60, s-maxage=60");
    return c.html(renderPage(vm, /* embedded */ false));
  });

  // -------- Page: historical snapshot at /at/:ts --------
  app.get("/at/:ts", async (c) => {
    const ts = c.req.param("ts");
    const iso = parseTtParam(ts);
    if (!iso) return c.text("Invalid timestamp format. Use YYYY-MM-DDTHHMM.", 400);
    const requested = Date.parse(iso);
    const now = Date.now();
    if (!Number.isFinite(requested)) return c.text("Bad timestamp.", 400);
    if (requested > now + 60 * 60 * 1000) return c.redirect("/", 302);

    const db = c.env.DB;
    const [snapshot, teams] = await Promise.all([getSnapshotAtOrBefore(db, iso), getAllTeams(db)]);
    if (!snapshot) {
      return c.text(`No snapshot recorded before ${istDateTime(iso)}. Try a later date.`, 404);
    }
    const vm = await loadPageVM(db, teams, snapshot, iso, true);
    c.header("Cache-Control", "public, max-age=3600, s-maxage=3600, immutable");
    return c.html(renderPage(vm, false));
  });

  // Helper: form action `/at/` with `?d=YYYY-MM-DD` redirects to canonical /at/:ts
  app.get("/at/", (c) => {
    const d = c.req.query("d");
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return c.redirect("/", 302);
    return c.redirect(`/at/${d}T1830`, 302);
  });

  // -------- Embed --------
  app.get("/embed", async (c) => {
    const db = c.env.DB;
    const [snapshot, teams] = await Promise.all([getLatestSnapshot(db), getAllTeams(db)]);
    if (!snapshot) return c.text("No data yet.", 503);
    const vm = await loadPageVM(db, teams, snapshot, new Date().toISOString(), false);
    c.header("Cache-Control", "public, max-age=60");
    return c.html(renderPage(vm, true));
  });

  // -------- JSON APIs --------
  app.get("/api/snapshot", async (c) => {
    const db = c.env.DB;
    const [snapshot, teams] = await Promise.all([getLatestSnapshot(db), getAllTeams(db)]);
    if (!snapshot) return c.json({ error: "no snapshot" }, 503);
    const vm = await loadPageVM(db, teams, snapshot, new Date().toISOString(), false);
    c.header("Cache-Control", "public, max-age=60");
    c.header("Access-Control-Allow-Origin", "*");
    return c.json(vm);
  });

  app.get("/api/snapshot/:ts", async (c) => {
    const iso = parseTtParam(c.req.param("ts"));
    if (!iso) return c.json({ error: "bad timestamp" }, 400);
    const db = c.env.DB;
    const [snapshot, teams] = await Promise.all([getSnapshotAtOrBefore(db, iso), getAllTeams(db)]);
    if (!snapshot) return c.json({ error: "no snapshot before requested time" }, 404);
    const vm = await loadPageVM(db, teams, snapshot, iso, true);
    c.header("Cache-Control", "public, max-age=3600, immutable");
    c.header("Access-Control-Allow-Origin", "*");
    return c.json(vm);
  });

  // -------- robots.txt --------
  app.get("/robots.txt", (c) => {
    c.header("Content-Type", "text/plain");
    return c.body(
      ["User-agent: *", "Allow: /", "Allow: /embed", "Disallow: /at/", "Disallow: /og/"].join("\n"),
    );
  });

  // -------- /og/:ts.png --------
  // OG generation is implemented via workers-og; the route handler lives in og.ts so the
  // main routes file stays slim.
  return app;
};

// renderPage returns an HTML string (not a JSX element) so we can stamp the doctype prefix
// and pre-render the OG path consistently.
function renderPage(
  vm: ReturnType<typeof Object> & {
    snapshotId: string;
    takenAtUtc: string;
    isHistorical: boolean;
    rows: { shortName: string; pChampion: number }[];
  } & Awaited<ReturnType<typeof loadPageVM>>,
  embedded: boolean,
) {
  const leader = vm.rows[0];
  const title = leader
    ? `${leader.shortName} ${pct(leader.pChampion)} to win IPL 2026 · Playoff probabilities`
    : "IPL 2026 Playoff Probabilities";
  const description = `Live IPL 2026 playoff and championship probabilities from Kalshi + Polymarket markets. Snapshot ${istDateTime(vm.takenAtUtc)}.`;
  const ogPath = vm.isHistorical ? `/og/${ttPath(vm.takenAtUtc)}.png` : "/og/latest.png";
  return html`<!doctype html>${raw(
    (
      <Layout
        title={title}
        description={description}
        embedded={embedded}
        historical={vm.isHistorical}
        ogPath={ogPath}
      >
        {embedded ? null : <Hero vm={vm} />}
        {embedded ? null : <TimeTravel isHistorical={vm.isHistorical} takenAtUtc={vm.takenAtUtc} />}
        <StalenessBanner vm={vm} />
        <ProbabilityTable vm={vm} />
        <ChampionCrossCheck vm={vm} />
        {embedded ? null : <Footer />}
      </Layout>
    ).toString(),
  )}`;
}
