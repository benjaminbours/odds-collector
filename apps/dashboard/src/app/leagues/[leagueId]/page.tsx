import { MatchCard } from "@/components/MatchCard";
import { getLeagueById, CURRENT_SEASON } from "@odds-collector/shared";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MatchIndex } from "@odds-collector/shared";
import "@/styles/league-page.css";

interface PageProps {
  params: Promise<{ leagueId: string }>;
}

async function getMatches(leagueId: string, season: string) {
  const { env } = await getCloudflareContext({ async: true });
  const bucket = env.ODDS_BUCKET;
  console.log("BUCKET", bucket);

  const indexKey = `odds_data_v2/leagues/${leagueId}/${season}/by_match.json`;
  console.log("HERE index key", indexKey);
  const indexObject = await bucket.get(indexKey);

  console.log("HERE index object", indexObject);

  if (!indexObject) {
    return null;
  }

  const indexData: MatchIndex = await indexObject.json();
  return indexData;
}

export default async function LeaguePage({ params }: PageProps) {
  const { leagueId } = await params;
  const league = getLeagueById(leagueId);

  if (!league) {
    notFound();
  }

  const season = CURRENT_SEASON;
  const indexData = await getMatches(leagueId, season);

  if (!indexData) {
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

  // Convert matches to array and sort
  const now = new Date();
  const allMatches = Object.entries(indexData.matches)
    .map(([key, match]) => ({
      key,
      ...match,
    }))
    .sort((a, b) => {
      const timeA = new Date(a.kickoffTime).getTime();
      const timeB = new Date(b.kickoffTime).getTime();
      return timeB - timeA;
    });

  // Separate upcoming and past matches
  const upcomingMatches = allMatches.filter(
    (m) => new Date(m.kickoffTime) > now
  );
  const pastMatches = allMatches.filter((m) => new Date(m.kickoffTime) <= now);

  return (
    <div className="league-page">
      <header className="league-page__header">
        <h1 className="league-page__title">{league.name}</h1>
        <p className="league-page__subtitle">
          Season {season} &middot; {allMatches.length} matches tracked
        </p>
      </header>

      {upcomingMatches.length > 0 && (
        <section className="league-page__section">
          <h2 className="league-page__section-title">Upcoming Matches</h2>
          <div className="league-page__matches">
            {upcomingMatches.map((match) => (
              <MatchCard key={match.key} match={match} leagueId={leagueId} />
            ))}
          </div>
        </section>
      )}

      {pastMatches.length > 0 && (
        <section className="league-page__section">
          <h2 className="league-page__section-title">Recent Matches</h2>
          <div className="league-page__matches">
            {pastMatches.slice(0, 20).map((match) => (
              <MatchCard key={match.key} match={match} leagueId={leagueId} />
            ))}
          </div>
          {pastMatches.length > 20 && (
            <p className="league-page__more">
              Showing 20 of {pastMatches.length} past matches
            </p>
          )}
        </section>
      )}
    </div>
  );
}
