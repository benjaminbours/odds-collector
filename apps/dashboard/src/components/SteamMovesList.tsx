"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LEAGUES } from "@odds-collector/shared";
import { toSlug } from "@/lib/url-utils";
import "@/styles/steam-moves-list.css";

interface SteamMove {
  leagueId: string;
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  outcome: "home" | "draw" | "away";
  fromTiming: string;
  toTiming: string;
  bookmaker: string;
  fromOdds: number;
  toOdds: number;
  movement: number;
  direction: "shortening" | "drifting";
}

interface SteamMovesResponse {
  season: string;
  steamMoves: SteamMove[];
  total: number;
}

const TIMING_LABELS: Record<string, string> = {
  opening: "Opening",
  mid_week: "Mid-Week",
  day_before: "Day Before",
  closing: "Closing",
};

// Simple flag emoji mapping
const FLAG_EMOJIS: Record<string, string> = {
  "gb-eng": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  it: "🇮🇹",
};

const OUTCOME_LABELS: Record<string, string> = {
  home: "Home",
  draw: "Draw",
  away: "Away",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SteamMovesList() {
  const [data, setData] = useState<SteamMovesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterLeague, setFilterLeague] = useState<string>("all");
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const [filterOutcome, setFilterOutcome] = useState<string>("all");

  useEffect(() => {
    async function fetchSteamMoves() {
      try {
        setLoading(true);
        const response = await fetch("/api/steam-moves");
        if (!response.ok) {
          throw new Error("Failed to fetch steam moves");
        }
        const result: SteamMovesResponse = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchSteamMoves();
  }, []);

  if (loading) {
    return (
      <div className="steam-moves-list steam-moves-list--loading">
        Loading steam moves...
      </div>
    );
  }

  if (error) {
    return (
      <div className="steam-moves-list steam-moves-list--error">
        Error: {error}
      </div>
    );
  }

  if (!data || data.steamMoves.length === 0) {
    return (
      <div className="steam-moves-list steam-moves-list--empty">
        No significant odds movements detected
      </div>
    );
  }

  // Apply filters
  let filteredMoves = data.steamMoves;

  if (filterLeague !== "all") {
    filteredMoves = filteredMoves.filter((m) => m.leagueId === filterLeague);
  }

  if (filterDirection !== "all") {
    filteredMoves = filteredMoves.filter((m) => m.direction === filterDirection);
  }

  if (filterOutcome !== "all") {
    filteredMoves = filteredMoves.filter((m) => m.outcome === filterOutcome);
  }

  // Group by match for better display
  const groupedByMatch = filteredMoves.reduce(
    (acc, move) => {
      const key = `${move.leagueId}-${move.matchKey}`;
      if (!acc[key]) {
        acc[key] = {
          leagueId: move.leagueId,
          matchKey: move.matchKey,
          homeTeam: move.homeTeam,
          awayTeam: move.awayTeam,
          kickoffTime: move.kickoffTime,
          moves: [],
        };
      }
      acc[key].moves.push(move);
      return acc;
    },
    {} as Record<
      string,
      {
        leagueId: string;
        matchKey: string;
        homeTeam: string;
        awayTeam: string;
        kickoffTime: string;
        moves: SteamMove[];
      }
    >
  );

  const matchGroups = Object.values(groupedByMatch).sort((a, b) => {
    // Sort by largest movement in each group
    const maxA = Math.max(...a.moves.map((m) => Math.abs(m.movement)));
    const maxB = Math.max(...b.moves.map((m) => Math.abs(m.movement)));
    return maxB - maxA;
  });

  return (
    <div className="steam-moves-list">
      {/* Filters */}
      <div className="steam-moves-list__filters">
        <div className="steam-moves-list__filter">
          <label className="steam-moves-list__filter-label">League</label>
          <select
            className="steam-moves-list__filter-select"
            value={filterLeague}
            onChange={(e) => setFilterLeague(e.target.value)}
          >
            <option value="all">All Leagues</option>
            {LEAGUES.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
              </option>
            ))}
          </select>
        </div>

        <div className="steam-moves-list__filter">
          <label className="steam-moves-list__filter-label">Direction</label>
          <select
            className="steam-moves-list__filter-select"
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
          >
            <option value="all">All</option>
            <option value="shortening">Shortening</option>
            <option value="drifting">Drifting</option>
          </select>
        </div>

        <div className="steam-moves-list__filter">
          <label className="steam-moves-list__filter-label">Outcome</label>
          <select
            className="steam-moves-list__filter-select"
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
          >
            <option value="all">All</option>
            <option value="home">Home</option>
            <option value="draw">Draw</option>
            <option value="away">Away</option>
          </select>
        </div>

        <div className="steam-moves-list__count">
          {filteredMoves.length} moves in {matchGroups.length} matches
        </div>
      </div>

      {/* Match groups */}
      <div className="steam-moves-list__matches">
        {matchGroups.map((group) => {
          const league = LEAGUES.find((l) => l.id === group.leagueId);
          const isPast = new Date(group.kickoffTime) < new Date();

          return (
            <div
              key={`${group.leagueId}-${group.matchKey}`}
              className={`steam-moves-card ${isPast ? "steam-moves-card--past" : ""}`}
            >
              <Link
                href={`/leagues/${toSlug(group.leagueId)}/matches/${toSlug(group.matchKey)}`}
                className="steam-moves-card__header"
              >
                <div className="steam-moves-card__match-info">
                  <span className="steam-moves-card__league">
                    {league ? FLAG_EMOJIS[league.countryCode] || "⚽" : ""}{" "}
                    {league?.name}
                  </span>
                  <span className="steam-moves-card__teams">
                    {group.homeTeam} vs {group.awayTeam}
                  </span>
                  <span className="steam-moves-card__datetime">
                    {formatDate(group.kickoffTime)} at{" "}
                    {formatTime(group.kickoffTime)}
                    {isPast && " (played)"}
                  </span>
                </div>
                <span className="steam-moves-card__arrow">→</span>
              </Link>

              <div className="steam-moves-card__moves">
                {group.moves
                  .sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement))
                  .map((move, idx) => (
                    <div
                      key={idx}
                      className={`steam-move ${
                        move.direction === "shortening"
                          ? "steam-move--shortening"
                          : "steam-move--drifting"
                      }`}
                    >
                      <div className="steam-move__outcome">
                        {OUTCOME_LABELS[move.outcome]}
                      </div>
                      <div className="steam-move__bookmaker">{move.bookmaker}</div>
                      <div className="steam-move__timing">
                        {TIMING_LABELS[move.fromTiming]} →{" "}
                        {TIMING_LABELS[move.toTiming]}
                      </div>
                      <div className="steam-move__odds">
                        {move.fromOdds.toFixed(2)} → {move.toOdds.toFixed(2)}
                      </div>
                      <div
                        className={`steam-move__change ${
                          move.direction === "shortening"
                            ? "steam-move__change--shortening"
                            : "steam-move__change--drifting"
                        }`}
                      >
                        {move.direction === "shortening" ? "↓" : "↑"}{" "}
                        {Math.abs(move.movement).toFixed(1)}%
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
