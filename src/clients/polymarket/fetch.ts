import { config } from "../../config.ts";
import { type ClientError, clientError } from "../../shared/errors.ts";
import { type Result, err, ok } from "../../shared/result.ts";
import { fetchJson } from "../base.ts";
import { ClobMidpoint, type PolyEventRaw, PolyEventsResponse } from "./schema.ts";

const validateEvents = (raw: unknown): Result<PolyEventRaw[], ClientError> => {
  const parsed = PolyEventsResponse.safeParse(raw);
  if (!parsed.success) {
    return err(
      clientError("polymarket", "schema_invalid", parsed.error.errors[0]?.message ?? "shape"),
    );
  }
  return ok(parsed.data);
};

export const fetchChampionEvent = async (): Promise<Result<PolyEventRaw[], ClientError>> => {
  const url = `${config.POLYMARKET_GAMMA_BASE}/events?slug=${config.POLYMARKET_EVENT_CHAMPION_SLUG}`;
  const r = await fetchJson<unknown>("polymarket", url);
  if (!r.ok) return r;
  return validateEvents(r.value);
};

export const fetchPerMatchEvents = async (): Promise<Result<PolyEventRaw[], ClientError>> => {
  // Cricket tag is broad — we filter by slug prefix afterward.
  const url = `${config.POLYMARKET_GAMMA_BASE}/events?tag_slug=cricket&closed=false&active=true&limit=100`;
  const r = await fetchJson<unknown>("polymarket", url);
  if (!r.ok) return r;
  const events = validateEvents(r.value);
  if (!events.ok) return events;
  const filtered = events.value.filter((e) =>
    e.slug.startsWith(config.POLYMARKET_PER_MATCH_SLUG_PREFIX),
  );
  return ok(filtered);
};

export const fetchMidpoint = async (tokenId: string): Promise<Result<number, ClientError>> => {
  const url = `${config.POLYMARKET_CLOB_BASE}/midpoint?token_id=${encodeURIComponent(tokenId)}`;
  const r = await fetchJson<unknown>("polymarket", url);
  if (!r.ok) return r;
  const parsed = ClobMidpoint.safeParse(r.value);
  if (!parsed.success) {
    return err(clientError("polymarket", "schema_invalid", "clob midpoint shape"));
  }
  return ok(parsed.data.mid);
};
