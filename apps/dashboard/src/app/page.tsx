import Link from "next/link";
import { LeagueCard } from "@/components/LeagueCard";
import { MatchCard } from "@/components/MatchCard";
import { LEAGUES } from "@odds-collector/shared";
import type { SteamMove } from "@odds-collector/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getUpcomingMatchesAcrossLeagues, type MatchWithKey } from "@/lib/matches-db";
import { getTopUpcomingSteamMoves } from "@/lib/steam-moves-db";
import { toSlug } from "@/lib/url-utils";
import "@/styles/page.css";
import "@/styles/home-preview.css";

// Revalidate every 30 minutes
export const revalidate = 1800;

interface UpcomingItem extends MatchWithKey {
  leagueName: string;
}

async function getUpcomingMatches(): Promise<UpcomingItem[]> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const matches = await getUpcomingMatchesAcrossLeagues(env.DB, {
      limit: 6,
      hoursAhead: 24 * 7,
    });
    const nameByLeague = new Map(LEAGUES.map((l) => [l.id, l.name]));
    return matches.map((m) => ({
      ...m,
      leagueName: nameByLeague.get(m.leagueId) ?? m.leagueId,
    }));
  } catch (error) {
    console.error("Error fetching upcoming matches:", error);
    return [];
  }
}

/**
 * Top 5 upcoming steam moves by |movement| across the next 7 days.
 * Behavior change from the R2 era: used to surface the past 14 days'
 * top-5 (reading per-league `steam_moves_recent.json`); now surfaces
 * what's about to happen instead.
 */
async function getTopSteamMoves(): Promise<SteamMove[]> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return await getTopUpcomingSteamMoves(env.DB, {
      hoursAhead: 24 * 7,
      limit: 5,
    });
  } catch (error) {
    console.error("Error fetching steam moves preview:", error);
    return [];
  }
}

export default async function HomePage() {
  const [upcomingMatches, recentSteamMoves] = await Promise.all([
    getUpcomingMatches(),
    getTopSteamMoves(),
  ]);

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Bookmaker Intelligence</h1>
        <p className="page__subtitle">
          Track odds movements across 4 snapshot timings. Identify steam moves
          and market sentiment.
        </p>
      </header>

      <section className="page__section">
        <h2 className="page__section-title">Select a League</h2>
        <div className="grid grid--cols-2">
          {LEAGUES.map((league) => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </div>
      </section>

      {/* Upcoming Matches Preview */}
      <section className="page__section">
        <div className="page__section-header">
          <h2 className="page__section-title page__section-title--muted">
            Upcoming Matches
          </h2>
          <Link
            href="/leagues/england-premier-league"
            className="page__view-all"
            prefetch={false}
          >
            View all →
          </Link>
        </div>
        {upcomingMatches.length > 0 ? (
          <div className="home-preview__matches">
            {upcomingMatches.map((item) => (
              <MatchCard
                key={`${item.leagueId}-${item.key}`}
                match={item}
                leagueId={item.leagueId}
                leagueName={item.leagueName}
              />
            ))}
          </div>
        ) : (
          <p className="home-preview__empty">
            No upcoming matches in the next 7 days
          </p>
        )}
      </section>

      {/* Top Upcoming Steam Moves Preview */}
      <section className="page__section">
        <div className="page__section-header">
          <h2 className="page__section-title page__section-title--muted">
            Top Upcoming Steam Moves
          </h2>
          <Link href="/steam-moves" className="page__view-all" prefetch={false}>
            View all →
          </Link>
        </div>
        {recentSteamMoves.length > 0 ? (
          <div className="home-preview__steam-moves">
            {recentSteamMoves.map((move, idx) => (
              <Link
                key={idx}
                href={`/leagues/${toSlug(move.leagueId)}/matches/${toSlug(move.matchKey)}`}
                className={`home-preview__steam-move home-preview__steam-move--${move.direction}`}
              >
                <div className="home-preview__steam-move-match">
                  {move.homeTeam} vs {move.awayTeam}
                </div>
                <div className="home-preview__steam-move-details">
                  <span className="home-preview__steam-move-market">
                    {move.marketLabel}: {move.outcome}
                  </span>
                  <span className="home-preview__steam-move-bookmaker">
                    {move.bookmaker}
                  </span>
                </div>
                <div className="home-preview__steam-move-change">
                  <span className="home-preview__steam-move-odds">
                    {move.fromOdds.toFixed(2)} → {move.toOdds.toFixed(2)}
                  </span>
                  <span
                    className={`home-preview__steam-move-pct home-preview__steam-move-pct--${move.direction}`}
                  >
                    {move.direction === "shortening" ? "↓" : "↑"}{" "}
                    {Math.abs(move.movement).toFixed(1)}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="home-preview__empty">
            No significant steam moves detected for upcoming matches
          </p>
        )}
      </section>
    </div>
  );
}
