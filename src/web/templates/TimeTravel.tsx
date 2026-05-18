import type { FC } from "hono/jsx";
import { ttPath } from "../format.ts";

interface PillSpec {
  label: string;
  href: string;
}

interface Props {
  isHistorical: boolean;
  takenAtUtc: string;
}

const hoursAgo = (h: number, now: number = Date.now()) =>
  ttPath(new Date(now - h * 3600_000).toISOString());

export const TimeTravel: FC<Props> = ({ isHistorical }) => {
  const now = Date.now();
  const pills: PillSpec[] = [
    { label: "Now", href: "/" },
    { label: "1h ago", href: `/at/${hoursAgo(1, now)}` },
    { label: "Yesterday", href: `/at/${hoursAgo(24, now)}` },
    { label: "2 days ago", href: `/at/${hoursAgo(48, now)}` },
    { label: "Season start", href: "/at/2026-03-22T1430" },
  ];
  return (
    <nav class="tt" aria-label="Time travel">
      <span class="tt-label">Travel</span>
      {pills.map((p) => (
        <a
          key={p.label}
          class={`tt-pill ${!isHistorical && p.label === "Now" ? "active" : ""}`}
          href={p.href}
          rel={p.label === "Now" ? "canonical" : undefined}
        >
          {p.label}
        </a>
      ))}
      <form action="/at/" method="get">
        <input type="date" name="d" required min="2026-03-22" />
        <button type="submit">Go</button>
      </form>
      {isHistorical ? (
        <a href="/" class="tt-pill back-to-live">
          ← Back to live
        </a>
      ) : null}
    </nav>
  );
};
