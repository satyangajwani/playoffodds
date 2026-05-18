// Pull the upcoming-fixtures view from Kalshi + Polymarket and print a side-by-side
// comparison. Useful for catching drift between our seeded fixtures and reality.
import { fetchGameMarkets } from "../src/clients/kalshi/fetch.ts";
import { parseGameMarket } from "../src/clients/kalshi/parse.ts";
import { fetchPerMatchEvents } from "../src/clients/polymarket/fetch.ts";
import { parsePerMatchEvent } from "../src/clients/polymarket/parse.ts";

async function main() {
  const k = await fetchGameMarkets();
  if (!k.ok) {
    console.error("kalshi failed:", k.error);
    return;
  }
  const kGames = k.value.map(parseGameMarket).filter((m): m is NonNullable<typeof m> => m !== null);
  const kFixtures = new Map<string, { date: string; pair: string; status: string }>();
  for (const g of kGames) {
    const day = g.startUtc.slice(0, 10);
    const pair = [g.yesSideTeamCode, g.pairedTeamCode].sort().join(" vs ");
    kFixtures.set(`${day}|${pair}`, { date: day, pair, status: g.status });
  }
  console.log("=== KALSHI (unique fixtures) ===");
  for (const f of Array.from(kFixtures.values()).sort((a, b) => a.date.localeCompare(b.date))) {
    console.log(`  ${f.date}  ${f.pair.padEnd(14)}  ${f.status}`);
  }

  const p = await fetchPerMatchEvents();
  if (!p.ok) {
    console.error("polymarket failed:", p.error);
    return;
  }
  console.log("\n=== POLYMARKET per-match events ===");
  const pGames = p.value
    .map(parsePerMatchEvent)
    .filter((m): m is NonNullable<typeof m> => m !== null);
  for (const g of pGames.sort((a, b) => a.dateUtc.localeCompare(b.dateUtc))) {
    console.log(`  ${g.dateUtc.slice(0, 10)}  ${g.teamARaw} vs ${g.teamBRaw}`);
  }
}

main();
