"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { LEAGUES } from "@odds-collector/shared";
import type { SteamMove, SteamMovesData } from "@/app/steam-moves/page";
import type { SteamMovesResponse } from "@/app/api/steam-moves/route";
import { toSlug } from "@/lib/url-utils";
import "@/styles/steam-moves-list.css";

interface SteamMovesClientProps {
  initialData: SteamMovesData;
  availableMarkets: string[];
}

const TIMING_LABELS: Record<string, string> = {
  opening: "Opening",
  mid_week: "Mid-Week",
  day_before: "Day Before",
  closing: "Closing",
};

const FLAG_EMOJIS: Record<string, string> = {
  "gb-eng": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  it: "🇮🇹",
};

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const formatted = date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (isToday) return `Today - ${formatted}`;
  if (isTomorrow) return `Tomorrow - ${formatted}`;
  if (isYesterday) return `Yesterday - ${formatted}`;
  return formatted;
}

function formatKickoffTime(kickoffTime: string): string {
  const date = new Date(kickoffTime);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOutcome(move: SteamMove): string {
  if (move.point !== undefined) {
    return `${move.outcome} (${move.point > 0 ? "+" : ""}${move.point})`;
  }
  return move.outcome;
}

interface MatchGroup {
  leagueId: string;
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  moves: SteamMove[];
}

interface DateGroup {
  date: string;
  matches: MatchGroup[];
}

export function SteamMovesClient({ initialData, availableMarkets }: SteamMovesClientProps) {
  const [steamMoves, setSteamMoves] = useState<SteamMove[]>(initialData.steamMoves);
  const [hasMorePast, setHasMorePast] = useState(initialData.hasMorePast);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestDate, setOldestDate] = useState<string | undefined>(() => {
    if (steamMoves.length === 0) return undefined;
    // Find oldest kickoff time from initial data
    return steamMoves.reduce((oldest, move) => {
      return move.kickoffTime < oldest ? move.kickoffTime : oldest;
    }, steamMoves[0].kickoffTime);
  });

  // Filters
  const [filterLeague, setFilterLeague] = useState<string>("all");
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const [filterMarket, setFilterMarket] = useState<string>("all");
  const [minMovement, setMinMovement] = useState<number>(5);

  // Apply filters
  const filteredMoves = useMemo(() => {
    let moves = steamMoves;

    if (filterLeague !== "all") {
      moves = moves.filter((m) => m.leagueId === filterLeague);
    }

    if (filterDirection !== "all") {
      moves = moves.filter((m) => m.direction === filterDirection);
    }

    if (filterMarket !== "all") {
      moves = moves.filter((m) => m.marketLabel === filterMarket);
    }

    // Filter by minimum movement percentage
    moves = moves.filter((m) => Math.abs(m.movement) >= minMovement);

    return moves;
  }, [steamMoves, filterLeague, filterDirection, filterMarket, minMovement]);

  // Group by date, then by match
  const { upcomingDateGroups, pastDateGroups } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Group moves by match
    const matchGroups = new Map<string, MatchGroup>();
    for (const move of filteredMoves) {
      const key = `${move.leagueId}-${move.matchKey}`;
      if (!matchGroups.has(key)) {
        matchGroups.set(key, {
          leagueId: move.leagueId,
          matchKey: move.matchKey,
          homeTeam: move.homeTeam,
          awayTeam: move.awayTeam,
          kickoffTime: move.kickoffTime,
          moves: [],
        });
      }
      matchGroups.get(key)!.moves.push(move);
    }

    // Group matches by date
    const dateGroups = new Map<string, MatchGroup[]>();
    for (const matchGroup of matchGroups.values()) {
      const dateStr = matchGroup.kickoffTime.split("T")[0];
      if (!dateGroups.has(dateStr)) {
        dateGroups.set(dateStr, []);
      }
      dateGroups.get(dateStr)!.push(matchGroup);
    }

    // Sort matches within each date by kickoff time
    for (const matches of dateGroups.values()) {
      matches.sort((a, b) =>
        new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime()
      );
    }

    // Separate into upcoming and past
    const upcoming: DateGroup[] = [];
    const past: DateGroup[] = [];

    const sortedDates = Array.from(dateGroups.keys()).sort();
    for (const date of sortedDates) {
      const group: DateGroup = { date, matches: dateGroups.get(date)! };
      if (date >= todayStr) {
        upcoming.push(group);
      } else {
        past.push(group);
      }
    }

    // Past should be most recent first
    past.reverse();

    return { upcomingDateGroups: upcoming, pastDateGroups: past };
  }, [filteredMoves]);

  const [recentLoaded, setRecentLoaded] = useState(false);

  const loadRecent = async () => {
    if (loadingMore || recentLoaded) return;

    setLoadingMore(true);
    try {
      const response = await fetch('/api/steam-moves?type=recent');
      if (!response.ok) throw new Error("Failed to load recent");

      const data: SteamMovesResponse = await response.json();
      setSteamMoves((prev) => [...prev, ...data.steamMoves]);
      setHasMorePast(data.hasMorePast);
      setRecentLoaded(true);
      if (data.oldestDate) {
        setOldestDate(data.oldestDate);
      }
    } catch (error) {
      console.error("Error loading recent steam moves:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const loadMorePast = async () => {
    if (!oldestDate || loadingMore) return;

    // First load recent if not loaded yet
    if (!recentLoaded) {
      await loadRecent();
      return;
    }

    // Then load older dates one at a time
    setLoadingMore(true);
    try {
      // Calculate the date before the oldest we have
      const oldestDateObj = new Date(oldestDate);
      oldestDateObj.setDate(oldestDateObj.getDate() - 1);
      const dateToLoad = oldestDateObj.toISOString().split('T')[0];

      const response = await fetch(`/api/steam-moves?date=${dateToLoad}`);
      if (!response.ok) throw new Error("Failed to load more");

      const data: SteamMovesResponse = await response.json();
      if (data.steamMoves.length > 0) {
        setSteamMoves((prev) => [...prev, ...data.steamMoves]);
      }
      setHasMorePast(data.hasMorePast);
      if (data.oldestDate) {
        setOldestDate(data.oldestDate);
      }
    } catch (error) {
      console.error("Error loading more steam moves:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const totalMoves = filteredMoves.length;
  const totalMatches = upcomingDateGroups.reduce((sum, g) => sum + g.matches.length, 0) +
    pastDateGroups.reduce((sum, g) => sum + g.matches.length, 0);

  if (steamMoves.length === 0) {
    return (
      <div className="steam-moves-list steam-moves-list--empty">
        No significant odds movements detected
      </div>
    );
  }

  const renderMatchCard = (match: MatchGroup, isPast: boolean) => {
    const league = LEAGUES.find((l) => l.id === match.leagueId);

    return (
      <div
        key={`${match.leagueId}-${match.matchKey}`}
        className={`steam-moves-card ${isPast ? "steam-moves-card--past" : ""}`}
      >
        <Link
          href={`/leagues/${toSlug(match.leagueId)}/matches/${toSlug(match.matchKey)}`}
          className="steam-moves-card__header"
        >
          <div className="steam-moves-card__match-info">
            <span className="steam-moves-card__league">
              {league ? FLAG_EMOJIS[league.countryCode] || "" : ""}{" "}
              {league?.name}
            </span>
            <span className="steam-moves-card__teams">
              {match.homeTeam} vs {match.awayTeam}
            </span>
            <span className="steam-moves-card__datetime">
              {formatKickoffTime(match.kickoffTime)}
            </span>
          </div>
          <span className="steam-moves-card__arrow">→</span>
        </Link>

        <div className="steam-moves-card__moves">
          {match.moves
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
                <div className="steam-move__market">{move.marketLabel}</div>
                <div className="steam-move__outcome">{formatOutcome(move)}</div>
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
  };

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
          <label className="steam-moves-list__filter-label">Market</label>
          <select
            className="steam-moves-list__filter-select"
            value={filterMarket}
            onChange={(e) => setFilterMarket(e.target.value)}
          >
            <option value="all">All Markets</option>
            {availableMarkets.map((market) => (
              <option key={market} value={market}>
                {market}
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
          <label className="steam-moves-list__filter-label">Min Movement</label>
          <select
            className="steam-moves-list__filter-select"
            value={minMovement}
            onChange={(e) => setMinMovement(Number(e.target.value))}
          >
            <option value={5}>5%+</option>
            <option value={10}>10%+</option>
            <option value={15}>15%+</option>
            <option value={20}>20%+</option>
            <option value={25}>25%+</option>
          </select>
        </div>

        <div className="steam-moves-list__count">
          {totalMoves} moves in {totalMatches} matches
        </div>
      </div>

      {/* Upcoming section - always show */}
      <section className="steam-moves-list__section">
        <h2 className="steam-moves-list__section-title">Upcoming</h2>
        {upcomingDateGroups.length > 0 ? (
          upcomingDateGroups.map((dateGroup) => (
            <div key={dateGroup.date} className="steam-moves-list__date-group">
              <h3 className="steam-moves-list__date-header">
                {formatDateHeader(dateGroup.date)}
              </h3>
              <div className="steam-moves-list__matches">
                {dateGroup.matches.map((match) => renderMatchCard(match, false))}
              </div>
            </div>
          ))
        ) : (
          <div className="steam-moves-list__empty-section">
            No steam moves detected for upcoming matches yet
          </div>
        )}
      </section>

      {/* Past section */}
      {(pastDateGroups.length > 0 || hasMorePast) && (
        <section className="steam-moves-list__section">
          <h2 className="steam-moves-list__section-title">Past</h2>
          {pastDateGroups.map((dateGroup) => (
            <div key={dateGroup.date} className="steam-moves-list__date-group">
              <h3 className="steam-moves-list__date-header">
                {formatDateHeader(dateGroup.date)}
              </h3>
              <div className="steam-moves-list__matches">
                {dateGroup.matches.map((match) => renderMatchCard(match, true))}
              </div>
            </div>
          ))}

          {/* Load more button */}
          {hasMorePast && (
            <button
              className="steam-moves-list__load-more"
              onClick={loadMorePast}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : recentLoaded ? "Load older matches" : "Load recent matches"}
            </button>
          )}
        </section>
      )}

      {/* Empty state after filtering */}
      {filteredMoves.length === 0 && steamMoves.length > 0 && (
        <div className="steam-moves-list steam-moves-list--empty">
          No movements match your filters
        </div>
      )}
    </div>
  );
}
