import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { LEAGUES, CURRENT_SEASON } from '@odds-collector/shared';
import type { SteamMove } from '@/app/steam-moves/page';

export interface SteamMovesResponse {
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  hasMorePast: boolean;
  oldestDate?: string;
}

// Split file structures
interface SteamMovesRecent {
  leagueId: string;
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  availableMarkets: string[];
  fromDate: string;
  toDate: string;
}

interface SteamMovesByDate {
  leagueId: string;
  season: string;
  date: string;
  steamMoves: SteamMove[];
  generatedAt: string;
}

interface SteamMovesDatesIndex {
  leagueId: string;
  season: string;
  availableDates: string[];
  availableMarkets: string[];
  generatedAt: string;
}

/**
 * Steam moves API - reads split pre-computed files from R2
 *
 * Supports two modes:
 * 1. ?type=recent - Load last 14 days (uses steam_moves_recent.json)
 * 2. ?date=YYYY-MM-DD - Load a specific date (uses steam_moves_by_date/{date}.json)
 *
 * This avoids loading the large full aggregate file.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season') || CURRENT_SEASON;
  const type = searchParams.get('type'); // 'recent'
  const date = searchParams.get('date'); // 'YYYY-MM-DD'

  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.ODDS_BUCKET;

    const allSteamMoves: SteamMove[] = [];
    let hasOlderMatches = false;
    let oldestMatchDate: string | undefined;

    if (type === 'recent') {
      // Load recent files (last 14 days)
      for (const league of LEAGUES) {
        const recentKey = `odds_data_v2/leagues/${league.id}/${season}/steam_moves_recent.json`;
        const recentObject = await bucket.get(recentKey);

        if (!recentObject) continue;

        const recent: SteamMovesRecent = await recentObject.json();
        allSteamMoves.push(...recent.steamMoves);

        // Check if there's older data
        const datesKey = `odds_data_v2/leagues/${league.id}/${season}/steam_moves_dates.json`;
        const datesObject = await bucket.get(datesKey);
        if (datesObject) {
          const datesIndex: SteamMovesDatesIndex = await datesObject.json();
          const recentFromDate = recent.fromDate;
          hasOlderMatches = datesIndex.availableDates.some((d) => d < recentFromDate);
        }
      }

      // Track oldest date
      if (allSteamMoves.length > 0) {
        oldestMatchDate = allSteamMoves.reduce(
          (oldest, m) => (m.kickoffTime < oldest ? m.kickoffTime : oldest),
          allSteamMoves[0].kickoffTime
        );
      }
    } else if (date) {
      // Load specific date files
      for (const league of LEAGUES) {
        const dateKey = `odds_data_v2/leagues/${league.id}/${season}/steam_moves_by_date/${date}.json`;
        const dateObject = await bucket.get(dateKey);

        if (!dateObject) continue;

        const dateData: SteamMovesByDate = await dateObject.json();
        allSteamMoves.push(...dateData.steamMoves);
      }

      oldestMatchDate = date + 'T00:00:00Z';

      // Check if there's older data
      for (const league of LEAGUES) {
        const datesKey = `odds_data_v2/leagues/${league.id}/${season}/steam_moves_dates.json`;
        const datesObject = await bucket.get(datesKey);
        if (datesObject) {
          const datesIndex: SteamMovesDatesIndex = await datesObject.json();
          hasOlderMatches = datesIndex.availableDates.some((d) => d < date);
          if (hasOlderMatches) break;
        }
      }
    } else {
      // Default: return empty with info about available data
      return NextResponse.json({
        season,
        steamMoves: [],
        generatedAt: new Date().toISOString(),
        hasMorePast: true,
        message: 'Use ?type=recent or ?date=YYYY-MM-DD to load data',
      });
    }

    // Sort by kickoff time (most recent first for past matches)
    allSteamMoves.sort((a, b) =>
      new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime()
    );

    const response: SteamMovesResponse = {
      season,
      steamMoves: allSteamMoves,
      generatedAt: new Date().toISOString(),
      hasMorePast: hasOlderMatches,
      oldestDate: oldestMatchDate,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching steam moves:', error);
    return NextResponse.json(
      { error: 'Failed to fetch steam moves' },
      { status: 500 }
    );
  }
}
