/**
 * League configuration types
 */

/**
 * League configuration
 */
export interface LeagueConfig {
  /** Unique league identifier */
  id: string;
  /** Display name */
  name: string;
  /** Provider-specific league key (e.g., 'soccer_epl' for The Odds API) */
  providerKey: string;
  /** Current season (e.g., '2024-2025') */
  currentSeason: string;
  /** Country code for flag display */
  countryCode: string;
}

/**
 * Available leagues for the dashboard
 */
export const LEAGUES: LeagueConfig[] = [
  {
    id: 'england_premier_league',
    name: 'English Premier League',
    providerKey: 'soccer_epl',
    currentSeason: '2024-2025',
    countryCode: 'gb-eng',
  },
  {
    id: 'italy_serie_a',
    name: 'Italian Serie A',
    providerKey: 'soccer_italy_serie_a',
    currentSeason: '2024-2025',
    countryCode: 'it',
  },
];

/**
 * Get league by ID
 */
export function getLeagueById(id: string): LeagueConfig | undefined {
  return LEAGUES.find((league) => league.id === id);
}
