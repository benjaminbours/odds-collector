/**
 * League configuration types
 */

/**
 * Current season - single source of truth for the entire application
 * Update this value when a new season starts
 */
export const CURRENT_SEASON = '2025-2026';

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
    countryCode: 'gb-eng',
  },
  {
    id: 'italy_serie_a',
    name: 'Italian Serie A',
    providerKey: 'soccer_italy_serie_a',
    countryCode: 'it',
  },
  {
    id: 'world_cup_2026',
    name: 'FIFA World Cup 2026',
    providerKey: 'soccer_fifa_world_cup',
    countryCode: 'world',
  },
];

/**
 * Get league by ID
 */
export function getLeagueById(id: string): LeagueConfig | undefined {
  return LEAGUES.find((league) => league.id === id);
}
