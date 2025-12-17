import Link from 'next/link';
import { MatchIndexEntry } from '@odds-collector/shared';
import { toSlug } from '@/lib/url-utils';
import '@/styles/match-card.css';

interface MatchCardProps {
  match: MatchIndexEntry & { key: string };
  leagueId: string;
  leagueName?: string;
}

const TIMING_ORDER = ['opening', 'mid_week', 'day_before', 'closing'];
const TIMING_LABELS: Record<string, string> = {
  opening: 'O',
  mid_week: 'M',
  day_before: 'D',
  closing: 'C',
};

export function MatchCard({ match, leagueId, leagueName }: MatchCardProps) {
  const availableTimings = Object.keys(match.snapshots);
  const cardClass = leagueName ? 'match-card match-card--with-league' : 'match-card';

  return (
    <Link
      href={`/leagues/${toSlug(leagueId)}/matches/${toSlug(match.key)}`}
      className={cardClass}
    >
      <div className="match-card__content">
        <div className="match-card__info">
          <div className="match-card__teams">
            {match.homeTeam} vs {match.awayTeam}
          </div>
          <div className="match-card__date">
            {new Date(match.kickoffTime).toLocaleString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        <div className="match-card__right">
          {leagueName && (
            <span className="match-card__league">{leagueName}</span>
          )}
          <div className="match-card__snapshots">
            {TIMING_ORDER.map((timing) => {
              const isAvailable = availableTimings.includes(timing);
              const className = isAvailable
                ? 'match-card__snapshot-badge match-card__snapshot-badge--available'
                : 'match-card__snapshot-badge match-card__snapshot-badge--unavailable';

              return (
                <span
                  key={timing}
                  className={className}
                  title={timing.replace('_', ' ')}
                >
                  {TIMING_LABELS[timing]}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </Link>
  );
}
