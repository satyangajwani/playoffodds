import { config } from "../../config.ts";
import { type ClientError, clientError } from "../../shared/errors.ts";
import { type Result, err, ok } from "../../shared/result.ts";
import { fetchJson } from "../base.ts";
import { type KalshiMarketRaw, KalshiMarketsResponse } from "./schema.ts";

const paged = async (url: string): Promise<Result<KalshiMarketRaw[], ClientError>> => {
  const out: KalshiMarketRaw[] = [];
  let cursor: string | undefined;
  // Cap pagination at 10 pages to bound runtime.
  for (let page = 0; page < 10; page++) {
    const u = cursor ? `${url}&cursor=${encodeURIComponent(cursor)}` : url;
    const r = await fetchJson<unknown>("kalshi", u);
    if (!r.ok) return r;
    const parsed = KalshiMarketsResponse.safeParse(r.value);
    if (!parsed.success) {
      return err(
        clientError("kalshi", "schema_invalid", parsed.error.errors[0]?.message ?? "shape"),
      );
    }
    out.push(...parsed.data.markets);
    if (!parsed.data.cursor) break;
    cursor = parsed.data.cursor;
  }
  return ok(out);
};

export const fetchGameMarkets = (): Promise<Result<KalshiMarketRaw[], ClientError>> =>
  paged(`${config.KALSHI_BASE}/markets?series_ticker=${config.KALSHI_SERIES_GAME}&limit=200`);

export const fetchChampionMarkets = (): Promise<Result<KalshiMarketRaw[], ClientError>> =>
  paged(`${config.KALSHI_BASE}/markets?event_ticker=${config.KALSHI_EVENT_CHAMPION}&limit=200`);
