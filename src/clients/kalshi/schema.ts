import { z } from "zod";

// Kalshi market shape per docs.kalshi.com/api-reference/market/get-markets
// Only the fields we use are required; everything else is permitted but ignored.
// Numeric fields are sometimes serialized as strings — coerce defensively.
const numLike = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === "string" ? Number.parseFloat(v) : v;
    return Number.isFinite(n) ? n : null;
  });

export const KalshiMarketRaw = z
  .object({
    ticker: z.string(),
    event_ticker: z.string().optional(),
    title: z.string(),
    // Docs list unopened|open|paused|closed|settled but the live API also returns
    // 'active' and may add more states. Accept any string and let parse.ts key off
    // the documented values (only 'settled' is load-bearing).
    status: z.string(),
    yes_bid_dollars: numLike,
    yes_ask_dollars: numLike,
    last_price_dollars: numLike,
    volume_fp: numLike,
    expected_expiration_time: z.string().optional(),
    occurrence_datetime: z.string().optional(),
    settlement_value: numLike,
    result: z.string().nullable().optional(),
  })
  .passthrough();

export const KalshiMarketsResponse = z.object({
  markets: z.array(KalshiMarketRaw),
  cursor: z.string().optional(),
});

// `z.infer` is the *output* (post-transform) type. `z.input` is what the caller hands in.
// We expose the output type to consumers (post-coercion, predictable shape).
export type KalshiMarketRaw = z.infer<typeof KalshiMarketRaw>;
export type KalshiMarketInput = z.input<typeof KalshiMarketRaw>;
export type KalshiMarketsResponse = z.infer<typeof KalshiMarketsResponse>;
