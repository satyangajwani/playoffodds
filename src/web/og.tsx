// Dynamic OG-image generation via workers-og. Each snapshot gets a unique image keyed by
// `/og/<ttPath>.png` so social previews show the right values at any past time.
//
// Satori (workers-og's renderer) requires every container with multiple children to have
// `display: flex` or `display: none` set explicitly — implicit text nodes from whitespace
// in template literals trip its validator. We use JSX-with-no-whitespace-children for safety.

import type { Context, Hono } from "hono";
import { ImageResponse } from "workers-og";
import { getAllTeams, getLatestSnapshot, getSnapshotAtOrBefore } from "../storage/repo.ts";
import { istDateTime, parseTtParam, pct } from "./format.ts";
import type { AppEnv } from "./routes.tsx";
import { loadPageVM } from "./view-model.ts";

type Ctx = Context<AppEnv>;

export function attachOgRoutes(app: Hono<AppEnv>) {
  app.get("/og/latest.png", async (c) => {
    const db = c.env.DB;
    const [snapshot, teams] = await Promise.all([getLatestSnapshot(db), getAllTeams(db)]);
    if (!snapshot) return c.text("no snapshot", 503);
    const vm = await loadPageVM(db, teams, snapshot, new Date().toISOString(), false);
    return ogResponse(c, vm);
  });

  app.get("/og/:ts.png", async (c) => {
    const raw = c.req.param("ts");
    if (!raw) return c.text("bad timestamp", 400);
    const iso = parseTtParam(raw);
    if (!iso) return c.text("bad timestamp", 400);
    const db = c.env.DB;
    const [snapshot, teams] = await Promise.all([getSnapshotAtOrBefore(db, iso), getAllTeams(db)]);
    if (!snapshot) return c.text("no snapshot before timestamp", 404);
    const vm = await loadPageVM(db, teams, snapshot, iso, true);
    return ogResponse(c, vm);
  });
}

async function ogResponse(c: Ctx, vm: Awaited<ReturnType<typeof loadPageVM>>) {
  try {
    const markup = <OgImage vm={vm} />;
    const res = new ImageResponse(markup as unknown as string, {
      width: 1200,
      height: 630,
      format: "png",
    });
    // Wrap in a fresh Response so cache headers override workers-og's defaults.
    return new Response(res.body, {
      status: res.status,
      headers: {
        ...Object.fromEntries(res.headers),
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (e) {
    console.error("[og] render failed:", e);
    return c.body(EMPTY_PNG, 200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60",
    });
  }
}

// Every container with >1 child has explicit display:flex. No whitespace text nodes.
const OgImage = ({ vm }: { vm: Awaited<ReturnType<typeof loadPageVM>> }) => {
  const top = vm.rows.slice(0, 6);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "1200px",
        height: "630px",
        background: "#ffffff",
        padding: "56px 64px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          color: "#959595",
          fontSize: "18px",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <div>IPL 2026 · Playoff probability tracker</div>
        <div>{(vm.isHistorical ? "As of " : "Updated ") + istDateTime(vm.takenAtUtc)}</div>
      </div>
      <div
        style={{
          fontSize: "64px",
          fontWeight: 800,
          color: "#222",
          margin: "18px 0 28px",
          lineHeight: 1.05,
          display: "flex",
        }}
      >
        Who wins IPL 2026?
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {top.map((t, i) => (
          <div
            key={t.code}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "24px",
              padding: "12px 0",
              borderBottom: "1px solid rgba(0,0,0,0.07)",
            }}
          >
            <div style={{ width: "36px", color: "#959595", fontSize: "24px", display: "flex" }}>
              {String(i + 1)}
            </div>
            <div
              style={{
                flex: 1,
                fontWeight: 600,
                fontSize: "36px",
                color: "#222",
                display: "flex",
              }}
            >
              {t.shortName}
            </div>
            <div
              style={{
                fontVariantNumeric: "tabular-nums",
                fontWeight: 500,
                fontSize: "36px",
                color: "#222",
                display: "flex",
              }}
            >
              {pct(t.pChampion)}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: "auto",
          color: "#666",
          fontSize: "16px",
          display: "flex",
        }}
      >
        Derived from Kalshi + Polymarket via 25K-iter Monte Carlo
      </div>
    </div>
  );
};

// 1x1 transparent PNG fallback (visible failure marker).
const EMPTY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);
