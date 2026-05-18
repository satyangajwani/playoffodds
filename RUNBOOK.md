# Deploy runbook

Phase D ships the IPL playoff tracker to Cloudflare Workers + D1 + Cron.
This is the 5-command checklist plus verification queries.

## Live deployment

- **URL:** [https://playoffodds.dayprism.workers.dev](https://playoffodds.dayprism.workers.dev)
- **Account:** `Sg@sgplex.com's Account` (`a75cab314e7a659c0a4339292f707e14`)
- **D1 database:** `playoffodds` (`bf3115a0-318c-44af-8918-4db85e09ed53`)
- **Cron:** `*/10 * * * *` (every 10 minutes)
- **First deployed:** 2026-05-18

Share these URLs with the team:

- `/` — live tracker
- `/embed` — content-only iframe
- `/api/snapshot` — JSON API (CORS allows all origins)
- `/at/2026-05-18T1830` — historical snapshot

## First-deploy checklist (already done — keep for re-deploys)

## Pre-deploy (~5 minutes, requires your Cloudflare account)

1. **Authenticate wrangler** (opens a browser window for OAuth):
   ```bash
   npx wrangler login
   npx wrangler whoami   # confirm the right account
   ```

2. **Create the D1 database** and copy the `database_id` it prints:
   ```bash
   npx wrangler d1 create playoffodds
   # Output ends with:
   # [[d1_databases]]
   # binding = "DB"
   # database_name = "playoffodds"
   # database_id = "abcd1234-..."   ← copy this
   ```
   Paste the `database_id` value into `wrangler.toml`, replacing
   `"REPLACE_AFTER_WRANGLER_D1_CREATE"`.

3. **Apply migrations** to the remote D1 (creates schema + seeds teams + fixtures):
   ```bash
   npx wrangler d1 migrations apply playoffodds --remote
   # → '0001_init.sql ✓' and '0002_seed.sql ✓'
   ```

4. **Set the admin token** (so `/admin/refresh` can be triggered for the first snapshot):
   ```bash
   openssl rand -hex 24 | npx wrangler secret put ADMIN_TOKEN
   # Save the token — you'll use it once below, then can rotate.
   ```

5. **Deploy**:
   ```bash
   npm run build:css   # regenerate styles.gen.ts from public/styles.css
   npx wrangler deploy
   # → 'Uploaded playoffodds (...)' and a URL like
   #   https://playoffodds.<your-subdomain>.workers.dev
   ```

## First snapshot (one-time, kicks the cron loop)

The cron runs every 10 min, but the first invocation is up to 10 min away.
Trigger one manually so the page has data immediately:

```bash
URL="https://playoffodds.<your-subdomain>.workers.dev"
TOKEN="<the token from step 4>"
curl -fsS -H "Authorization: Bearer $TOKEN" "$URL/admin/refresh"
# → 'ok'
```

Then open `$URL/` in a browser — you should see the live probability table.

## Post-deploy verification

Run each query and confirm the expected result.

### Cron is firing on the right cadence

```bash
npx wrangler d1 execute playoffodds --remote --command "
  SELECT taken_at_utc,
         (julianday(taken_at_utc) - julianday(LAG(taken_at_utc) OVER (ORDER BY taken_at_utc))) * 1440 AS gap_min
  FROM snapshots
  WHERE committed_at IS NOT NULL
    AND taken_at_utc > datetime('now', '-2 hours')
  ORDER BY taken_at_utc DESC;
"
```

Expected after ~30 minutes: rows every ~10 minutes, no gap below 8 (the idempotency guard).

### Source coverage looks right

```bash
npx wrangler d1 execute playoffodds --remote --command "
  SELECT sources_used, COUNT(*) AS c
  FROM match_odds
  WHERE snapshot_id = (
    SELECT id FROM snapshots WHERE committed_at IS NOT NULL ORDER BY taken_at_utc DESC LIMIT 1
  )
  GROUP BY sources_used;
"
```

Expected: a mix of `both`, `kalshi-only`, `poly-only`. If everything is `fallback-50-50`, the
fetchers are failing — check `wrangler tail`.

### Probabilities sum to the expected totals

```bash
npx wrangler d1 execute playoffodds --remote --command "
  SELECT printf('%.4f', SUM(p_playoffs)) AS sum_top4,
         printf('%.4f', SUM(p_top2))     AS sum_top2,
         printf('%.4f', SUM(p_champion)) AS sum_champ
  FROM team_probabilities
  WHERE snapshot_id = (
    SELECT id FROM snapshots WHERE committed_at IS NOT NULL ORDER BY taken_at_utc DESC LIMIT 1
  );
"
```

Expected: `4.0000`, `2.0000`, `1.0000` exact.

### No error-level warnings

```bash
npx wrangler d1 execute playoffodds --remote --command "
  SELECT level, code, COUNT(*) AS c
  FROM snapshot_warnings
  WHERE snapshot_id IN (SELECT id FROM snapshots WHERE taken_at_utc > datetime('now', '-1 hour'))
  GROUP BY level, code;
"
```

Expected: zero rows with `level='error'`. `warn` entries for `source_disagreement` are OK
(market views disagreed by >15pp on at least one fixture).

### Live logs

```bash
npx wrangler tail playoffodds   # streams `console.log` from cron + requests
```

## Rollback / pause

- **Pause cron**: comment out the `crons = ["*/10 * * * *"]` line in `wrangler.toml`,
  re-deploy. The web routes keep serving the last good snapshot.
- **Revert to a previous deploy**: `npx wrangler rollback`.
- **Wipe a bad snapshot manually**:
  ```bash
  npx wrangler d1 execute playoffodds --remote --command "
    UPDATE snapshots SET committed_at = NULL WHERE id = '<snapshot_id>';
  "
  # Readers filter on committed_at, so the bad snapshot becomes invisible.
  ```

## What's NOT yet wired (Phase E follow-ups)

- **KV cache** for the latest-snapshot fast path (uncomment `[[kv_namespaces]]` in
  `wrangler.toml` and add `LATEST_SNAPSHOT` env consumption in routes.tsx)
- **Workers Assets** for static CSS / fonts (currently inlined; ~9KB per HTML response)
- **Cricinfo scraping** → standings derivation (right now standings are anchored to
  May 18, 2026 in `src/data/standings-may-18.ts`)
- **Backfill** historical snapshots from Kalshi candlesticks + Polymarket prices-history
- **Cloudflare Rate Limiting Rules** on `/at/*` and `/api/*` at 60 req/min/IP
- **Cloudflare Access** in front of `/admin/*` (currently just bearer-token guarded)

## Sharing the URL

Once the verification passes, share `https://playoffodds.<your-subdomain>.workers.dev`
with management. Useful entry points:

- `/` — current live tracker (cache 60s)
- `/embed` — content-only, iframe-friendly (no chrome)
- `/api/snapshot` — JSON for integrations
- `/at/2026-05-18T1830` — historical snapshot (cache 1h, immutable)

OG image previews are dynamic per snapshot — paste any of these in Slack/Twitter and
the preview should show the top-6 teams with their championship probabilities.
