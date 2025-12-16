import { LeagueCard } from '@/components/LeagueCard';
import { LEAGUES } from '@odds-collector/shared';
import '@/styles/page.css';

export default function HomePage() {
  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Bookmaker Intelligence</h1>
        <p className="page__subtitle">
          Track odds movements across 4 snapshot timings. Identify steam moves
          and market sentiment.
        </p>
      </header>

      <section className="page__section">
        <h2 className="page__section-title">Select a League</h2>
        <div className="grid grid--cols-2">
          {LEAGUES.map((league) => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </div>
      </section>
    </div>
  );
}
