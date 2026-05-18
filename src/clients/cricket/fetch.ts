import { config } from "../../config.ts";
import { clientError, type ClientError } from "../../shared/errors.ts";
import { err, ok, type Result } from "../../shared/result.ts";

// Cricinfo blocks naive fetches. Send a real-browser-style UA and Accept-Language;
// scraping is fragile so this is best-effort with retries.
const browserHeaders = {
  "User-Agent": config.USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const fetchPointsTableHtml = async (
  url: string = config.CRICINFO_SERIES_URL,
): Promise<Result<string, ClientError>> => {
  for (let i = 0; i <= config.CRICINFO_MAX_RETRIES; i++) {
    try {
      const res = await fetch(url, { headers: browserHeaders });
      if (res.status === 429) {
        await sleep(config.CRICINFO_RETRY_DELAY_MS * (i + 1));
        continue;
      }
      if (res.status === 403) {
        return err(
          clientError("cricket", "auth", "cricinfo blocked us (403); try a fallback source", 403),
        );
      }
      if (!res.ok) {
        return err(clientError("cricket", "unknown", `HTTP ${res.status}`, res.status));
      }
      return ok(await res.text());
    } catch (e) {
      if (i === config.CRICINFO_MAX_RETRIES) {
        return err(clientError("cricket", "network", (e as Error).message));
      }
      await sleep(config.CRICINFO_RETRY_DELAY_MS);
    }
  }
  return err(clientError("cricket", "unknown", "retry budget exhausted"));
};
