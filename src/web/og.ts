// Phase C: dynamic OG-image generation via workers-og. Each snapshot gets a unique image
// keyed by `/og/<ttPath>.png` so social previews show the right values at any past time.
//
// Note: workers-og bundles Satori + resvg-wasm and works on Workers + Node. For Phase C the
// route handler is wired and returns a placeholder PNG when workers-og isn't available;
// Phase D will turn this on in production once the wasm asset is included in the bundle.

import type { Context, Hono } from "hono";
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
  // Lazy-import workers-og so the package failing to load doesn't break the rest of the app.
  let ImageResponse: typeof import("workers-og").ImageResponse | null = null;
  try {
    ({ ImageResponse } = await import("workers-og"));
  } catch {
    // Fallback: a tiny 1×1 transparent PNG. Production deploy will include the wasm asset.
    return c.body(EMPTY_PNG, 200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=600",
    });
  }

  const top = vm.rows.slice(0, 6);
  const markup = ogMarkup(top, vm.takenAtUtc, vm.isHistorical);
  const res = new ImageResponse(markup as unknown as string, {
    width: 1200,
    height: 630,
    format: "png",
    // workers-og uses bundled fonts by default; we pass none and accept Inter substitutes.
  });
  c.header("Cache-Control", "public, max-age=86400, immutable");
  c.header("Content-Type", "image/png");
  return res;
}

function ogMarkup(
  top: { shortName: string; pChampion: number; pPlayoffs: number }[],
  takenAtUtc: string,
  historical: boolean,
): string {
  // workers-og accepts JSX-like markup as a string. We hand-render to plain HTML so the
  // dependency is minimal.
  const rows = top
    .map((t, i) => {
      const pct1 = pct(t.pChampion);
      return `
        <div style="display:flex;align-items:baseline;gap:24px;padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.07);">
          <div style="width:36px;color:#959595;font-size:24px;">${i + 1}</div>
          <div style="flex:1;font-weight:600;font-size:36px;color:#222;">${escape(t.shortName)}</div>
          <div style="font-variant-numeric:tabular-nums;font-weight:500;font-size:36px;color:#222;">${pct1}</div>
        </div>
      `;
    })
    .join("");
  return `
    <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#ffffff;padding:56px 64px;font-family:Inter,sans-serif;">
      <div style="display:flex;align-items:baseline;justify-content:space-between;color:#959595;font-size:18px;letter-spacing:.04em;text-transform:uppercase;">
        <div>IPL 2026 · Playoff probability tracker</div>
        <div>${historical ? "As of " : "Updated "}${escape(istDateTime(takenAtUtc))}</div>
      </div>
      <div style="font-size:64px;font-weight:800;color:#222;margin:18px 0 28px;line-height:1.05;">
        Who wins IPL 2026?
      </div>
      <div style="display:flex;flex-direction:column;gap:0;">${rows}</div>
      <div style="margin-top:auto;color:#666;font-size:16px;">
        Derived from Kalshi + Polymarket via 25K-iter Monte Carlo
      </div>
    </div>
  `;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 1x1 transparent PNG (43 bytes) for the no-workers-og fallback.
const EMPTY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);
