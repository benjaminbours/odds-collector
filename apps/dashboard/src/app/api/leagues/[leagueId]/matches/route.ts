import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CURRENT_SEASON } from "@odds-collector/shared";
import { getLeagueMatches } from "@/lib/matches-db";

interface RouteParams {
  params: Promise<{ leagueId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { leagueId } = await params;
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season") || CURRENT_SEASON;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const matches = await getLeagueMatches(env.DB, leagueId, season);

    if (matches.length === 0) {
      return NextResponse.json(
        { error: "No matches found for this league/season" },
        { status: 404 }
      );
    }

    // Sort most-recent first to match the previous API contract.
    const sorted = [...matches].sort(
      (a, b) =>
        new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime()
    );

    return NextResponse.json({
      leagueId,
      season,
      matches: sorted,
    });
  } catch (error) {
    console.error("Error fetching matches:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 500 }
    );
  }
}
