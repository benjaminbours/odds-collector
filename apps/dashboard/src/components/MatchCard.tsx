import Link from 'next/link';
import { MatchIndexEntry } from '@odds-collector/shared';
import '@/styles/match-card.css';

interface MatchCardProps {
  match: MatchIndexEntry & { key: string };
  leagueId: string;
}

const TIMING_ORDER = ['opening', 'mid_week', 'day_before', 'closing'];
const TIMING_LABELS: Record<string, string> = {
  opening: 'O',
  mid_week: 'M',
  day_before: 'D',
  closing: 'C',
};

export function MatchCard({ match, leagueId }: MatchCardProps) {
  const availableTimings = Object.keys(match.snapshots);

  return (
    <Link
      href={`/leagues/${leagueId}/matches/${encodeURIComponent(match.key)}`}
      className="match-card"
    >
      <div className="match-card__content">
        <div>
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
    </Link>
  );
}
