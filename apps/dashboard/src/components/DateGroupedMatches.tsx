"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { DateIndex, MatchIndex, MatchIndexEntry } from "@odds-collector/shared";
import "@/styles/date-grouped-matches.css";

interface DateGroupedMatchesProps {
  dateIndex: DateIndex;
  matchIndex: MatchIndex;
  leagueId: string;
}

interface MatchWithKey extends MatchIndexEntry {
  key: string;
}

const TIMING_LABELS: Record<string, string> = {
  opening: "W",
  mid_week: "M",
  day_before: "D",
  closing: "C",
};

const TIMING_FULL_LABELS: Record<string, string> = {
  opening: "Week Before",
  mid_week: "Mid Week",
  day_before: "Day Before",
  closing: "Closing",
};

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00"); // Add time to avoid timezone issues
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

export function DateGroupedMatches({
  dateIndex,
  matchIndex,
  leagueId,
}: DateGroupedMatchesProps) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Sort dates and separate upcoming vs past
  const { upcomingDates, pastDates } = useMemo(() => {
    const sortedDates = Object.keys(dateIndex.dates).sort((a, b) =>
      new Date(b).getTime() - new Date(a).getTime()
    );

    const upcoming: string[] = [];
    const past: string[] = [];

    sortedDates.forEach((dateStr) => {
      if (dateStr >= todayStr) {
        upcoming.push(dateStr);
      } else {
        past.push(dateStr);
      }
    });

    // Upcoming should be sorted ascending (nearest first)
    upcoming.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    // Past stays descending (most recent first)

    return { upcomingDates: upcoming, pastDates: past };
  }, [dateIndex.dates, todayStr]);

  // Track which dates are expanded
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
    // Auto-expand today and next few upcoming dates
    const initial = new Set<string>();
    upcomingDates.slice(0, 3).forEach((d) => initial.add(d));
    pastDates.slice(0, 2).forEach((d) => initial.add(d));
    return initial;
  });

  const toggleDate = (dateStr: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  // Get matches for a date, filtering duplicates
  const getMatchesForDate = (dateStr: string): MatchWithKey[] => {
    const dateEntry = dateIndex.dates[dateStr];
    if (!dateEntry) return [];

    // Filter to only matches that exist in matchIndex and dedupe by teams
    const seen = new Set<string>();
    const matches: MatchWithKey[] = [];

    for (const matchKey of dateEntry.matches) {
      const match = matchIndex.matches[matchKey];
      if (!match) continue;

      // Create a normalized key for deduplication
      const normalizedKey = `${match.homeTeam.toLowerCase()}_${match.awayTeam.toLowerCase()}`;
      if (seen.has(normalizedKey)) continue;
      seen.add(normalizedKey);

      matches.push({ ...match, key: matchKey });
    }

    // Sort by kickoff time
    return matches.sort((a, b) =>
      new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime()
    );
  };

  const renderDateSection = (dateStr: string) => {
    const dateEntry = dateIndex.dates[dateStr];
    const isExpanded = expandedDates.has(dateStr);
    const matches = isExpanded ? getMatchesForDate(dateStr) : [];
    const isPast = dateStr < todayStr;

    return (
      <div
        key={dateStr}
        className={`date-group ${isPast ? "date-group--past" : ""}`}
      >
        <button
          className="date-group__header"
          onClick={() => toggleDate(dateStr)}
          aria-expanded={isExpanded}
        >
          <div className="date-group__header-left">
            <span className={`date-group__chevron ${isExpanded ? "date-group__chevron--expanded" : ""}`}>
              ▶
            </span>
            <span className="date-group__date">{formatDateHeader(dateStr)}</span>
            <span className="date-group__count">
              {dateEntry.matchCount} match{dateEntry.matchCount !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="date-group__timings">
            {["opening", "mid_week", "day_before", "closing"].map((timing) => (
              <span
                key={timing}
                className={`date-group__timing ${
                  dateEntry.snapshotTimingsAvailable.includes(timing)
                    ? "date-group__timing--available"
                    : ""
                }`}
                title={TIMING_FULL_LABELS[timing]}
              >
                {TIMING_LABELS[timing]}
              </span>
            ))}
          </div>
        </button>

        {isExpanded && (
          <div className="date-group__matches">
            {matches.map((match) => (
              <Link
                key={match.key}
                href={`/leagues/${leagueId}/matches/${encodeURIComponent(match.key)}`}
                className="date-group__match"
              >
                <span className="date-group__match-time">
                  {formatKickoffTime(match.kickoffTime)}
                </span>
                <span className="date-group__match-teams">
                  <span className="date-group__team date-group__team--home">
                    {match.homeTeam}
                  </span>
                  <span className="date-group__vs">vs</span>
                  <span className="date-group__team date-group__team--away">
                    {match.awayTeam}
                  </span>
                </span>
                <span className="date-group__match-snapshots">
                  {Object.keys(match.snapshots).length} snapshots
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="date-grouped-matches">
      {upcomingDates.length > 0 && (
        <section className="date-grouped-matches__section">
          <h2 className="date-grouped-matches__section-title">Upcoming</h2>
          {upcomingDates.map(renderDateSection)}
        </section>
      )}

      {pastDates.length > 0 && (
        <section className="date-grouped-matches__section">
          <h2 className="date-grouped-matches__section-title">Past</h2>
          {pastDates.map(renderDateSection)}
        </section>
      )}
    </div>
  );
}
