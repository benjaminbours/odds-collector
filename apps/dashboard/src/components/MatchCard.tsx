import Link from 'next/link';
import { TIMING_ORDER } from '@odds-collector/shared';
import type { MatchWithKey } from '@/lib/matches-db';
import { toSlug } from '@/lib/url-utils';
import '@/styles/match-card.css';

interface MatchCardProps {
  match: MatchWithKey;
  leagueId: string;
  leagueName?: string;
}

const TIMING_LABELS: Record<string, string> = {
  t_minus_35d: '35d',
  t_minus_28d: '28d',
  t_minus_21d: '21d',
  t_minus_14d: '14d',
  opening: 'O',
  mid_week: 'M',
  day_before: 'D',
  t_minus_4h: '4h',
  t_minus_90m: '90',
  t_minus_60m: '60',
  t_minus_30m: '30',
  t_minus_15m: '15',
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
