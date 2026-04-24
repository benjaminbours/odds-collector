import type { Metadata } from "next";
import { Breadcrumb } from "@/components/Breadcrumb";
import { SteamMovesClient } from "@/components/SteamMovesClient";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CURRENT_SEASON } from "@odds-collector/shared";
import type { SteamMove } from "@odds-collector/shared";
import {
  getUpcomingSteamMoves,
  getAvailableDates,
  getAvailableMarkets,
} from "@/lib/steam-moves-db";
import "@/styles/steam-moves-page.css";

export const metadata: Metadata = {
  title: "Steam Moves",
  description:
    "Real-time steam move detection across Premier League and Serie A. Spot sharp money, line movements, and bookmaker reactions before kickoff.",
};

// Revalidate every 30 minutes
export const revalidate = 1800;

// Re-export so SteamMovesClient (and the /api route) can keep importing
// `SteamMove` from the page, unchanged from the R2 era.
export type { SteamMove };

export interface SteamMovesData {
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  availableMarkets: string[];
  hasMorePast: boolean;
}

async function getSteamMoves(): Promise<SteamMovesData> {
  const season = CURRENT_SEASON;

  try {
    const { env } = await getCloudflareContext({ async: true });

    const [steamMoves, availableMarkets, availableDates] = await Promise.all([
      getUpcomingSteamMoves(env.DB, { hoursAhead: 24 * 7 }),
      getAvailableMarkets(env.DB),
      getAvailableDates(env.DB),
    ]);

    const todayStr = new Date().toISOString().split("T")[0];
    const hasMorePast = availableDates.some((d) => d < todayStr);

    return {
      season,
      steamMoves,
      generatedAt: new Date().toISOString(),
      availableMarkets,
      hasMorePast,
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
