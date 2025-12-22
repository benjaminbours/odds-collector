import { Breadcrumb } from "@/components/Breadcrumb";
import { SteamMovesClient } from "@/components/SteamMovesClient";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { LEAGUES, CURRENT_SEASON } from "@odds-collector/shared";
import "@/styles/steam-moves-page.css";

// Revalidate every 30 minutes
export const revalidate = 1800;

export interface SteamMove {
  leagueId: string;
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  market: string;
  marketLabel: string;
  outcome: string;
  point?: number;
  fromTiming: string;
  toTiming: string;
  bookmaker: string;
  fromOdds: number;
  toOdds: number;
  movement: number;
  direction: "shortening" | "drifting";
}

export interface SteamMovesData {
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  availableMarkets: string[];
  hasMorePast: boolean;
}

// Pre-computed aggregate structure from collector
interface LeagueSteamMovesAggregate {
  leagueId: string;
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  availableMarkets: string[];
}

// New split file structure
interface SteamMovesUpcoming {
  leagueId: string;
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  availableMarkets: string[];
  fromDate: string;
  toDate: string;
}

interface SteamMovesDatesIndex {
  leagueId: string;
  season: string;
  availableDates: string[];
  availableMarkets: string[];
  generatedAt: string;
}

/**
 * Fetch only upcoming steam moves from R2 (very fast, small files)
 * Past data is loaded client-side on demand via the API
 */
async function getSteamMoves(): Promise<SteamMovesData> {
  const season = CURRENT_SEASON;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.ODDS_BUCKET;

    const allSteamMoves: SteamMove[] = [];
    const allMarkets = new Set<string>();
    const allDates: string[] = [];

    // Read the small upcoming files (one per league)
    for (const league of LEAGUES) {
      // Load upcoming steam moves (small file)
      const upcomingKey = `odds_data_v2/leagues/${league.id}/${season}/steam_moves_upcoming.json`;
      const upcomingObject = await bucket.get(upcomingKey);

      if (upcomingObject) {
        const upcoming: SteamMovesUpcoming = await upcomingObject.json();
        allSteamMoves.push(...upcoming.steamMoves);
        upcoming.availableMarkets.forEach((m) => allMarkets.add(m));
      }

      // Load dates index to know what past data is available
      const datesKey = `odds_data_v2/leagues/${league.id}/${season}/steam_moves_dates.json`;
      const datesObject = await bucket.get(datesKey);

      if (datesObject) {
        const datesIndex: SteamMovesDatesIndex = await datesObject.json();
        allDates.push(...datesIndex.availableDates);
        datesIndex.availableMarkets.forEach((m) => allMarkets.add(m));
      }
    }

    // Sort by kickoff time (chronologically)
    allSteamMoves.sort(
      (a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime()
    );

    // Check if there's past data available
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const hasPastData = allDates.some((d) => d < todayStr);

    return {
      season,
      steamMoves: allSteamMoves,
      generatedAt: new Date().toISOString(),
      availableMarkets: Array.from(allMarkets).sort(),
      hasMorePast: hasPastData,
    };
  } catch (error) {
    console.error("Error fetching steam moves:", error);
    return {
      season,
      steamMoves: [],
      generatedAt: new Date().toISOString(),
      availableMarkets: [],
      hasMorePast: false,
    };
  }
}

export default async function SteamMovesPage() {
  const data = await getSteamMoves();

  return (
    <main className="container">
      <div className="steam-moves-page">
        <Breadcrumb items={[{ label: "Steam Moves" }]} />

        <header className="steam-moves-page__header">
          <h1 className="steam-moves-page__title">Steam Moves</h1>
          <p className="steam-moves-page__subtitle">
            Significant odds movements (&gt;5%) detected across bookmakers
          </p>
        </header>

        <SteamMovesClient
          initialData={data}
          availableMarkets={data.availableMarkets}
        />
      </div>
    </main>
  );
}
