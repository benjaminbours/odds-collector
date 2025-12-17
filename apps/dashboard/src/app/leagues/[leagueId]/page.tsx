import { DateGroupedMatches } from "@/components/DateGroupedMatches";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getLeagueById, CURRENT_SEASON } from "@odds-collector/shared";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MatchIndex, DateIndex } from "@odds-collector/shared";
import "@/styles/league-page.css";

interface PageProps {
  params: Promise<{ leagueId: string }>;
}

async function getMatchesData(leagueId: string, season: string) {
  const { env } = await getCloudflareContext({ async: true });
  const bucket = env.ODDS_BUCKET;

  // Fetch both indexes in parallel
  const [matchIndexObject, dateIndexObject] = await Promise.all([
    bucket.get(`odds_data_v2/leagues/${leagueId}/${season}/by_match.json`),
    bucket.get(`odds_data_v2/leagues/${leagueId}/${season}/by_date.json`),
  ]);

  if (!matchIndexObject || !dateIndexObject) {
    return null;
  }

  const matchIndex: MatchIndex = await matchIndexObject.json();
  const dateIndex: DateIndex = await dateIndexObject.json();

  return { matchIndex, dateIndex };
}

export default async function LeaguePage({ params }: PageProps) {
  const { leagueId } = await params;
  const league = getLeagueById(leagueId);

  if (!league) {
    notFound();
  }

  const season = CURRENT_SEASON;
  const data = await getMatchesData(leagueId, season);

  if (!data) {
    return (
      <div className="league-page">
        <header className="league-page__header">
          <h1 className="league-page__title">{league.name}</h1>
          <p className="league-page__subtitle">Season {season}</p>
        </header>
        <div className="league-page__empty">
          <p>No matches found for this season.</p>
        </div>
      </div>
    );
  }

  const { matchIndex, dateIndex } = data;
  const totalMatches = Object.keys(matchIndex.matches).length;

  return (
    <div className="league-page">
      <Breadcrumb items={[{ label: league.name }]} />

      <header className="league-page__header">
        <h1 className="league-page__title">{league.name}</h1>
        <p className="league-page__subtitle">
          Season {season} &middot; {totalMatches} matches tracked
        </p>
      </header>

      <DateGroupedMatches
        dateIndex={dateIndex}
        matchIndex={matchIndex}
        leagueId={leagueId}
      />
    </div>
  );
}
