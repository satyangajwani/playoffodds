// Typed error enums per client. Kept narrow on purpose.

export type ClientErrorKind =
  | "network"
  | "schema_invalid"
  | "rate_limited"
  | "not_found"
  | "auth"
  | "unknown";

export interface ClientError {
  kind: ClientErrorKind;
  source: "kalshi" | "polymarket" | "cricket";
  detail: string;
  status?: number;
}

export const clientError = (
  source: ClientError["source"],
  kind: ClientErrorKind,
  detail: string,
  status?: number,
): ClientError => ({ source, kind, detail, ...(status !== undefined && { status }) });
