import Link from "next/link";
import { LeagueCard } from "@/components/LeagueCard";
import { MatchCard } from "@/components/MatchCard";
import { LEAGUES, CURRENT_SEASON } from "@odds-collector/shared";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { toSlug } from "@/lib/url-utils";
import type {
  MatchIndex,
  MatchIndexEntry,
  OddsSnapshot,
  BookmakerMarket,
} from "@odds-collector/shared";
import "@/styles/page.css";
import "@/styles/home-preview.css";

// Revalidate every 30 minutes
export const revalidate = 1800;

interface SteamMovePreview {
  leagueId: string;
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  marketLabel: string;
  outcome: string;
  bookmaker: string;
  fromOdds: number;
  toOdds: number;
  movement: number;
  direction: "shortening" | "drifting";
}

interface UpcomingMatch {
  key: string;
  match: MatchIndexEntry;
  leagueId: string;
  leagueName: string;
}

const TIMING_ORDER = ["opening", "mid_week", "day_before", "closing"];
const STEAM_THRESHOLD = 5;
const ALLOWED_MARKETS = [
  "h2h",
  "spreads",
  "alternate_spreads",
  "totals",
  "alternate_totals",
  "btts",
  "double_chance",
];
const MARKET_LABELS: Record<string, string> = {
  h2h: "Money Line",
  spreads: "Spread",
  alternate_spreads: "Spread",
  totals: "Totals",
  alternate_totals: "Totals",
  btts: "Both Teams to Score",
  double_chance: "Double Chance",
};

async function getHomePageData(): Promise<{
  upcomingMatches: UpcomingMatch[];
  recentSteamMoves: SteamMovePreview[];
}> {
  const season = CURRENT_SEASON;
  const now = new Date();
  const futureCutoff = new Date(now);
  futureCutoff.setDate(futureCutoff.getDate() + 7);

  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.ODDS_BUCKET;

    const upcomingMatches: UpcomingMatch[] = [];
    const recentSteamMoves: SteamMovePreview[] = [];

    for (const league of LEAGUES) {
      const indexKey = `odds_data_v2/leagues/${league.id}/${season}/by_match.json`;
      const indexObject = await bucket.get(indexKey);

      if (!indexObject) continue;

      const indexData: MatchIndex = await indexObject.json();

      // Get upcoming matches (next 7 days)
      const matchEntries = Object.entries(indexData.matches)
        .filter(([, entry]) => {
          const kickoff = new Date(entry.kickoffTime);
          return kickoff >= now && kickoff <= futureCutoff;
        })
        .sort(
          ([, a], [, b]) =>
            new Date(a.kickoffTime).getTime() -
            new Date(b.kickoffTime).getTime()
        );

      for (const [key, match] of matchEntries.slice(0, 5)) {
        upcomingMatches.push({
          key,
          match,
          leagueId: league.id,
          leagueName: league.name,
        });
      }

      // Find steam moves for upcoming matches (limit processing)
      const matchesToProcess = matchEntries.slice(0, 10);

      for (const [matchKey, matchEntry] of matchesToProcess) {
        const availableTimings = TIMING_ORDER.filter(
          (t) => matchEntry.snapshots[t]
        );

        if (availableTimings.length < 2) continue;

        // Fetch snapshots
        const snapshotPromises = availableTimings.map(async (timing) => {
          const path = matchEntry.snapshots[timing];
          const obj = await bucket.get(path);
          if (!obj) return { timing, snapshot: null };
          const snapshot: OddsSnapshot = await obj.json();
          return { timing, snapshot };
        });

        const snapshotResults = await Promise.all(snapshotPromises);
        const snapshots: Record<string, OddsSnapshot> = {};
        for (const { timing, snapshot } of snapshotResults) {
          if (snapshot) snapshots[timing] = snapshot;
        }

        // Compare consecutive timings
        for (let j = 0; j < availableTimings.length - 1; j++) {
          const fromTiming = availableTimings[j];
          const toTiming = availableTimings[j + 1];
          const fromSnapshot = snapshots[fromTiming];
          const toSnapshot = snapshots[toTiming];

          if (!fromSnapshot || !toSnapshot) continue;

          const fromBookmakers = new Map(
            fromSnapshot.odds.bookmakers.map((b) => [b.key, b])
          );

          for (const toBookmaker of toSnapshot.odds.bookmakers) {
            const fromBookmaker = fromBookmakers.get(toBookmaker.key);
            if (!fromBookmaker) continue;

            for (const toMarket of toBookmaker.markets) {
              if (!ALLOWED_MARKETS.includes(toMarket.key)) continue;

              const fromMarket = fromBookmaker.markets.find(
                (m: BookmakerMarket) => m.key === toMarket.key
              );
              if (!fromMarket) continue;

              for (const toOutcome of toMarket.outcomes) {
                const fromOutcome = fromMarket.outcomes.find(
                  (o: { name: string; point?: number }) =>
                    o.name === toOutcome.name &&
                    (toOutcome.point === undefined ||
                      o.point === toOutcome.point)
                );

                if (!fromOutcome) continue;

                const movement =
                  ((toOutcome.price - fromOutcome.price) / fromOutcome.price) *
                  100;

                if (Math.abs(movement) >= STEAM_THRESHOLD) {
                  recentSteamMoves.push({
                    leagueId: league.id,
                    matchKey,
                    homeTeam: matchEntry.homeTeam,
                    awayTeam: matchEntry.awayTeam,
                    kickoffTime: matchEntry.kickoffTime,
                    marketLabel: MARKET_LABELS[toMarket.key] || toMarket.key,
                    outcome: toOutcome.name,
                    bookmaker: toBookmaker.title,
                    fromOdds: fromOutcome.price,
                    toOdds: toOutcome.price,
                    movement,
                    direction: movement < 0 ? "shortening" : "drifting",
                  });
                }
              }
            }
          }
        }
      }
    }

    // Sort upcoming matches by kickoff time
    upcomingMatches.sort(
      (a, b) =>
        new Date(a.match.kickoffTime).getTime() -
        new Date(b.match.kickoffTime).getTime()
    );

    // Sort steam moves by magnitude and take top 5
    recentSteamMoves.sort(
      (a, b) => Math.abs(b.movement) - Math.abs(a.movement)
    );

    return {
      upcomingMatches: upcomingMatches.slice(0, 6),
      recentSteamMoves: recentSteamMoves.slice(0, 5),
    };
  } catch (error) {
    console.error("Error fetching homepage data:", error);
    return {
      upcomingMatches: [],
      recentSteamMoves: [],
    };
  }
}

export default async function HomePage() {
  const { upcomingMatches, recentSteamMoves } = await getHomePageData();

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
          <Link href="/leagues/england-premier-league" className="page__view-all">
            View all →
          </Link>
        </div>
        {upcomingMatches.length > 0 ? (
          <div className="home-preview__matches">
            {upcomingMatches.map((item) => (
              <div key={`${item.leagueId}-${item.key}`} className="home-preview__match-wrapper">
                <span className="home-preview__league-badge">{item.leagueName}</span>
                <MatchCard
                  match={{ ...item.match, key: item.key }}
                  leagueId={item.leagueId}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="home-preview__empty">No upcoming matches in the next 7 days</p>
        )}
      </section>

      {/* Recent Steam Moves Preview */}
      <section className="page__section">
        <div className="page__section-header">
          <h2 className="page__section-title page__section-title--muted">
            Recent Steam Moves
          </h2>
          <Link href="/steam-moves" className="page__view-all">
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
