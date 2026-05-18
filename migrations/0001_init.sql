-- Phase A schema. Hybrid: canonical structured rows + snapshots.payload_json render cache.
-- All timestamps stored as ISO-8601 UTC text. PRAGMA enables FKs explicitly (D1 default is OFF).

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------
-- Reference: teams (10 IPL teams, seeded once)
-- ------------------------------------------------------------------
CREATE TABLE teams (
  code              TEXT PRIMARY KEY,          -- 'MI', 'CSK', 'RCB', ...
  full_name         TEXT NOT NULL,             -- 'Mumbai Indians'
  short_name        TEXT NOT NULL,             -- 'Mumbai'
  primary_color_hex TEXT NOT NULL,             -- '#004BA0'
  kalshi_code       TEXT NOT NULL,             -- 'MI'
  poly_short_codes  TEXT NOT NULL              -- JSON array, e.g. '["mum"]'
);

-- ------------------------------------------------------------------
-- Reference: fixtures (74 league + 4 playoff stubs, seeded at install)
-- Mutable columns: status, kalshi_game_ticker, poly_event_slug (filled by matcher)
-- ------------------------------------------------------------------
CREATE TABLE fixtures (
  match_number       INTEGER PRIMARY KEY,
  date_utc           TEXT NOT NULL,            -- 'YYYY-MM-DDTHH:MM:SSZ'
  venue              TEXT NOT NULL,
  team_a_code        TEXT REFERENCES teams(code),
  team_b_code        TEXT REFERENCES teams(code),
  kalshi_game_ticker TEXT,
  poly_event_slug    TEXT,
  status             TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','live','completed','abandoned')),
  stage              TEXT NOT NULL DEFAULT 'league'
                     CHECK (stage IN ('league','qualifier_1','eliminator','qualifier_2','final'))
);
CREATE INDEX idx_fixtures_date ON fixtures(date_utc);
CREATE INDEX idx_fixtures_status ON fixtures(status);

-- ------------------------------------------------------------------
-- Results: completed match outcomes (append-only, FK from fixtures)
-- ------------------------------------------------------------------
CREATE TABLE fixture_results (
  match_number     INTEGER PRIMARY KEY REFERENCES fixtures(match_number),
  winner_code      TEXT REFERENCES teams(code),   -- NULL for no-result
  margin_runs      INTEGER,                       -- non-NULL if bat-first won
  margin_wickets   INTEGER,                       -- non-NULL if chase won
  team_a_runs      INTEGER,
  team_a_overs     REAL,
  team_b_runs      INTEGER,
  team_b_overs     REAL,
  completed_at_utc TEXT NOT NULL
);

-- ------------------------------------------------------------------
-- Snapshots: one row per cron tick (or manual snapshot:dev run)
-- committed_at written last so readers can WHERE committed_at IS NOT NULL
-- ------------------------------------------------------------------
CREATE TABLE snapshots (
  id                          TEXT PRIMARY KEY,    -- UUIDv7
  taken_at_utc                TEXT NOT NULL,
  trigger                     TEXT NOT NULL CHECK (trigger IN ('cron','manual','backfill','snapshot-dev')),
  schema_version              INTEGER NOT NULL DEFAULT 1,
  tiebreak_algorithm_version  INTEGER NOT NULL DEFAULT 1,
  mc_iterations               INTEGER,             -- NULL until Phase B
  mc_seed                     INTEGER,             -- NULL until Phase B
  content_hash                TEXT,                -- sha256 of canonical inputs; UNIQUE below
  payload_json                TEXT,                -- pre-rendered view model (Phase B)
  committed_at                TEXT                 -- ISO timestamp written LAST in batch
);
CREATE INDEX idx_snapshots_taken_at ON snapshots(taken_at_utc);
CREATE INDEX idx_snapshots_committed ON snapshots(committed_at) WHERE committed_at IS NOT NULL;
CREATE UNIQUE INDEX idx_snapshots_content_hash ON snapshots(content_hash) WHERE content_hash IS NOT NULL;

-- ------------------------------------------------------------------
-- Per-snapshot per-fixture market odds (canonical structured row)
-- One row per (snapshot, remaining or in-flight fixture)
-- ------------------------------------------------------------------
CREATE TABLE match_odds (
  snapshot_id        TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  match_number       INTEGER NOT NULL REFERENCES fixtures(match_number),
  kalshi_p_a         REAL,                         -- P(team_a wins) per Kalshi, NULL if unavailable
  kalshi_p_b         REAL,
  poly_p_a           REAL,
  poly_p_b           REAL,
  avg_p_a            REAL NOT NULL,                -- final averaged probability
  avg_p_b            REAL NOT NULL,
  sources_used       TEXT NOT NULL CHECK (sources_used IN ('both','kalshi-only','poly-only','fallback-bt','fallback-50-50')),
  disagreement_pp    REAL,                         -- abs delta between venues
  combined_volume_usd REAL,
  confidence         TEXT NOT NULL DEFAULT 'high' CHECK (confidence IN ('high','medium','low')),
  PRIMARY KEY (snapshot_id, match_number)
);

-- ------------------------------------------------------------------
-- Per-snapshot per-team derived probabilities (filled in Phase B)
-- ------------------------------------------------------------------
CREATE TABLE team_probabilities (
  snapshot_id          TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  team_code            TEXT NOT NULL REFERENCES teams(code),
  p_playoffs           REAL NOT NULL,
  p_top2               REAL NOT NULL,
  p_champion           REAL NOT NULL,
  simulated_wins_mean  REAL,
  simulated_nrr_mean   REAL,
  PRIMARY KEY (snapshot_id, team_code)
);

-- ------------------------------------------------------------------
-- Per-snapshot per-team direct champion-market odds (Kalshi + Polymarket KXIPL/2026-ipl-champion)
-- Cross-check input for the renderer; populated independently of match_odds
-- ------------------------------------------------------------------
CREATE TABLE champion_market_odds (
  snapshot_id     TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  team_code       TEXT NOT NULL REFERENCES teams(code),
  kalshi_p        REAL,
  poly_p          REAL,
  avg_p           REAL NOT NULL,
  resolved_source TEXT,                            -- 'kalshi' | 'polymarket' if either marked resolved
  disagreement_pp REAL,
  PRIMARY KEY (snapshot_id, team_code)
);

-- ------------------------------------------------------------------
-- Append-only warning log per snapshot (unmapped markets, source disagreement, API failure, etc.)
-- ------------------------------------------------------------------
CREATE TABLE snapshot_warnings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  level       TEXT NOT NULL CHECK (level IN ('info','warn','error')),
  code        TEXT NOT NULL,                       -- 'unmapped_market', 'source_disagreement', 'api_failure', 'gap_reason'
  detail_json TEXT NOT NULL,                       -- structured payload
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_warnings_snapshot ON snapshot_warnings(snapshot_id);
CREATE INDEX idx_warnings_level ON snapshot_warnings(level);
