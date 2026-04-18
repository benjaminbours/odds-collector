import {
  getLeagueById,
  CURRENT_SEASON,
  OddsSnapshot,
} from "@odds-collector/shared";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MatchOddsAnalysis } from "@/components/MatchOddsAnalysis";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getMatchByKey } from "@/lib/matches-db";
import { fromSlug, toSlug } from "@/lib/url-utils";
import "@/styles/match-page.css";

interface PageProps {
  params: Promise<{ leagueId: string; matchKey: string }>;
}

async function getMatchDetails(
  leagueId: string,
  season: string,
  matchKey: string
) {
  const { env } = await getCloudflareContext({ async: true });
  const match = await getMatchByKey(env.DB, leagueId, season, matchKey);
  if (!match) return null;

  // Snapshot payloads still live on R2 — fetch them in parallel by the paths D1 gave us.
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

  return {
    matchKey: match.matchKey,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    matchDate: match.matchDate,
    kickoffTime: match.kickoffTime,
    eventId: match.eventId,
    snapshots,
  };
}

export default async function MatchPage({ params }: PageProps) {
  const { leagueId: leagueSlug, matchKey: matchSlug } = await params;
  // Convert URL slugs (dashes) to internal IDs (underscores)
  const leagueId = fromSlug(leagueSlug);
  const matchKey = fromSlug(decodeURIComponent(matchSlug));
  const league = getLeagueById(leagueId);

  if (!league) {
    notFound();
  }

  const season = CURRENT_SEASON;
  const match = await getMatchDetails(leagueId, season, matchKey);

  if (!match) {
    notFound();
  }

  const kickoffDate = new Date(match.kickoffTime);
  const formattedDate = kickoffDate.toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const matchTitle = `${match.homeTeam} vs ${match.awayTeam}`;

  return (
    <div className="match-page">
      <Breadcrumb
        items={[
          { label: league.name, href: `/leagues/${toSlug(leagueId)}` },
          { label: matchTitle },
        ]}
      />

      <header className="match-page__header">
        <p className="match-page__league">{league.name}</p>
        <h1 className="match-page__title">{matchTitle}</h1>
        <p className="match-page__date">{formattedDate}</p>
      </header>

      <MatchOddsAnalysis
        snapshots={match.snapshots}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
      />
    </div>
  );
}
