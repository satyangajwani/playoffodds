// Display formatting helpers — used in templates + OG image. Pure functions.

import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

export const pct = (p: number, decimals = 1): string => {
  if (!Number.isFinite(p)) return "—";
  if (p <= 0.0005) return "0.0%";
  if (p >= 0.9995) return "100%";
  return `${(p * 100).toFixed(decimals)}%`;
};

export const istDateTime = (utc: string): string =>
  formatInTimeZone(new Date(utc), IST, "MMM d, h:mm a 'IST'");

export const istDateLong = (utc: string): string =>
  formatInTimeZone(new Date(utc), IST, "EEEE, MMMM d, yyyy");

export const istClock = (utc: string): string => formatInTimeZone(new Date(utc), IST, "h:mm a");

// Format an age (minutes) as a humanized "x ago" string.
export const ageHuman = (minutes: number): string => {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

// For path-style time-travel URLs: 2026-05-12T1830
export const ttPath = (utc: string): string => {
  const d = new Date(utc);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}${mi}`;
};

// Parse /at/:ts route param back to a strict ISO UTC string. Returns null on invalid input.
const TT_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?Z?$/;
export const parseTtParam = (raw: string): string | null => {
  if (raw.length > 32) return null;
  const m = raw.match(TT_RE);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  if (!y || !mo || !d) return null;
  const ms = Date.UTC(
    Number.parseInt(y, 10),
    Number.parseInt(mo, 10) - 1,
    Number.parseInt(d, 10),
    Number.parseInt(h, 10),
    Number.parseInt(mi, 10),
    Number.parseInt(s, 10),
  );
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
};
