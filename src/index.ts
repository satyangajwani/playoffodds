// Production Worker entry. Combines the web routes (Phase C) with the cron handler
// (wired in Phase D). For Phase C the cron is a no-op stub.

import { attachOgRoutes } from "./web/og.ts";
import { buildApp } from "./web/routes.tsx";

const app = buildApp();
attachOgRoutes(app);

export default {
  fetch: app.fetch,
  // scheduled handler will be wired in Phase D when D1 is provisioned in Cloudflare.
} satisfies ExportedHandler<{ DB: D1Database }>;
