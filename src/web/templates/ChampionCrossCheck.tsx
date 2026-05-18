import type { FC } from "hono/jsx";
import { pct } from "../format.ts";
import type { PageVM } from "../view-model.ts";

interface Props {
  vm: PageVM;
}

export const ChampionCrossCheck: FC<Props> = ({ vm }) => (
  <section class="cross">
    <h2>Champion: model vs market</h2>
    <table aria-label="Derived vs direct champion-market probability">
      <thead>
        <tr>
          <th class="team-col" scope="col">
            Team
          </th>
          <th scope="col">Our model</th>
          <th scope="col">Market avg</th>
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
