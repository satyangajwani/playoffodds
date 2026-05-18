// Local Node dev server. Wraps the Hono Worker app with a D1Database shim over better-sqlite3
// so we can iterate on the UI without `wrangler dev`. Static assets are served from public/.

import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { d1ShimFromSqlite } from "../src/storage/d1-shim.ts";
import { attachOgRoutes } from "../src/web/og.ts";
import { type AppEnv, buildApp } from "../src/web/routes.tsx";
import { DB_PATH, openDb } from "./db.ts";

if (!existsSync(DB_PATH)) {
  console.error(`[dev-server] ${DB_PATH} not found. Run 'npm run db:seed' first.`);
  process.exit(1);
}

const sqlite = openDb();
const db = d1ShimFromSqlite(sqlite);

const app = new Hono<AppEnv>();
// Serve static assets out of public/ first (so /styles.css works before any route handler)
app.use("/styles.css", serveStatic({ root: "./public" }));
app.use("/fonts/*", serveStatic({ root: "./public" }));
app.use("/favicon.ico", serveStatic({ root: "./public" }));

// Inject the DB binding for every request.
app.use("*", async (c, next) => {
  c.env.DB = db as never;
  await next();
});

// Mount the production Hono app under the same routes.
const prod = buildApp();
attachOgRoutes(prod);
app.route("/", prod);

const port = Number(process.env.PORT ?? "8787");
console.log(`[dev-server] http://localhost:${port}  (reading ${DB_PATH})`);
serve({ fetch: app.fetch, port });
