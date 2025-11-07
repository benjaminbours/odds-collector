/**
 * League configurations for footdata
 * Simplified version for Cloudflare Worker
 */

export interface LeagueConfig {
  id: string;
  name: string;
  oddsApiKey: string;
  currentSeason: string;
}

export const LEAGUES: LeagueConfig[] = [
  {
    id: "england_premier_league",
    name: "English Premier League",
    oddsApiKey: "soccer_epl",
    currentSeason: "2025-2026",
  },
  {
    id: "italy_serie_a",
    name: "Italian Serie A",
    oddsApiKey: "soccer_italy_serie_a",
    currentSeason: "2025-2026",
  },
];

export function getLeagueConfig(leagueId: string): LeagueConfig | undefined {
  return LEAGUES.find((league) => league.id === leagueId);
}
