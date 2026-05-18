// Branded primitives. Lifted from per-module convention so the matcher can join across venues
// without "stringly-typed" bugs (a Kalshi ticker is NOT a Polymarket slug).

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type TeamCode = Brand<string, "TeamCode">; // 'MI', 'CSK', 'RCB', ...
export type FixtureId = Brand<number, "FixtureId">; // 1..78 (74 league + 4 playoff stubs)
export type SnapshotId = Brand<string, "SnapshotId">; // UUIDv7
export type KalshiTicker = Brand<string, "KalshiTicker">; // 'KXIPLGAME-26MAY180600CSKSRH-CSK'
export type KalshiEventTicker = Brand<string, "KalshiEventTicker">; // 'KXIPL-26'
export type PolyEventSlug = Brand<string, "PolyEventSlug">; // '2026-ipl-champion' or 'cricipl-che-sun-2026-05-18'
export type PolyTokenId = Brand<string, "PolyTokenId">; // CLOB ERC-1155 token id
export type IsoUtc = Brand<string, "IsoUtc">; // ISO-8601 'YYYY-MM-DDTHH:MM:SSZ'
export type Probability = Brand<number, "Probability">; // clamped to [0,1]

// Constructor helpers (these are the ONLY blessed ways to mint a branded value)
export const teamCode = (s: string): TeamCode => s as TeamCode;
export const fixtureId = (n: number): FixtureId => n as FixtureId;
export const snapshotId = (s: string): SnapshotId => s as SnapshotId;
export const kalshiTicker = (s: string): KalshiTicker => s as KalshiTicker;
export const kalshiEventTicker = (s: string): KalshiEventTicker => s as KalshiEventTicker;
export const polyEventSlug = (s: string): PolyEventSlug => s as PolyEventSlug;
export const polyTokenId = (s: string): PolyTokenId => s as PolyTokenId;
export const isoUtc = (s: string): IsoUtc => s as IsoUtc;
export const probability = (n: number): Probability => {
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`probability out of range: ${n}`);
  }
  return n as Probability;
};
