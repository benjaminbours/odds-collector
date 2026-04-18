import { DateGroupedMatches } from "@/components/DateGroupedMatches";
import { Breadcrumb } from "@/components/Breadcrumb";
import { getLeagueById, CURRENT_SEASON } from "@odds-collector/shared";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getLeagueMatches } from "@/lib/matches-db";
import { fromSlug } from "@/lib/url-utils";
import "@/styles/league-page.css";

interface PageProps {
  params: Promise<{ leagueId: string }>;
}

export default async function LeaguePage({ params }: PageProps) {
  const { leagueId: leagueSlug } = await params;
  // Convert URL slug (dashes) to internal ID (underscores)
  const leagueId = fromSlug(leagueSlug);
  const league = getLeagueById(leagueId);

  if (!league) {
    notFound();
  }

  const season = CURRENT_SEASON;
  const { env } = await getCloudflareContext({ async: true });
  const matches = await getLeagueMatches(env.DB, leagueId, season);

  if (matches.length === 0) {
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

  return (
    <div className="league-page">
      <Breadcrumb items={[{ label: league.name }]} />

      <header className="league-page__header">
        <h1 className="league-page__title">{league.name}</h1>
        <p className="league-page__subtitle">
          Season {season} &middot; {matches.length} matches tracked
        </p>
      </header>

      <DateGroupedMatches matches={matches} leagueId={leagueId} />
    </div>
  );
}
