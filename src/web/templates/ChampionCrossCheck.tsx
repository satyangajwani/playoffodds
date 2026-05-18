import type { FC } from "hono/jsx";
import { pct } from "../format.ts";
import type { PageVM } from "../view-model.ts";

interface Props {
  vm: PageVM;
}

export const ChampionCrossCheck: FC<Props> = ({ vm }) => (
  <section class="cross">
    <h2>Two ways to estimate the champion</h2>
    <p class="cross-explainer">
      The <strong>Simulation</strong> column is built bottom-up: we average per-game prediction-market
      prices for each remaining match, then run 25,000 Monte Carlo simulations of the rest of the
      season (league games + playoff bracket) and count how often each team wins. The{" "}
      <strong>Direct market</strong> column reads the championship-winner contract price for each
      team directly. Differences over 10 percentage points are flagged — usually the model
      over-weights the bracket advantage that top-2 seeds get in Qualifier 1.
    </p>
    <table aria-label="Simulation vs direct champion-market probability">
      <thead>
        <tr>
          <th class="team-col" scope="col">
            Team
          </th>
          <th scope="col">Simulation</th>
          <th scope="col">Direct market</th>
          <th scope="col">Δ</th>
        </tr>
      </thead>
      <tbody>
        {vm.crossCheck
          .filter((c) => c.derived > 0.001 || c.market > 0.001)
          .map((c) => (
            <tr key={c.team}>
              <td class="team-col">{c.shortName}</td>
              <td>{pct(c.derived)}</td>
              <td>{pct(c.market)}</td>
              <td class={`delta ${c.flagged ? "warn" : ""}`}>
                {c.deltaPp >= 0 ? "+" : ""}
                {(c.deltaPp * 100).toFixed(1)} pp
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  </section>
);
