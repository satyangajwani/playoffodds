import { z } from "zod";

// Polymarket Gamma API shapes. Loose on purpose; many fields exist but we only consume a few.

export const PolyMarketRaw = z
  .object({
    id: z.union([z.string(), z.number()]).transform((x) => String(x)),
    slug: z.string(),
    question: z.string().optional(),
    outcomes: z.union([z.array(z.string()), z.string()]).optional(),
    outcomePrices: z.union([z.array(z.string()), z.string()]).optional(),
    clobTokenIds: z.union([z.array(z.string()), z.string()]).optional(),
    closed: z.boolean().optional(),
    active: z.boolean().optional(),
    volume: z.union([z.string(), z.number()]).nullable().optional(),
    liquidity: z.union([z.string(), z.number()]).nullable().optional(),
    endDate: z.string().optional(),
  })
  .passthrough();

export const PolyEventRaw = z
  .object({
    id: z.union([z.string(), z.number()]).transform((x) => String(x)),
    slug: z.string(),
    title: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    closed: z.boolean().optional(),
    active: z.boolean().optional(),
    tags: z.array(z.unknown()).optional(),
    markets: z.array(PolyMarketRaw).optional(),
  })
  .passthrough();

export const PolyEventsResponse = z.array(PolyEventRaw);

// CLOB midpoint response
export const ClobMidpoint = z.object({
  mid: z.union([z.string(), z.number()]).transform((x) => Number(x)),
});

export type PolyMarketRaw = z.infer<typeof PolyMarketRaw>;
export type PolyEventRaw = z.infer<typeof PolyEventRaw>;
export type PolyEventsResponse = z.infer<typeof PolyEventsResponse>;
