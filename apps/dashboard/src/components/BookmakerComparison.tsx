"use client";

import { useState, useMemo } from "react";
import type { OddsSnapshot, BookmakerOdds } from "@odds-collector/shared";
import { TIMING_ORDER } from "@odds-collector/shared";
import "@/styles/bookmaker-comparison.css";
import type { MarketKey } from "./MatchOddsAnalysis";
import { getMarketOutcomes } from "./MatchOddsAnalysis";

function formatSnapshotDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

const TIMING_LABELS: Record<string, string> = {
  t_minus_35d: "T-35d",
  t_minus_28d: "T-28d",
  t_minus_21d: "T-21d",
  t_minus_14d: "T-14d",
  opening: "Week Before",
  mid_week: "Mid Week",
  day_before: "Day Before",
  t_minus_4h: "T-4h",
  t_minus_90m: "T-90m",
  t_minus_60m: "T-60m",
  t_minus_30m: "T-30m",
  t_minus_15m: "T-15m",
  closing: "Closing",
};

type SortDirection = "asc" | "desc";
type DisplayMode = "odds" | "probability";

interface BookmakerComparisonProps {
  snapshots: Record<string, OddsSnapshot>;
  homeTeam: string;
  awayTeam: string;
  selectedMarket: MarketKey;
  selectedPoint?: number;
}

interface BookmakerRow {
  key: string;
  title: string;
  values: Record<string, number | null>;
  margin: number | null;
  totalProbability: number | null;
}

// Get odds for any market/outcome combination
function getOddsForMarket(
  bookmaker: BookmakerOdds,
  market: MarketKey,
  outcomeKey: string,
  homeTeam: string,
  awayTeam: string,
  point?: number
): number | null {
  const marketData = bookmaker.markets.find((m) => m.key === market);
  if (!marketData) return null;

  switch (market) {
    case "h2h": {
      if (outcomeKey === "draw") {
        return marketData.outcomes.find((o) => o.name === "Draw")?.price ?? null;
      }
      const teamName = outcomeKey === "home" ? homeTeam : awayTeam;
      const firstWord = teamName.toLowerCase().split(" ")[0];
      const teamOutcome = marketData.outcomes.find(
        (o) => o.name !== "Draw" && o.name.toLowerCase().includes(firstWord)
      );
      if (teamOutcome) return teamOutcome.price;
      const nonDraw = marketData.outcomes.filter((o) => o.name !== "Draw");
      if (nonDraw.length === 2) {
        return outcomeKey === "home" ? nonDraw[0]?.price ?? null : nonDraw[1]?.price ?? null;
      }
      return null;
    }

    case "btts": {
      const name = outcomeKey === "yes" ? "Yes" : "No";
      return marketData.outcomes.find((o) => o.name === name)?.price ?? null;
    }

    case "double_chance": {
      const homeFirst = homeTeam.split(" ")[0];
      const awayFirst = awayTeam.split(" ")[0];

      if (outcomeKey === "home_draw") {
        return marketData.outcomes.find(
          (o) => o.name.toLowerCase().includes(homeFirst.toLowerCase()) &&
                 o.name.toLowerCase().includes("draw")
        )?.price ?? null;
      }
      if (outcomeKey === "away_draw") {
        return marketData.outcomes.find(
          (o) => o.name.toLowerCase().includes(awayFirst.toLowerCase()) &&
                 o.name.toLowerCase().includes("draw")
        )?.price ?? null;
      }
      if (outcomeKey === "home_away") {
        return marketData.outcomes.find(
          (o) => o.name.toLowerCase().includes(homeFirst.toLowerCase()) &&
                 o.name.toLowerCase().includes(awayFirst.toLowerCase())
        )?.price ?? null;
      }
      return null;
    }

    case "alternate_totals": {
      if (point === undefined) return null;
      const name = outcomeKey === "over" ? "Over" : "Under";
      return marketData.outcomes.find(
        (o) => o.name === name && o.point === point
      )?.price ?? null;
    }

    case "alternate_spreads": {
      if (point === undefined) return null;
      const teamName = outcomeKey === "home" ? homeTeam : awayTeam;
      const firstWord = teamName.toLowerCase().split(" ")[0];
      return marketData.outcomes.find(
        (o) => o.name.toLowerCase().includes(firstWord) && o.point === point
      )?.price ?? null;
    }

    default:
      return null;
  }
}

function calculateMargin(values: Record<string, number | null>): number | null {
  const prices = Object.values(values).filter((v): v is number => v !== null);
  if (prices.length < 2) return null;
  const impliedProb = prices.reduce((sum, price) => sum + 1 / price, 0);
  const margin = (impliedProb - 1) * 100;
  return Math.round(margin * 100) / 100;
}

function calculateTotalProbability(values: Record<string, number | null>): number | null {
  const prices = Object.values(values).filter((v): v is number => v !== null);
  if (prices.length < 2) return null;
  const totalProb = prices.reduce((sum, price) => sum + (1 / price) * 100, 0);
  return Math.round(totalProb * 100) / 100;
}

function oddsToImpliedProbability(odds: number | null): number | null {
  if (odds === null) return null;
  return Math.round((1 / odds) * 10000) / 100; // 2 decimal places
}

export function BookmakerComparison({
  snapshots,
  homeTeam,
  awayTeam,
  selectedMarket,
  selectedPoint,
}: BookmakerComparisonProps) {
  const availableTimings = TIMING_ORDER.filter((t) => snapshots[t]);
  const [selectedTiming, setSelectedTiming] = useState<string>(
    availableTimings[availableTimings.length - 1] || "closing"
  );
  const [sortColumn, setSortColumn] = useState<string>("margin");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("odds");

  // Get outcomes for current market
  const outcomes = useMemo(
    () => getMarketOutcomes(selectedMarket, homeTeam, awayTeam),
    [selectedMarket, homeTeam, awayTeam]
  );

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      // Default: descending for odds (higher = better), ascending for margin (lower = better)
      setSortDirection(column === "margin" ? "asc" : "desc");
    }
  };

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
      const values: Record<string, number | null> = {};
      outcomes.forEach(({ key }) => {
        values[key] = getOddsForMarket(
          bookmaker,
          selectedMarket,
          key,
          homeTeam,
          awayTeam,
          selectedPoint
        );
      });
      return {
        key: bookmaker.key,
        title: bookmaker.title,
        values,
        margin: calculateMargin(values),
        totalProbability: calculateTotalProbability(values),
      };
    })
    .filter((row) => {
      // Filter out rows where all values are null
      const hasAnyValue = Object.values(row.values).some((v) => v !== null);
      return hasAnyValue;
    })
    .sort((a, b) => {
      if (sortColumn === "margin") {
        const aVal = a.margin ?? 100;
        const bVal = b.margin ?? 100;
        const multiplier = sortDirection === "asc" ? 1 : -1;
        return (aVal - bVal) * multiplier;
      }
      const aVal = a.values[sortColumn] ?? 0;
      const bVal = b.values[sortColumn] ?? 0;
      const multiplier = sortDirection === "asc" ? 1 : -1;
      return (aVal - bVal) * multiplier;
    });

  // Find best odds for each outcome
  const bestValues: Record<string, number> = {};
  outcomes.forEach(({ key }) => {
    bestValues[key] = Math.max(...rows.map((r) => r.values[key] ?? 0));
  });

  return (
    <div className="bookmaker-comparison">
      <div className="bookmaker-comparison__controls">
        <div className="bookmaker-comparison__timing-selector">
          {availableTimings.map((timing) => {
            const snapshot = snapshots[timing];
            const dateTitle = snapshot
              ? formatSnapshotDateTime(snapshot.metadata.timestamp)
              : undefined;
            return (
              <button
                key={timing}
                className={`bookmaker-comparison__timing-button ${
                  selectedTiming === timing
                    ? "bookmaker-comparison__timing-button--active"
                    : ""
                }`}
                onClick={() => setSelectedTiming(timing)}
                title={dateTitle}
              >
                {TIMING_LABELS[timing]}
              </button>
            );
          })}
        </div>

        <div className="bookmaker-comparison__display-toggle">
          <button
            className={`bookmaker-comparison__toggle-button ${
              displayMode === "odds" ? "bookmaker-comparison__toggle-button--active" : ""
            }`}
            onClick={() => setDisplayMode("odds")}
          >
            Odds
          </button>
          <button
            className={`bookmaker-comparison__toggle-button ${
              displayMode === "probability" ? "bookmaker-comparison__toggle-button--active" : ""
            }`}
            onClick={() => setDisplayMode("probability")}
          >
            Probability
          </button>
        </div>
      </div>

      <div className="bookmaker-comparison__table-wrapper">
        <table className="bookmaker-comparison__table">
          <thead>
            <tr>
              <th>Bookmaker</th>
              {outcomes.map(({ key, label }) => (
                <th
                  key={key}
                  className="bookmaker-comparison__sortable"
                  onClick={() => handleSort(key)}
                >
                  {label}
                  <span className={`bookmaker-comparison__sort-icon ${sortColumn === key ? "bookmaker-comparison__sort-icon--active" : ""}`}>
                    {sortColumn === key && sortDirection === "asc" ? "↑" : "↓"}
                  </span>
                </th>
              ))}
              <th
                className="bookmaker-comparison__sortable"
                onClick={() => handleSort("margin")}
                title={displayMode === "odds"
                  ? "Bookmaker's profit margin (lower = better value for bettors)"
                  : "Sum of implied probabilities (closer to 100% = lower margin)"}
              >
                {displayMode === "odds" ? "Margin" : "Total"}
                <span className={`bookmaker-comparison__sort-icon ${sortColumn === "margin" ? "bookmaker-comparison__sort-icon--active" : ""}`}>
                  {sortColumn === "margin" && sortDirection === "asc" ? "↑" : "↓"}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="bookmaker-comparison__bookmaker">{row.title}</td>
                {outcomes.map(({ key }) => {
                  const odds = row.values[key];
                  const probability = oddsToImpliedProbability(odds);
                  const displayValue = displayMode === "odds"
                    ? odds?.toFixed(2)
                    : probability !== null ? `${probability.toFixed(1)}%` : null;
                  const isBest = odds === bestValues[key];
                  return (
                    <td
                      key={key}
                      className={`bookmaker-comparison__odds ${
                        isBest ? "bookmaker-comparison__odds--best" : ""
                      }`}
                    >
                      {displayValue ?? "-"}
                    </td>
                  );
                })}
                <td className="bookmaker-comparison__margin">
                  {displayMode === "odds"
                    ? (row.margin !== null ? `${row.margin.toFixed(2)}%` : "-")
                    : (row.totalProbability !== null ? `${row.totalProbability.toFixed(1)}%` : "-")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
