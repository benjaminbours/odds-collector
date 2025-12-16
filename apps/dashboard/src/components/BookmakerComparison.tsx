"use client";

import { useState } from "react";
import type { OddsSnapshot, BookmakerOdds } from "@odds-collector/shared";
import "@/styles/bookmaker-comparison.css";

const TIMING_ORDER = ["opening", "mid_week", "day_before", "closing"];
const TIMING_LABELS: Record<string, string> = {
  opening: "Opening",
  mid_week: "Mid Week",
  day_before: "Day Before",
  closing: "Closing",
};

interface BookmakerComparisonProps {
  snapshots: Record<string, OddsSnapshot>;
  homeTeam: string;
  awayTeam: string;
}

interface BookmakerRow {
  key: string;
  title: string;
  home: number | null;
  draw: number | null;
  away: number | null;
  margin: number | null;
}

function getH2hOdds(
  bookmaker: BookmakerOdds,
  homeTeam: string,
  awayTeam: string
): {
  home: number | null;
  draw: number | null;
  away: number | null;
} {
  const h2hMarket = bookmaker.markets.find((m) => m.key === "h2h");
  if (!h2hMarket || h2hMarket.outcomes.length < 3) {
    return { home: null, draw: null, away: null };
  }

  // Find outcomes by name - API returns team names, not "Home"/"Away"
  const drawOutcome = h2hMarket.outcomes.find((o) => o.name === "Draw");
  const homeOutcome = h2hMarket.outcomes.find(
    (o) => o.name !== "Draw" && o.name.toLowerCase().includes(homeTeam.toLowerCase().split(" ")[0])
  );
  const awayOutcome = h2hMarket.outcomes.find(
    (o) => o.name !== "Draw" && o.name.toLowerCase().includes(awayTeam.toLowerCase().split(" ")[0])
  );

  // Fallback: if name matching fails, assume non-Draw outcomes are in order [team1, team2]
  // and match by comparing which team name is more similar
  if (!homeOutcome || !awayOutcome) {
    const nonDrawOutcomes = h2hMarket.outcomes.filter((o) => o.name !== "Draw");
    if (nonDrawOutcomes.length === 2) {
      return {
        home: nonDrawOutcomes[0]?.price ?? null,
        draw: drawOutcome?.price ?? null,
        away: nonDrawOutcomes[1]?.price ?? null,
      };
    }
  }

  return {
    home: homeOutcome?.price ?? null,
    draw: drawOutcome?.price ?? null,
    away: awayOutcome?.price ?? null,
  };
}

function calculateMargin(
  home: number | null,
  draw: number | null,
  away: number | null
): number | null {
  if (home === null || draw === null || away === null) return null;
  const margin = (1 / home + 1 / draw + 1 / away - 1) * 100;
  return Math.round(margin * 100) / 100;
}

export function BookmakerComparison({
  snapshots,
  homeTeam,
  awayTeam,
}: BookmakerComparisonProps) {
  const availableTimings = TIMING_ORDER.filter((t) => snapshots[t]);
  const [selectedTiming, setSelectedTiming] = useState<string>(
    availableTimings[availableTimings.length - 1] || "closing"
  );

  const currentSnapshot = snapshots[selectedTiming];

  if (!currentSnapshot) {
    return (
      <div className="bookmaker-comparison bookmaker-comparison--empty">
        <p>No snapshot data available</p>
      </div>
    );
  }

  // Build rows for each bookmaker
  const rows: BookmakerRow[] = currentSnapshot.odds.bookmakers
    .map((bookmaker) => {
      const odds = getH2hOdds(bookmaker, homeTeam, awayTeam);
      return {
        key: bookmaker.key,
        title: bookmaker.title,
        home: odds.home,
        draw: odds.draw,
        away: odds.away,
        margin: calculateMargin(odds.home, odds.draw, odds.away),
      };
    })
    .filter((row) => row.home !== null && row.draw !== null && row.away !== null)
    .sort((a, b) => (a.margin ?? 100) - (b.margin ?? 100));

  // Find best odds for each outcome
  const bestHome = Math.max(...rows.map((r) => r.home ?? 0));
  const bestDraw = Math.max(...rows.map((r) => r.draw ?? 0));
  const bestAway = Math.max(...rows.map((r) => r.away ?? 0));

  return (
    <div className="bookmaker-comparison">
      <div className="bookmaker-comparison__timing-selector">
        {availableTimings.map((timing) => (
          <button
            key={timing}
            className={`bookmaker-comparison__timing-button ${
              selectedTiming === timing
                ? "bookmaker-comparison__timing-button--active"
                : ""
            }`}
            onClick={() => setSelectedTiming(timing)}
          >
            {TIMING_LABELS[timing]}
          </button>
        ))}
      </div>

      <div className="bookmaker-comparison__table-wrapper">
        <table className="bookmaker-comparison__table">
          <thead>
            <tr>
              <th>Bookmaker</th>
              <th>Home</th>
              <th>Draw</th>
              <th>Away</th>
              <th title="Bookmaker's profit margin (lower = better value for bettors)">
                Margin ⓘ
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="bookmaker-comparison__bookmaker">{row.title}</td>
                <td
                  className={`bookmaker-comparison__odds ${
                    row.home === bestHome
                      ? "bookmaker-comparison__odds--best"
                      : ""
                  }`}
                >
                  {row.home?.toFixed(2) ?? "-"}
                </td>
                <td
                  className={`bookmaker-comparison__odds ${
                    row.draw === bestDraw
                      ? "bookmaker-comparison__odds--best"
                      : ""
                  }`}
                >
                  {row.draw?.toFixed(2) ?? "-"}
                </td>
                <td
                  className={`bookmaker-comparison__odds ${
                    row.away === bestAway
                      ? "bookmaker-comparison__odds--best"
                      : ""
                  }`}
                >
                  {row.away?.toFixed(2) ?? "-"}
                </td>
                <td className="bookmaker-comparison__margin">
                  {row.margin?.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
