import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { CURRENT_SEASON } from "@odds-collector/shared";
import type { OddsSnapshot } from "@odds-collector/shared";
import { getMatchByKey } from "@/lib/matches-db";

interface RouteParams {
  params: Promise<{ leagueId: string; matchKey: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { leagueId, matchKey } = await params;
  const { searchParams } = new URL(request.url);
  const season = searchParams.get("season") || CURRENT_SEASON;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const decodedMatchKey = decodeURIComponent(matchKey);
    const match = await getMatchByKey(env.DB, leagueId, season, decodedMatchKey);

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Snapshot payloads still live on R2 — pull each by the path D1 gave us.
    const bucket = env.ODDS_BUCKET;
    const snapshotPromises = Object.entries(match.snapshots).map(
      async ([timing, path]) => {
        const snapshotObject = await bucket.get(path);
        if (!snapshotObject) return { timing, snapshot: null };
        const snapshot: OddsSnapshot = await snapshotObject.json();
        return { timing, snapshot };
      }
    );
    const snapshotResults = await Promise.all(snapshotPromises);

    const snapshots: Record<string, OddsSnapshot> = {};
    for (const { timing, snapshot } of snapshotResults) {
      if (snapshot) snapshots[timing] = snapshot;
    }

    return NextResponse.json({
      leagueId,
      season,
      matchKey: match.matchKey,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      matchDate: match.matchDate,
      kickoffTime: match.kickoffTime,
      eventId: match.eventId,
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
