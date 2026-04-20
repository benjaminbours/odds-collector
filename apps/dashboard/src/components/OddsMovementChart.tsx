"use client";

import { useState, useMemo } from "react";
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
import "@/styles/odds-movement-chart.css";

const TIMING_ORDER = [
  "opening",
  "mid_week",
  "day_before",
  "t_minus_4h",
  "t_minus_90m",
  "t_minus_30m",
  "closing",
];
const TIMING_LABELS: Record<string, string> = {
  opening: "Week Before",
  mid_week: "Mid Week",
  day_before: "Day Before",
  t_minus_4h: "T-4h",
  t_minus_90m: "T-90m",
  t_minus_30m: "T-30m",
  closing: "Closing",
};

// Bookmaker categories
const SHARP_BOOKMAKERS = ["pinnacle", "betfair_ex_uk", "matchbook"];
const MAJOR_BOOKMAKERS = ["bet365", "williamhill", "unibet", "betway"];

const BOOKMAKER_COLORS: Record<string, string> = {
  pinnacle: "#22c55e",
  betfair_ex_uk: "#f59e0b",
  bet365: "#3b82f6",
  williamhill: "#8b5cf6",
  betway: "#ec4899",
  unibet: "#06b6d4",
  matchbook: "#14b8a6",
  betsson: "#f43f5e",
};

const BOOKMAKER_LABELS: Record<string, string> = {
  pinnacle: "Pinnacle",
  betfair_ex_uk: "Betfair",
  bet365: "bet365",
  williamhill: "William Hill",
  betway: "Betway",
  unibet: "Unibet",
  matchbook: "Matchbook",
  betsson: "Betsson",
};

// Market configuration
type MarketKey = "h2h" | "btts" | "double_chance" | "alternate_totals" | "alternate_spreads";

interface MarketConfig {
  key: MarketKey;
  label: string;
  hasPoints: boolean;
}

const MARKETS: MarketConfig[] = [
  { key: "h2h", label: "Money Line", hasPoints: false },
  { key: "btts", label: "Both Teams to Score", hasPoints: false },
  { key: "double_chance", label: "Double Chance", hasPoints: false },
  { key: "alternate_totals", label: "Over/Under", hasPoints: true },
  { key: "alternate_spreads", label: "Spread", hasPoints: true },
];

function getColor(bookmaker: string, index: number): string {
  if (BOOKMAKER_COLORS[bookmaker]) return BOOKMAKER_COLORS[bookmaker];
  const hue = (index * 137.5) % 360;
  return `hsl(${hue}, 50%, 50%)`;
}

function getLabel(bookmaker: string): string {
  return BOOKMAKER_LABELS[bookmaker] || bookmaker.replace(/_/g, " ");
}

interface OddsMovementChartProps {
  snapshots: Record<string, OddsSnapshot>;
  homeTeam: string;
  awayTeam: string;
  selectedMarket: MarketKey;
  selectedPoint?: number;
}

// Get outcomes for a market
function getMarketOutcomes(
  market: MarketKey,
  homeTeam: string,
  awayTeam: string
): { key: string; label: string }[] {
  switch (market) {
    case "h2h":
      return [
        { key: "home", label: homeTeam },
        { key: "draw", label: "Draw" },
        { key: "away", label: awayTeam },
      ];
    case "btts":
      return [
        { key: "yes", label: "Yes" },
        { key: "no", label: "No" },
      ];
    case "double_chance":
      return [
        { key: "home_draw", label: `${homeTeam} or Draw` },
        { key: "away_draw", label: `${awayTeam} or Draw` },
        { key: "home_away", label: `${homeTeam} or ${awayTeam}` },
      ];
    case "alternate_totals":
      return [
        { key: "over", label: "Over" },
        { key: "under", label: "Under" },
      ];
    case "alternate_spreads":
      return [
        { key: "home", label: homeTeam },
        { key: "away", label: awayTeam },
      ];
    default:
      return [];
  }
}

// Get available points for totals/spreads markets
function getAvailablePoints(
  snapshots: Record<string, OddsSnapshot>,
  market: MarketKey
): number[] {
  const points = new Set<number>();

  Object.values(snapshots).forEach((snapshot) => {
    snapshot.odds.bookmakers.forEach((bookmaker) => {
      const marketData = bookmaker.markets.find((m) => m.key === market);
      if (marketData) {
        marketData.outcomes.forEach((outcome) => {
          if (outcome.point !== undefined) {
            points.add(outcome.point);
          }
        });
      }
    });
  });

  return Array.from(points).sort((a, b) => a - b);
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
      // Fallback
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

export function OddsMovementChart({
  snapshots,
  homeTeam,
  awayTeam,
  selectedMarket,
  selectedPoint,
}: OddsMovementChartProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<string>("home");
  const [selectedBookmakers, setSelectedBookmakers] = useState<Set<string>>(
    () => new Set([...SHARP_BOOKMAKERS, ...MAJOR_BOOKMAKERS])
  );
  const [showBookmakerPanel, setShowBookmakerPanel] = useState(false);

  // Get all bookmakers across all snapshots
  const allBookmakers = useMemo(() => {
    const bookmakers = new Set<string>();
    Object.values(snapshots).forEach((snapshot) => {
      snapshot.odds.bookmakers.forEach((b) => {
        bookmakers.add(b.key);
      });
    });
    return bookmakers;
  }, [snapshots]);

  // Get outcomes for current market
  const outcomes = getMarketOutcomes(selectedMarket, homeTeam, awayTeam);

  // Reset outcome when market changes (if current outcome is not valid for new market)
  const validOutcome = outcomes.find((o) => o.key === selectedOutcome);
  const effectiveOutcome = validOutcome ? selectedOutcome : outcomes[0]?.key ?? "home";

  // Categorize bookmakers
  const sharpAvailable = SHARP_BOOKMAKERS.filter((b) => allBookmakers.has(b));
  const majorAvailable = MAJOR_BOOKMAKERS.filter((b) => allBookmakers.has(b));
  const otherAvailable = Array.from(allBookmakers)
    .filter((b) => !SHARP_BOOKMAKERS.includes(b) && !MAJOR_BOOKMAKERS.includes(b))
    .sort();

  const toggleBookmaker = (bookmaker: string) => {
    const newSet = new Set(selectedBookmakers);
    if (newSet.has(bookmaker)) {
      newSet.delete(bookmaker);
    } else {
      newSet.add(bookmaker);
    }
    setSelectedBookmakers(newSet);
  };

  const selectCategory = (category: "sharp" | "major" | "all" | "none") => {
    if (category === "none") {
      setSelectedBookmakers(new Set());
    } else if (category === "sharp") {
      setSelectedBookmakers(new Set(sharpAvailable));
    } else if (category === "major") {
      setSelectedBookmakers(new Set([...sharpAvailable, ...majorAvailable]));
    } else {
      setSelectedBookmakers(new Set(allBookmakers));
    }
  };

  // Build chart data
  const chartData = TIMING_ORDER.filter((timing) => snapshots[timing]).map(
    (timing) => {
      const snapshot = snapshots[timing];
      const dataPoint: Record<string, string | number | null> = {
        timing: TIMING_LABELS[timing],
      };

      snapshot.odds.bookmakers.forEach((bookmaker) => {
        if (selectedBookmakers.has(bookmaker.key)) {
          const odds = getOddsForMarket(
            bookmaker,
            selectedMarket,
            effectiveOutcome,
            homeTeam,
            awayTeam,
            selectedPoint
          );
          dataPoint[bookmaker.key] = odds;
        }
      });

      return dataPoint;
    }
  );

  const displayedBookmakers = Array.from(selectedBookmakers).filter((b) =>
    allBookmakers.has(b)
  );

  if (chartData.length === 0) {
    return (
      <div className="odds-movement odds-movement--empty">
        <p>No odds data available</p>
      </div>
    );
  }

  return (
    <div className="odds-movement">
      {/* Outcome tabs */}
      <div className="odds-movement__outcomes">
        {outcomes.map(({ key, label }) => (
          <button
            key={key}
            className={`odds-movement__outcome ${
              effectiveOutcome === key ? "odds-movement__outcome--active" : ""
            }`}
            onClick={() => setSelectedOutcome(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="odds-movement__chart">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="timing"
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              domain={["auto", "auto"]}
              tickLine={false}
              axisLine={false}
              width={45}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              labelStyle={{ color: "#f9fafb", marginBottom: "8px", fontWeight: 600 }}
              itemStyle={{ color: "#d1d5db", padding: "2px 0" }}
              formatter={(value: number, name: string) => [
                value?.toFixed(2),
                getLabel(name),
              ]}
            />
            {displayedBookmakers.map((bookmaker, index) => {
              const isSharp = SHARP_BOOKMAKERS.includes(bookmaker);
              return (
                <Line
                  key={bookmaker}
                  type="monotone"
                  dataKey={bookmaker}
                  stroke={getColor(bookmaker, index)}
                  strokeWidth={isSharp ? 2.5 : 1.5}
                  dot={{ fill: getColor(bookmaker, index), strokeWidth: 0, r: isSharp ? 4 : 3 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bookmaker selector */}
      <div className="odds-movement__bookmakers">
        <button
          className="odds-movement__bookmakers-toggle"
          onClick={() => setShowBookmakerPanel(!showBookmakerPanel)}
        >
          <span>
            Bookmakers ({displayedBookmakers.length}/{allBookmakers.size})
          </span>
          <span className="odds-movement__bookmakers-arrow">
            {showBookmakerPanel ? "▲" : "▼"}
          </span>
        </button>

        {showBookmakerPanel && (
          <div className="odds-movement__bookmakers-panel">
            {/* Quick select buttons */}
            <div className="odds-movement__quick-select">
              <button onClick={() => selectCategory("sharp")}>Sharp only</button>
              <button onClick={() => selectCategory("major")}>Sharp + Major</button>
              <button onClick={() => selectCategory("all")}>All</button>
              <button onClick={() => selectCategory("none")}>None</button>
            </div>

            {/* Sharp bookmakers */}
            {sharpAvailable.length > 0 && (
              <div className="odds-movement__bookmaker-group">
                <div className="odds-movement__bookmaker-group-title">Sharp</div>
                <div className="odds-movement__bookmaker-list">
                  {sharpAvailable.map((b, i) => (
                    <label key={b} className="odds-movement__bookmaker-item">
                      <input
                        type="checkbox"
                        checked={selectedBookmakers.has(b)}
                        onChange={() => toggleBookmaker(b)}
                      />
                      <span
                        className="odds-movement__bookmaker-color"
                        style={{ backgroundColor: getColor(b, i) }}
                      />
                      <span>{getLabel(b)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Major bookmakers */}
            {majorAvailable.length > 0 && (
              <div className="odds-movement__bookmaker-group">
                <div className="odds-movement__bookmaker-group-title">Major</div>
                <div className="odds-movement__bookmaker-list">
                  {majorAvailable.map((b, i) => (
                    <label key={b} className="odds-movement__bookmaker-item">
                      <input
                        type="checkbox"
                        checked={selectedBookmakers.has(b)}
                        onChange={() => toggleBookmaker(b)}
                      />
                      <span
                        className="odds-movement__bookmaker-color"
                        style={{ backgroundColor: getColor(b, i + sharpAvailable.length) }}
                      />
                      <span>{getLabel(b)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Other bookmakers */}
            {otherAvailable.length > 0 && (
              <div className="odds-movement__bookmaker-group">
                <div className="odds-movement__bookmaker-group-title">
                  Other ({otherAvailable.length})
                </div>
                <div className="odds-movement__bookmaker-list">
                  {otherAvailable.map((b, i) => (
                    <label key={b} className="odds-movement__bookmaker-item">
                      <input
                        type="checkbox"
                        checked={selectedBookmakers.has(b)}
                        onChange={() => toggleBookmaker(b)}
                      />
                      <span
                        className="odds-movement__bookmaker-color"
                        style={{
                          backgroundColor: getColor(
                            b,
                            i + sharpAvailable.length + majorAvailable.length
                          ),
                        }}
                      />
                      <span>{getLabel(b)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compact legend when panel is closed */}
        {!showBookmakerPanel && displayedBookmakers.length > 0 && (
          <div className="odds-movement__legend">
            {displayedBookmakers.slice(0, 8).map((b, i) => (
              <div key={b} className="odds-movement__legend-item">
                <span
                  className="odds-movement__legend-color"
                  style={{ backgroundColor: getColor(b, i) }}
                />
                <span>{getLabel(b)}</span>
              </div>
            ))}
            {displayedBookmakers.length > 8 && (
              <span className="odds-movement__legend-more">
                +{displayedBookmakers.length - 8} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
