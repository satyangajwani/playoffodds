import type { FC } from "hono/jsx";
import { pct } from "../format.ts";
import type { PageVM } from "../view-model.ts";

interface Props {
  vm: PageVM;
}

export const ProbabilityTable: FC<Props> = ({ vm }) => (
  <div class="table-wrap">
    <table class="prob" aria-label="IPL playoff probabilities by team">
      <thead>
        <tr>
          <th class="rank-col" scope="col">
            #
          </th>
          <th class="team-col" scope="col">
            Team
          </th>
          <th scope="col">Playoffs</th>
          <th scope="col">Top 2</th>
          <th scope="col">Champion</th>
        </tr>
      </thead>
      <tbody>
        {vm.rows.map((row, i) => (
          <tr key={row.code} style={`--p: ${Math.round(row.pPlayoffs * 100)}`}>
            <td class="rank" aria-label={`Rank ${i + 1}`}>
              {i + 1}
            </td>
            <td class="team">
              <span aria-label={row.fullName}>{row.shortName}</span>
              {row.status === "qualified" ? <span class="badge">Q</span> : null}
              {row.status === "eliminated" ? <span class="badge elim">Out</span> : null}
            </td>
            <td
              class={`num ${row.pPlayoffs < 0.001 ? "zero" : ""}`}
              aria-label={`Probability of playoffs ${pct(row.pPlayoffs)}`}
            >
              {pct(row.pPlayoffs)}
            </td>
            <td
              class={`num ${row.pTop2 < 0.001 ? "zero" : ""}`}
              aria-label={`Probability of top 2 ${pct(row.pTop2)}`}
            >
              {pct(row.pTop2)}
            </td>
            <td
              class={`num ${row.pChampion < 0.001 ? "zero" : ""}`}
              aria-label={`Probability of winning the championship ${pct(row.pChampion)}`}
            >
              {pct(row.pChampion)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
