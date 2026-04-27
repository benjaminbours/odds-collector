/**
 * League configurations for footdata
 * Simplified version for Cloudflare Worker
 */

import { CURRENT_SEASON } from "@odds-collector/shared";

export interface WorkerLeagueConfig {
  id: string;
  name: string;
  oddsApiKey: string;
  /** Hashtag (sans `#`) used in X posts for this league. */
  hashtag: string;
}

export const LEAGUES: WorkerLeagueConfig[] = [
  {
    id: "england_premier_league",
    name: "English Premier League",
    oddsApiKey: "soccer_epl",
    hashtag: "PremierLeague",
  },
  {
    id: "italy_serie_a",
    name: "Italian Serie A",
    oddsApiKey: "soccer_italy_serie_a",
    hashtag: "SerieA",
  },
];

export function getLeagueConfig(leagueId: string): WorkerLeagueConfig | undefined {
  return LEAGUES.find((league) => league.id === leagueId);
}

// Re-export for convenience
export { CURRENT_SEASON };
