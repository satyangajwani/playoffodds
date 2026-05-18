import type { FC } from "hono/jsx";
import { ageHuman, istDateTime } from "../format.ts";
import type { PageVM } from "../view-model.ts";

interface Props {
  vm: PageVM;
}

export const Hero: FC<Props> = ({ vm }) => (
  <header class="hero">
    <div class="dateline">
      IPL 2026
      <span class="sep">·</span>
      Snapshot {istDateTime(vm.takenAtUtc)}
      <span class="sep">·</span>
      Updated {ageHuman(vm.ageMinutes)}
    </div>
    <h1 class="headline">IPL Playoff Odds</h1>
    <p class="kicker">
      Live probability that each team makes the playoffs, finishes top 2, or wins the trophy.
      Recomputed every 10 minutes via 25,000-iteration Monte Carlo simulation over the
      remaining games.
    </p>
  </header>
);
