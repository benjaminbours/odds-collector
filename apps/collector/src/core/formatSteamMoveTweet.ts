/**
 * Pure function — turns a detected steam move into a tweet body.
 *
 * Output shape (≤ 280 chars; X counts URLs as 23 via t.co shortening):
 *
 *   🔥 STEAM MOVE — Pinnacle
 *
 *   Napoli vs Cremonese
 *   Money Line — Napoli: 1.85 → 1.55 (-16.2%)
 *   Window: T-4h → T-90m
 *
 *   https://market.oddslab.gg/leagues/italy-serie-a/matches/napoli-cremonese-2026-04-24
 *
 *   #SerieA #SteamMove
 *
 * Hashtag policy: 2 hashtags max (Twitter best-practice). #SteamMove for the
 * niche, plus one league-level tag from the league config. Team hashtags are
 * intentionally omitted — adds noise, no convention winner, and the team
 * names sit in the body (and in the unfurled URL preview) for searchability.
 */

import type { SteamMove } from "@odds-collector/shared";

const DASHBOARD_BASE_URL = "https://market.oddslab.gg";

const TIMING_LABELS: Record<string, string> = {
  opening: "T-7d",
  mid_week: "T-3d",
  day_before: "T-24h",
  t_minus_4h: "T-4h",
  t_minus_90m: "T-90m",
  t_minus_30m: "T-30m",
  closing: "T-10m",
};

export interface FormatSteamMoveTweetParams {
  move: SteamMove;
  leagueHashtag: string;
}

export function formatSteamMoveTweet(
  params: FormatSteamMoveTweetParams,
): string {
  const { move, leagueHashtag } = params;
  const movementSigned = move.movement.toFixed(1);
  const movementPrefix = move.movement > 0 ? "+" : "";
  const fromOdds = move.fromOdds.toFixed(2);
  const toOdds = move.toOdds.toFixed(2);

  const outcomeLabel =
    move.point !== undefined && move.point !== null
      ? `${move.outcome} ${formatPoint(move.point)}`
      : move.outcome;

  const fromLabel = TIMING_LABELS[move.fromTiming] ?? move.fromTiming;
  const toLabel = TIMING_LABELS[move.toTiming] ?? move.toTiming;

  const matchUrl = buildMatchUrl(move);

  const lines = [
    `🔥 STEAM MOVE — ${move.bookmaker}`,
    "",
    `${move.homeTeam} vs ${move.awayTeam}`,
    `${move.marketLabel} — ${outcomeLabel}: ${fromOdds} → ${toOdds} (${movementPrefix}${movementSigned}%)`,
    `Window: ${fromLabel} → ${toLabel}`,
    "",
    matchUrl,
    "",
    `#${leagueHashtag} #SteamMove`,
  ];

  return lines.join("\n");
}

export function buildMatchUrl(
  move: Pick<SteamMove, "leagueId" | "matchKey">,
): string {
  // match_key  italy_serie_a → italy-serie-a (league)
  // match_key  napoli_cremonese_2026-04-24 → napoli-cremonese-2026-04-24 (match)
  const leagueSlug = move.leagueId.replace(/_/g, "-");
  const matchSlug = move.matchKey.replace(/_/g, "-");
  return `${DASHBOARD_BASE_URL}/leagues/${leagueSlug}/matches/${matchSlug}`;
}

function formatPoint(point: number): string {
  // Spreads look like "+1.5" / "-1.5"; totals look like "Over 2.5" already
  // (the outcome name carries Over/Under, we just append the number).
  return point > 0 ? `+${point}` : `${point}`;
}
