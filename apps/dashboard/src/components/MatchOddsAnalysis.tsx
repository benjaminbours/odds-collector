"use client";

import { useState, useMemo } from "react";
import type { OddsSnapshot } from "@odds-collector/shared";
import { OddsMovementChart } from "./OddsMovementChart";
import { BookmakerComparison } from "./BookmakerComparison";
import "@/styles/match-odds-analysis.css";

// Market configuration (shared)
export type MarketKey = "h2h" | "btts" | "double_chance" | "alternate_totals" | "alternate_spreads";

export interface MarketConfig {
  key: MarketKey;
  label: string;
  hasPoints: boolean;
}

export const MARKETS: MarketConfig[] = [
  { key: "h2h", label: "Money Line", hasPoints: false },
  { key: "btts", label: "Both Teams to Score", hasPoints: false },
  { key: "double_chance", label: "Double Chance", hasPoints: false },
  { key: "alternate_totals", label: "Over/Under", hasPoints: true },
  { key: "alternate_spreads", label: "Spread", hasPoints: true },
];

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

// Get outcomes for a market
export function getMarketOutcomes(
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

interface MatchOddsAnalysisProps {
  snapshots: Record<string, OddsSnapshot>;
  homeTeam: string;
  awayTeam: string;
}

export function MatchOddsAnalysis({
  snapshots,
  homeTeam,
  awayTeam,
}: MatchOddsAnalysisProps) {
  const [selectedMarket, setSelectedMarket] = useState<MarketKey>("h2h");
  const [selectedPoint, setSelectedPoint] = useState<number | undefined>(undefined);

  // Get available markets (only show markets that have data)
  const availableMarkets = useMemo(() => {
    const marketKeys = new Set<string>();
    Object.values(snapshots).forEach((snapshot) => {
      snapshot.odds.bookmakers.forEach((b) => {
        b.markets.forEach((m) => marketKeys.add(m.key));
      });
    });
    return MARKETS.filter((m) => marketKeys.has(m.key));
  }, [snapshots]);

  // Get available points for current market
  const availablePoints = useMemo(() => {
    const marketConfig = MARKETS.find((m) => m.key === selectedMarket);
    if (!marketConfig?.hasPoints) return [];
    return getAvailablePoints(snapshots, selectedMarket);
  }, [snapshots, selectedMarket]);

  // Set default point when market changes
  const currentMarketConfig = MARKETS.find((m) => m.key === selectedMarket);
  if (currentMarketConfig?.hasPoints && selectedPoint === undefined && availablePoints.length > 0) {
    const defaultPoint = selectedMarket === "alternate_totals"
      ? availablePoints.find((p) => p === 2.5) ?? availablePoints[Math.floor(availablePoints.length / 2)]
      : availablePoints.find((p) => p === 0) ?? availablePoints[Math.floor(availablePoints.length / 2)];
    setSelectedPoint(defaultPoint);
  }

  const handleMarketChange = (market: MarketKey) => {
    setSelectedMarket(market);
    setSelectedPoint(undefined);
  };

  return (
    <div className="match-odds-analysis">
      {/* Global market selector */}
      {availableMarkets.length > 1 && (
        <div className="match-odds-analysis__market-selector">
          <div className="match-odds-analysis__markets">
            {availableMarkets.map((market) => (
              <button
                key={market.key}
                className={`match-odds-analysis__market ${
                  selectedMarket === market.key ? "match-odds-analysis__market--active" : ""
                }`}
                onClick={() => handleMarketChange(market.key)}
              >
                {market.label}
              </button>
            ))}
          </div>

          {/* Point selector for totals/spreads */}
          {currentMarketConfig?.hasPoints && availablePoints.length > 0 && (
            <div className="match-odds-analysis__points">
              <span className="match-odds-analysis__points-label">
                {selectedMarket === "alternate_totals" ? "Line:" : "Handicap:"}
              </span>
              <select
                className="match-odds-analysis__points-select"
                value={selectedPoint ?? ""}
                onChange={(e) => setSelectedPoint(parseFloat(e.target.value))}
              >
                {availablePoints.map((point) => (
                  <option key={point} value={point}>
                    {point > 0 ? `+${point}` : point}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Odds Movement Chart */}
      <section className="match-odds-analysis__section">
        <h2 className="match-odds-analysis__section-title">Odds Movement</h2>
        <OddsMovementChart
          snapshots={snapshots}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          selectedMarket={selectedMarket}
          selectedPoint={selectedPoint}
        />
      </section>

      {/* Bookmaker Comparison */}
      <section className="match-odds-analysis__section">
        <h2 className="match-odds-analysis__section-title">Bookmaker Comparison</h2>
        <BookmakerComparison
          snapshots={snapshots}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          selectedMarket={selectedMarket}
          selectedPoint={selectedPoint}
        />
      </section>
    </div>
  );
}
