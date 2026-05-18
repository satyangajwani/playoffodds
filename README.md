# playoffodds

[![Live](https://img.shields.io/badge/live-playoffodds.dayprism.workers.dev-009270)](https://playoffodds.dayprism.workers.dev)

IPL 2026 playoff probability tracker. Pulls per-match odds from Kalshi + Polymarket,
averages them, runs 25,000-iteration Monte Carlo over the remaining season, and surfaces
P(playoffs), P(top 2), P(champion) per team on a Cricbuzz-styled page. Time-travel via
historical snapshots.

- **Live:** https://playoffodds.dayprism.workers.dev
- **Summary doc** for non-technical sharing: [SUMMARY.md](SUMMARY.md)
- **Full plan + deepening + resolved decisions:** [docs/plans/](docs/plans/)
- **Deploy your own copy:** [RUNBOOK.md](RUNBOOK.md)

## Phase A status

Phase A wires the data ingestion path end-to-end:

- D1 schema (hybrid: structured rows + `snapshots.payload_json` cache)
- Kalshi client (`KXIPLGAME` per-match + `KXIPL-26` champion markets)
- Polymarket client (`cricipl-*` per-match + `2026-ipl-champion` markets)
- Cricinfo client (standings + completed results)
- Matcher (Kalshi ticker / Polymarket slug → canonical fixture)
- `snapshot:dev` script that runs the full pipeline against local D1

Monte Carlo, web UI, cron, and backfill come in Phase B/C.

## Setup

```bash
npm install
npm run db:migrate:local         # create local SQLite via Wrangler --local
npm run db:seed:local            # seed teams + 2026 fixture list
npm run snapshot:dev             # full ingest end-to-end against local D1
npm test                         # vitest
npm run typecheck                # strict TS
npm run lint                     # biome
```

## Deploying to Cloudflare (when ready)

```bash
npx wrangler login                                # browser auth
npx wrangler d1 create playoffodds                # paste database_id into wrangler.toml
npx wrangler d1 migrations apply playoffodds --remote
npx wrangler deploy
```

## Architecture (Phase A scope)

```
src/
  domain/        ids.ts (branded types), types.ts (shared shapes)
  shared/        result.ts (Result<T,E>), time.ts (IST↔UTC), errors.ts
  config.ts      every magic number lives here
  clients/
    base.ts        MarketClient interface, withRateLimit, checkVig, normalizeBookSide
    kalshi/        fetch.ts, schema.ts (Zod), parse.ts
    polymarket/    fetch.ts, schema.ts (Zod), parse.ts
    cricket/       fetch.ts (cricinfo), parse.ts
  matcher/
    team-codes.ts            10 teams + alias map
    kalshi-parse.ts          ticker → canonical key
    polymarket-parse.ts      slug → canonical key
    join.ts                  pure join onto fixture table
scripts/
  seed-teams.ts
  seed-fixtures.ts
  snapshot-dev.ts            local-only orchestrator that exercises the pipeline
migrations/
  0001_init.sql
```
