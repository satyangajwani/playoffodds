import type { FC } from "hono/jsx";

export const Footer: FC = () => (
  <footer>
    <p>
      Independent analysis. Not affiliated with Cricbuzz, Times Internet, or any IPL franchise.
      Probabilities derived via Monte Carlo simulation from public prediction-market prices (
      <a href="https://kalshi.com" rel="noopener">
        Kalshi
      </a>{" "}
      and{" "}
      <a href="https://polymarket.com" rel="noopener">
        Polymarket
      </a>
      ).
    </p>
    <p>
      Informational only. Not a betting offer. Not directed at residents of jurisdictions where
      prediction-market activity is restricted.
    </p>
  </footer>
);
