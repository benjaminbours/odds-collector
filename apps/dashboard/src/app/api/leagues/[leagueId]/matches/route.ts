import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CURRENT_SEASON } from "@odds-collector/shared";
import type { MatchIndex } from "@odds-collector/shared";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { leagueId } = await params;
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season") || CURRENT_SEASON;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.ODDS_BUCKET;

    // Fetch the match index from R2
    const indexKey = `odds_data_v2/leagues/${leagueId}/${season}/by_match.json`;
    const indexObject = await bucket.get(indexKey);

    if (!indexObject) {
      return NextResponse.json(
        { error: "No matches found for this league/season" },
        { status: 404 }
      );
    }

    const indexData: MatchIndex = await indexObject.json();

    // Convert matches object to array with keys and sort by date
    const matches = Object.entries(indexData.matches)
      .map(([key, match]) => ({
        key,
        ...match,
      }))
      .sort((a, b) => {
        // Sort by kickoff time, most recent first
        const timeA = new Date(a.kickoffTime).getTime();
        const timeB = new Date(b.kickoffTime).getTime();
        return timeB - timeA;
      });

    return NextResponse.json({
      leagueId,
      season,
      lastUpdated: indexData.lastUpdated,
      matches,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
