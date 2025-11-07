/**
 * Path generation utilities for consistent file organization
 */

/**
 * Format team name for use in file paths
 * Replaces spaces with underscores
 */
export function formatTeamNameForPath(teamName: string): string {
  return teamName.replace(/\s+/g, '_');
}

/**
 * Generate snapshot file path
 *
 * Pattern: {league}/{season}/snapshots/{timing}/{date}/{homeTeam}_vs_{awayTeam}_{eventIdShort}.json
 *
 * @param leagueId League identifier
 * @param season Season (e.g., '2024-2025')
 * @param timing Timing name (e.g., 'opening', 'closing')
 * @param date Match date (YYYY-MM-DD)
 * @param homeTeam Home team name
 * @param awayTeam Away team name
 * @param eventId Event ID
 * @returns Relative path for snapshot file
 */
export function generateSnapshotPath(
  leagueId: string,
  season: string,
  timing: string,
  date: string,
  homeTeam: string,
  awayTeam: string,
  eventId: string
): string {
  const home = formatTeamNameForPath(homeTeam);
  const away = formatTeamNameForPath(awayTeam);
  const shortEventId = eventId.slice(0, 7);

  return `${leagueId}/${season}/snapshots/${timing}/${date}/${home}_vs_${away}_${shortEventId}.json`;
}

/**
 * Generate index file path
 *
 * @param leagueId League identifier
 * @param season Season
 * @param indexType Type of index ('by_match', 'by_date', 'by_team')
 * @returns Relative path for index file
 */
export function generateIndexPath(
  leagueId: string,
  season: string,
  indexType: 'by_match' | 'by_date' | 'by_team'
): string {
  return `${leagueId}/${season}/index/${indexType}.json`;
}

/**
 * Generate match key for indexing
 *
 * Pattern: {homeTeam}_{awayTeam}_{date}
 *
 * @param homeTeam Home team name
 * @param awayTeam Away team name
 * @param date Match date (YYYY-MM-DD)
 * @returns Match key
 */
export function generateMatchKey(
  homeTeam: string,
  awayTeam: string,
  date: string
): string {
  const home = formatTeamNameForPath(homeTeam);
  const away = formatTeamNameForPath(awayTeam);
  return `${home}_${away}_${date}`;
}

/**
 * Infer season from match date
 *
 * European seasons run from August to May
 *
 * @param matchDate Match date (ISO string or YYYY-MM-DD)
 * @returns Season string (e.g., '2024-2025')
 */
export function inferSeasonFromDate(matchDate: string): string {
  const date = new Date(matchDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  // European seasons typically run from August to May
  if (month >= 8) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * Calculate scheduled time for a job
 *
 * @param kickoffTime Kickoff time (ISO string)
 * @param hoursBeforeKickoff Hours before kickoff to schedule
 * @returns Scheduled time (ISO string)
 */
export function calculateScheduledTime(
  kickoffTime: string,
  hoursBeforeKickoff: number
): string {
  const kickoff = new Date(kickoffTime);
  const scheduled = new Date(kickoff.getTime() - hoursBeforeKickoff * 60 * 60 * 1000);
  return scheduled.toISOString();
}

/**
 * Generate unique job ID
 *
 * @param eventId Event ID
 * @param timing Timing name
 * @returns Unique job ID
 */
export function generateJobId(eventId: string, timing: string): string {
  return `${eventId}_${timing}`;
}
