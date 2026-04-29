"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { OddsSnapshot, BookmakerOdds } from "@odds-collector/shared";
import { TIMING_ORDER } from "@odds-collector/shared";
import "@/styles/odds-chart.css";

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


// Key bookmakers to show by default (sharp bookmakers)
const KEY_BOOKMAKERS = ["pinnacle", "betfair_ex_uk", "bet365", "williamhill"];

const BOOKMAKER_COLORS: Record<string, string> = {
  pinnacle: "#22c55e",
  betfair_ex_uk: "#f59e0b",
  bet365: "#3b82f6",
  williamhill: "#8b5cf6",
  betway: "#ec4899",
  unibet_eu: "#06b6d4",
  matchbook: "#14b8a6",
  betsson: "#f43f5e",
  default: "#6b7280",
};

const BOOKMAKER_LABELS: Record<string, string> = {
  pinnacle: "Pinnacle",
  betfair_ex_uk: "Betfair",
  bet365: "bet365",
  williamhill: "William Hill",
  betway: "Betway",
  unibet_eu: "Unibet",
  matchbook: "Matchbook",
  betsson: "Betsson",
};

interface OddsChartProps {
  snapshots: Record<string, OddsSnapshot>;
  outcome: "home" | "draw" | "away";
  title: string;
  homeTeam: string;
  awayTeam: string;
}

function getOddsForOutcome(
  bookmaker: BookmakerOdds,
  outcome: "home" | "draw" | "away",
  homeTeam: string,
  awayTeam: string
): number | null {
  const h2hMarket = bookmaker.markets.find((m) => m.key === "h2h");
  if (!h2hMarket) return null;

  // Try to find by outcome name
  if (outcome === "draw") {
    const drawOutcome = h2hMarket.outcomes.find((o) => o.name === "Draw");
    return drawOutcome?.price ?? null;
  }

  // For home/away, match by team name - API returns actual team names
  const teamName = outcome === "home" ? homeTeam : awayTeam;
  const firstWord = teamName.toLowerCase().split(" ")[0];

  const teamOutcome = h2hMarket.outcomes.find(
    (o) => o.name !== "Draw" && o.name.toLowerCase().includes(firstWord)
  );

  if (teamOutcome) {
    return teamOutcome.price;
  }

  // Fallback: if name matching fails, use position-based lookup for non-Draw outcomes
  const nonDrawOutcomes = h2hMarket.outcomes.filter((o) => o.name !== "Draw");
  if (nonDrawOutcomes.length === 2) {
    return outcome === "home"
      ? nonDrawOutcomes[0]?.price ?? null
      : nonDrawOutcomes[1]?.price ?? null;
  }

  return null;
}

export function OddsChart({
  snapshots,
  outcome,
  title,
  homeTeam,
  awayTeam,
}: OddsChartProps) {
  const [showAllBookmakers, setShowAllBookmakers] = useState(false);

  // Get all bookmakers across all snapshots
  const allBookmakers = new Set<string>();
  Object.values(snapshots).forEach((snapshot) => {
    snapshot.odds.bookmakers.forEach((b) => {
      allBookmakers.add(b.key);
    });
  });

  // Filter to key bookmakers or all
  const availableKeyBookmakers = KEY_BOOKMAKERS.filter((b) =>
    allBookmakers.has(b)
  );
  const otherBookmakers = Array.from(allBookmakers)
    .filter((b) => !KEY_BOOKMAKERS.includes(b))
    .sort();

  const displayedBookmakers = showAllBookmakers
    ? [...availableKeyBookmakers, ...otherBookmakers]
    : availableKeyBookmakers;

  // Build data for chart
  const chartData = TIMING_ORDER.filter((timing) => snapshots[timing]).map(
    (timing) => {
      const snapshot = snapshots[timing];
      const dataPoint: Record<string, string | number | null> = {
        timing: TIMING_LABELS[timing],
      };

      snapshot.odds.bookmakers.forEach((bookmaker) => {
        const odds = getOddsForOutcome(bookmaker, outcome, homeTeam, awayTeam);
        dataPoint[bookmaker.key] = odds;
      });

      return dataPoint;
    }
  );

  if (chartData.length === 0) {
    return (
      <div className="odds-chart odds-chart--empty">
        <h3 className="odds-chart__title">{title}</h3>
        <p className="odds-chart__empty-message">No data available</p>
      </div>
    );
  }

  return (
    <div className="odds-chart">
      <div className="odds-chart__header">
        <h3 className="odds-chart__title">{title}</h3>
        {otherBookmakers.length > 0 && (
          <button
            className="odds-chart__toggle"
            onClick={() => setShowAllBookmakers(!showAllBookmakers)}
          >
            {showAllBookmakers
              ? "Show key only"
              : `+${otherBookmakers.length} more`}
          </button>
        )}
      </div>
      <div className="odds-chart__container">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="timing"
              stroke="#9ca3af"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={11}
              domain={["auto", "auto"]}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#f9fafb", marginBottom: "4px" }}
              itemStyle={{ color: "#d1d5db", padding: "2px 0" }}
              formatter={(value: number, name: string) => [
                value?.toFixed(2),
                BOOKMAKER_LABELS[name] || name,
              ]}
            />
            {displayedBookmakers.map((bookmaker) => {
              const color =
                BOOKMAKER_COLORS[bookmaker] || BOOKMAKER_COLORS.default;
              const isKey = KEY_BOOKMAKERS.includes(bookmaker);

              return (
                <Line
                  key={bookmaker}
                  type="monotone"
                  dataKey={bookmaker}
                  stroke={color}
                  strokeWidth={isKey ? 2.5 : 1.5}
                  strokeDasharray={isKey ? undefined : "4 4"}
                  dot={{ fill: color, strokeWidth: 0, r: isKey ? 4 : 3 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="odds-chart__legend">
        {displayedBookmakers.map((bookmaker) => {
          const color =
            BOOKMAKER_COLORS[bookmaker] || BOOKMAKER_COLORS.default;
          const isKey = KEY_BOOKMAKERS.includes(bookmaker);
          return (
            <div key={bookmaker} className="odds-chart__legend-item">
              <span
                className="odds-chart__legend-line"
                style={{
                  backgroundColor: color,
                  height: isKey ? "3px" : "2px",
                }}
              />
              <span className="odds-chart__legend-label">
                {BOOKMAKER_LABELS[bookmaker] || bookmaker}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
