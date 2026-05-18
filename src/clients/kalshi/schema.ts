import { z } from "zod";

// Kalshi market shape per docs.kalshi.com/api-reference/market/get-markets
// Only the fields we use are required; everything else is permitted but ignored.
export const KalshiMarketRaw = z
  .object({
    ticker: z.string(),
    event_ticker: z.string().optional(),
    title: z.string(),
    status: z.enum(["unopened", "open", "paused", "closed", "settled"]),
    yes_bid_dollars: z.number().nullable().optional(),
    yes_ask_dollars: z.number().nullable().optional(),
    last_price_dollars: z.number().nullable().optional(),
    volume_fp: z.number().nullable().optional(),
    expected_expiration_time: z.string().optional(),
    occurrence_datetime: z.string().optional(),
    settlement_value: z.number().nullable().optional(),
    result: z.string().nullable().optional(),
  })
  .passthrough();

export const KalshiMarketsResponse = z.object({
  markets: z.array(KalshiMarketRaw),
  cursor: z.string().optional(),
});

export type KalshiMarketRaw = z.infer<typeof KalshiMarketRaw>;
export type KalshiMarketsResponse = z.infer<typeof KalshiMarketsResponse>;
