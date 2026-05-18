# IPL Playoff Odds

**Live tracker:** [https://playoffodds.dayprism.workers.dev](https://playoffodds.dayprism.workers.dev)

## TL;DR

A live page showing each IPL 2026 team's probability of making the playoffs (top 4),
finishing top 2 (Qualifier 1 advantage), and winning the championship. Refreshed every
10 minutes from public prediction markets. Includes a time-travel feature so you can see
how the picture looked 1 hour, 1 day, or any past point in time.

## What you're looking at

Three probabilities per team:

| Column | Meaning |
|---|---|
| **Playoffs** | Probability the team finishes top 4 and reaches the playoff bracket |
| **Top 2** | Probability the team finishes 1st or 2nd (gets the bracket advantage) |
| **Champion** | Probability the team wins the IPL final |

Below the main table is a smaller section — **"Two ways to estimate the champion"** —
that shows the same championship number computed two different ways. More on that below.

## How the numbers are produced

Every 10 minutes the system:

1. **Pulls per-match prices** from two prediction markets (Kalshi and Polymarket) for
   every remaining IPL game. Each market is a "Will Team X beat Team Y?" contract whose
   price implies a probability.
2. **Averages the two venues** to get one win probability per remaining match.
3. **Runs 25,000 Monte Carlo simulations** of the rest of the season:
   - In each simulation: sample winners for all remaining league games using those
     per-match probabilities
   - Compute final standings (with Net Run Rate tie-breaker)
   - Take top 4 → simulate the playoff bracket (Q1, Eliminator, Q2, Final)
   - Record who wins the championship
4. **Tallies** the fraction of simulations where each team made the playoffs / finished
   top 2 / won the championship. Those are the displayed probabilities.

The simulation is **fully deterministic given the inputs**: identical market prices always
produce identical probabilities. This matters because it means probability changes between
two snapshots reflect *changes in the market*, not simulation noise.

## Why two champion estimates?

This is the cross-check that gives you transparency into the methodology.

| | What it is |
|---|---|
| **Simulation** | Built bottom-up. We average per-match prices, simulate the season 25,000 times, and count how often each team wins. |
| **Direct market** | The price of a single championship-winner contract for each team, averaged across both venues. Reads directly what bettors believe. |

These two estimates use different inputs and different aggregations. When they disagree
by more than **10 percentage points** (the Δ column flags it in amber), it's a signal —
usually that the model is over-weighting the structural advantage that top-2 seeds get
from the playoff bracket (the Qualifier 1 winner goes straight to the final and gets a
"second chance" via Q2 if they lose Q1).

**Today's flag:** RCB at 46% simulation vs 36% direct market = +10pp. That gap is a known
bias from the current bracket-strength model. Phase 2 work (full Bradley-Terry fit) will
tighten this.

We show both columns so you can see when the model has a strong opinion vs. when it's
just mirroring market consensus.

## Time travel

Append a timestamp to the URL to see the page as it appeared then:

- [/at/2026-05-18T1500](https://playoffodds.dayprism.workers.dev/at/2026-05-18T1500) — 3 PM IST today
- Quick-pills above the table cover the common cases: 1 hour ago / yesterday / season start

Every 10-minute snapshot is preserved, so you can scrub back to catch the story:
"RCB's champion probability jumped from 40% to 46% after they beat SRH on May 22."

## Sanity checks that pass

- **Probabilities sum correctly.** Across all 10 teams: Playoffs=4.00, Top 2=2.00,
  Champion=1.00 exactly.
- **Eliminated teams show 0%.** Mumbai and Lucknow are mathematically out of contention
  on May 18 and the model reflects that.
- **Qualified teams show 100%.** RCB clinched playoffs on May 17 and the model reflects
  that too.

## What's deliberately simplified (and on the roadmap)

| Area | Current state | Roadmap |
|---|---|---|
| Playoff-bracket strength model | Simple blend of regular-season win rates + championship-market prices | Full Bradley-Terry fit (closes the +10pp RCB gap) |
| Net Run Rate simulation | Small calibrated random walk per simulated game | Bootstrap from this season's actual game margins |
| Standings input | Anchored to May 18, 2026 known-good seed | Live scrape from ESPNcricinfo completed results |
| Historical depth | Snapshots from May 18, 2026 forward | Backfill every 10 min from season start (Mar 22, 2026) |

These are tracked; nothing is broken — just room to tighten.

## Where the data comes from

Two public prediction markets:
- **Kalshi** — US-regulated, CFTC-approved, IPL markets via the `KXIPLGAME` (per-match)
  and `KXIPL-26` (champion) series
- **Polymarket** — global crypto-based, IPL markets via the `cricipl-*` per-match events
  and the `2026-ipl-champion` event

Both venues' prices are read from their public APIs, no authentication required.

## How to share

- **Public link:** `https://playoffodds.dayprism.workers.dev`
- **Embed-friendly version** (no chrome, ready for iframe):
  `https://playoffodds.dayprism.workers.dev/embed`
- **JSON for integrations:** `https://playoffodds.dayprism.workers.dev/api/snapshot`
  (CORS open)
- **Slack/Twitter previews** auto-generate an OG image showing the top 6 teams and the
  snapshot time.

## Disclaimers

This is informational only and not a betting product. Prediction-market data is publicly
available; the page just aggregates and visualizes it. The page is built independently and
not affiliated with any cricket franchise or media organization.

---

Questions, suggestions, or "why does my team's number look wrong?" → @satyan.
