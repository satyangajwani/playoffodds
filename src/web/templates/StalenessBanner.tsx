import type { FC } from "hono/jsx";
import { ageHuman, istDateTime } from "../format.ts";
import type { PageVM } from "../view-model.ts";

interface Props {
  vm: PageVM;
}

const messages: Record<PageVM["staleness"], string> = {
  fresh: "Live — refreshed within the last 2 hours.",
  amber: "Data may be stale — last refresh failed or paused.",
  red: "Stale — no refresh in the last 24 hours.",
};

export const StalenessBanner: FC<Props> = ({ vm }) => {
  if (vm.isHistorical) {
    return (
      <div class="banner amber" role="status">
        <span class="banner-dot" aria-hidden="true" />
        <span>
          Viewing snapshot from <strong>{istDateTime(vm.takenAtUtc)}</strong> — page rendered as it
          was then.
        </span>
        <span class="right">
          <a href="/">← Back to live</a>
        </span>
      </div>
    );
  }
  return (
    <div class={`banner ${vm.staleness}`} role="status">
      <span class="banner-dot" aria-hidden="true" />
      <span>{messages[vm.staleness]}</span>
      <span class="right">Last refresh: {ageHuman(vm.ageMinutes)}</span>
    </div>
  );
};
