// Every magic number lives here. Per pattern-recognition review.
export const config = {
  // Monte Carlo (Phase B) — included now to keep Phase A and B aligned
  MC_ITERATIONS: 25_000,
  MC_TIEBREAK_ALGO_VERSION: 1,

  // Snapshot cadence + idempotency
  IDEMPOTENCY_GUARD_MS: 8 * 60 * 1000,
  MATCH_WINDOW_START_OFFSET_MS: -30 * 60 * 1000, // 30 min before scheduled start
  MATCH_WINDOW_END_OFFSET_MS: 4 * 60 * 60 * 1000, // 4 hours after scheduled start
  STALENESS_AMBER_MS: 2 * 60 * 60 * 1000, // 2h
  STALENESS_RED_MS: 24 * 60 * 60 * 1000, // 24h

  // Aggregation / confidence
  DISAGREEMENT_PP: 0.15, // flag if abs(kalshi_p - poly_p) > 15pp
  CHAMPION_CROSS_CHECK_DELTA_PP: 0.1, // flag if derived_p_champion differs from market by >10pp
  VIG_TOLERANCE_PP: 0.05, // warn if kalshi_yes_a + kalshi_yes_b deviates from 1.0 by >5pp

  // External clients
  USER_AGENT: "PlayoffOddsBot/0.1 (+contact: sgajwani@gmail.com)",
  KALSHI_BASE: "https://api.elections.kalshi.com/trade-api/v2",
  POLYMARKET_GAMMA_BASE: "https://gamma-api.polymarket.com",
  POLYMARKET_CLOB_BASE: "https://clob.polymarket.com",
  KALSHI_SERIES_GAME: "KXIPLGAME",
  KALSHI_EVENT_CHAMPION: "KXIPL-26",
  POLYMARKET_EVENT_CHAMPION_SLUG: "2026-ipl-champion",
  POLYMARKET_PER_MATCH_SLUG_PREFIX: "cricipl-",
  CRICINFO_SERIES_URL:
    "https://www.espncricinfo.com/series/ipl-2026-1510719/points-table-standings",

  // Time
  IST_TZ: "Asia/Kolkata",

  // Cricinfo scrape retry budget (per snapshot tick)
  CRICINFO_MAX_RETRIES: 2,
  CRICINFO_RETRY_DELAY_MS: 3_000,
} as const;
