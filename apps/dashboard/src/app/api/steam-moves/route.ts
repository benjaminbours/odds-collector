import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CURRENT_SEASON } from "@odds-collector/shared";
import type { SteamMove } from "@/app/steam-moves/page";
import {
  getRecentSteamMoves,
  getSteamMovesForDate,
  getAvailableDates,
} from "@/lib/steam-moves-db";

export interface SteamMovesResponse {
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  hasMorePast: boolean;
  oldestDate?: string;
}

/**
 * Steam moves API — reads from D1 (`steam_moves` + `steam_moves_dates` via
 * DISTINCT DATE()).
 *
 * Supports two modes:
 * 1. ?type=recent — past 14 days (getRecentSteamMoves)
 * 2. ?date=YYYY-MM-DD — specific date (getSteamMovesForDate)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season") || CURRENT_SEASON;
  const type = searchParams.get("type"); // 'recent'
  const date = searchParams.get("date"); // 'YYYY-MM-DD'

  try {
    const { env } = await getCloudflareContext({ async: true });

    let steamMoves: SteamMove[];
    let oldestDate: string | undefined;
    let compareDate: string;

    if (type === "recent") {
      const [moves, availableDates] = await Promise.all([
        getRecentSteamMoves(env.DB, { daysBack: 14 }),
        getAvailableDates(env.DB),
      ]);
      steamMoves = moves;
      if (moves.length > 0) {
        oldestDate = moves.reduce(
          (oldest, m) => (m.kickoffTime < oldest ? m.kickoffTime : oldest),
          moves[0].kickoffTime
        );
      }
      // Does anything older than the 14-day window exist?
      const recentStart = new Date();
      recentStart.setDate(recentStart.getDate() - 14);
      compareDate = recentStart.toISOString().split("T")[0];
      const hasMorePast = availableDates.some((d) => d < compareDate);

      return NextResponse.json({
        season,
        steamMoves,
        generatedAt: new Date().toISOString(),
        hasMorePast,
        oldestDate,
      } satisfies SteamMovesResponse);
    }

    if (date) {
      const [moves, availableDates] = await Promise.all([
        getSteamMovesForDate(env.DB, date),
        getAvailableDates(env.DB),
      ]);
      steamMoves = moves;
      oldestDate = date + "T00:00:00Z";
      const hasMorePast = availableDates.some((d) => d < date);

      return NextResponse.json({
        season,
        steamMoves,
        generatedAt: new Date().toISOString(),
        hasMorePast,
        oldestDate,
      } satisfies SteamMovesResponse);
    }

    // Default: empty with usage hint.
    return NextResponse.json({
      season,
      steamMoves: [],
      generatedAt: new Date().toISOString(),
      hasMorePast: true,
      message: "Use ?type=recent or ?date=YYYY-MM-DD to load data",
    });
  } catch (error) {
    console.error("Error fetching steam moves:", error);
    return NextResponse.json(
      { error: "Failed to fetch steam moves" },
      { status: 500 }
    );
  }
}
