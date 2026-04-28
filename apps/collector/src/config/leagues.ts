/**
 * League configurations for footdata
 * Simplified version for Cloudflare Worker
 */

import { CURRENT_SEASON } from "@odds-collector/shared";
import type { TimingPresetName } from "./timingPresets";

export interface WorkerLeagueConfig {
  id: string;
  name: string;
  oddsApiKey: string;
  /** Hashtag (sans `#`) used in X posts for this league. */
  hashtag: string;
  /**
   * Optional per-league timing preset name. Overrides the env-level
   * TIMING_PRESET when set. Used for tournaments needing a denser pre-match
   * curve (e.g. WORLD_CUP) than regular league play (COMPREHENSIVE).
   */
  timingPreset?: TimingPresetName;
  /**
   * Optional fixed season string for storage/D1 keys. Required for
   * tournaments whose match dates don't fit the European Aug–May season
   * convention (e.g. the 2026 World Cup runs Jun–Jul 2026 — season "2026").
   */
  season?: string;
  /**
   * Whether to apply team name normalization. Enabled by default; set to
   * false for sources that don't yet have a normalization mapping (e.g. the
   * World Cup roster of national teams).
   */
  normalizeTeamNames?: boolean;
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
  {
    id: "world_cup_2026",
    name: "FIFA World Cup 2026",
    oddsApiKey: "soccer_fifa_world_cup",
    hashtag: "WorldCup2026",
    timingPreset: "WORLD_CUP",
    season: "2026",
    normalizeTeamNames: false,
  },
];

export function getLeagueConfig(leagueId: string): WorkerLeagueConfig | undefined {
  return LEAGUES.find((league) => league.id === leagueId);
}

// Re-export for convenience
export { CURRENT_SEASON };
