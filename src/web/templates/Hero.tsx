import type { FC } from "hono/jsx";
import { ageHuman, istDateTime } from "../format.ts";
import type { PageVM } from "../view-model.ts";

interface Props {
  vm: PageVM;
}

export const Hero: FC<Props> = ({ vm }) => {
  const leader = vm.rows[0];
  return (
    <header class="hero">
      <div class="dateline">
        IPL 2026
        <span class="sep">·</span>
        Snapshot {istDateTime(vm.takenAtUtc)}
        <span class="sep">·</span>
        Updated {ageHuman(vm.ageMinutes)}
      </div>
      <h1 class="headline">
        {leader ? (
          <>
            <em>{leader.shortName}</em> to win IPL 2026?
          </>
        ) : (
          <>Who wins IPL 2026?</>
        )}
      </h1>
      <p class="kicker">
        Playoff probabilities derived from live prediction markets (Kalshi + Polymarket), recomputed
        every 10 minutes via 25,000-iteration Monte Carlo simulation.
      </p>
    </header>
  );
};
