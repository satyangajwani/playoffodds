// Admin routes for the Worker + dev server. Mounted by both entries.

import type { Hono } from "hono";
import type { AppEnv } from "./routes.tsx";

// The Worker passes the real D1Database + secrets; the dev server passes the shim.
// We use a structural type that both satisfy.
export interface AdminEnv {
  DB: unknown;
  ADMIN_TOKEN?: string;
}

export type SnapshotRunner = (env: AdminEnv, trigger: "manual") => Promise<void>;

export function attachAdminRoutes(app: Hono<AppEnv>, run: SnapshotRunner): void {
  app.get("/admin/refresh", async (c) => {
    const env = c.env as unknown as AdminEnv;
    const expected = env.ADMIN_TOKEN;
    const provided = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    // In dev (no token set) we accept any request; in prod the token is required.
    if (expected && (!provided || provided !== expected)) {
      return c.text("unauthorized", 401);
    }
    try {
      await run(env, "manual");
      return c.text("ok");
    } catch (e) {
      console.error("[admin/refresh] failed:", e);
      return c.text(`error: ${(e as Error).message}`, 500);
    }
  });
}
