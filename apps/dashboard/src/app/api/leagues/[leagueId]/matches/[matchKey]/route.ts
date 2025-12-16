import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CURRENT_SEASON } from "@odds-collector/shared";
import type { MatchIndex, OddsSnapshot } from "@odds-collector/shared";

interface RouteParams {
  params: Promise<{ leagueId: string; matchKey: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { leagueId, matchKey } = await params;
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season") || CURRENT_SEASON;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.ODDS_BUCKET;

    // Fetch the match index to get snapshot paths
    const indexKey = `odds_data_v2/leagues/${leagueId}/${season}/by_match.json`;
    const indexObject = await bucket.get(indexKey);

    if (!indexObject) {
      return NextResponse.json(
        { error: "Match index not found" },
        { status: 404 }
      );
    }

    const indexData: MatchIndex = await indexObject.json();
    const decodedMatchKey = decodeURIComponent(matchKey);
    const matchEntry = indexData.matches[decodedMatchKey];

    if (!matchEntry) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Fetch all snapshots in parallel
    const snapshotPromises = Object.entries(matchEntry.snapshots).map(
      async ([timing, path]) => {
        const snapshotObject = await bucket.get(path);
        if (!snapshotObject) {
          return { timing, snapshot: null };
        }
        const snapshot: OddsSnapshot = await snapshotObject.json();
        return { timing, snapshot };
      }
    );

    const snapshotResults = await Promise.all(snapshotPromises);

    // Build snapshots map
    const snapshots: Record<string, OddsSnapshot> = {};
    for (const { timing, snapshot } of snapshotResults) {
      if (snapshot) {
        snapshots[timing] = snapshot;
      }
    }

    return NextResponse.json({
      leagueId,
      season,
      matchKey: decodedMatchKey,
      homeTeam: matchEntry.homeTeam,
      awayTeam: matchEntry.awayTeam,
      matchDate: matchEntry.matchDate,
      kickoffTime: matchEntry.kickoffTime,
      eventId: matchEntry.eventId,
      snapshots,
    });
  } catch (error) {
    console.error("Error fetching match details:", error);
    return NextResponse.json(
      { error: "Failed to fetch match details" },
      { status: 500 }
    );
  }
}
