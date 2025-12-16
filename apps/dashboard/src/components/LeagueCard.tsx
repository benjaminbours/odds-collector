import Link from 'next/link';
import { LeagueConfig } from '@odds-collector/shared';
import '@/styles/league-card.css';

interface LeagueCardProps {
  league: LeagueConfig;
}

// Simple flag emoji mapping
const FLAG_EMOJIS: Record<string, string> = {
  'gb-eng': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  it: '🇮🇹',
};

export function LeagueCard({ league }: LeagueCardProps) {
  const flag = FLAG_EMOJIS[league.countryCode] || '⚽';

  return (
    <Link href={`/leagues/${league.id}`} className="league-card">
      <div className="league-card__content">
        <span className="league-card__flag">{flag}</span>
        <div className="league-card__info">
          <h2 className="league-card__name">{league.name}</h2>
          <p className="league-card__season">{league.currentSeason}</p>
        </div>
      </div>
    </Link>
  );
}
