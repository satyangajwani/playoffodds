import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { config } from "../config.ts";
import { isoUtc, type IsoUtc } from "../domain/ids.ts";

// Canonical fixture key: date in IST (so a 7:30pm match doesn't straddle a date boundary).
export const fixtureKeyDate = (utc: IsoUtc): string =>
  formatInTimeZone(new Date(utc), config.IST_TZ, "yyyy-MM-dd");

// IST clock-time string for display ("18:00 IST")
export const istClock = (utc: IsoUtc): string =>
  formatInTimeZone(new Date(utc), config.IST_TZ, "HH:mm");

export const istWallToUtc = (istIso: string): IsoUtc =>
  isoUtc(fromZonedTime(istIso, config.IST_TZ).toISOString());

export const nowUtc = (): IsoUtc => isoUtc(new Date().toISOString());
