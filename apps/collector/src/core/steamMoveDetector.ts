import type { OddsSnapshot } from "@odds-collector/shared";
import type { UpsertSteamMoveInput } from "./SteamMovesRepository";
import { toPointKey } from "./SteamMovesRepository";

// Ordered curve from earliest to latest. Detection chains snapshots by
// looking at the immediately preceding entry (`getPrecedingTiming`); any
// timing not present here will fire snapshots without triggering detection.
// Tournament-only entries (t_minus_35d → t_minus_14d, t_minus_60m,
// t_minus_15m) are inert for league play because no jobs are scheduled at
// those timings, but they must be present so the World Cup preset can chain.
export const TIMING_ORDER = [
  "t_minus_35d",
  "t_minus_28d",
  "t_minus_21d",
  "t_minus_14d",
  "opening",
  "mid_week",
  "day_before",
  "t_minus_4h",
  "t_minus_90m",
  "t_minus_60m",
  "t_minus_30m",
  "t_minus_15m",
  "closing",
] as const;

export const STEAM_THRESHOLD = 5;

const ALLOWED_MARKETS = [
  "h2h",
  "spreads",
  "alternate_spreads",
  "totals",
  "alternate_totals",
  "btts",
  "double_chance",
];

export const MARKET_LABELS: Record<string, string> = {
  h2h: "Money Line",
  spreads: "Spread",
  alternate_spreads: "Spread",
  totals: "Totals",
  alternate_totals: "Totals",
  btts: "Both Teams to Score",
  double_chance: "Double Chance",
};

export function getPrecedingTiming(timing: string): string | null {
  const idx = TIMING_ORDER.indexOf(timing as (typeof TIMING_ORDER)[number]);
  if (idx <= 0) return null;
  return TIMING_ORDER[idx - 1];
}

/**
 * Walk TIMING_ORDER backwards from `timing` and return the first earlier
 * entry for which `hasSnapshot` is true. Lets detection chain across
 * presets that don't include every TIMING_ORDER entry — e.g. league play
 * (COMPREHENSIVE) skips `t_minus_15m`, so when `closing` lands the chain
 * falls through to `t_minus_30m`.
 */
export async function findPrecedingAvailableTiming(
  timing: string,
  hasSnapshot: (timing: string) => Promise<boolean>,
): Promise<string | null> {
  const idx = TIMING_ORDER.indexOf(timing as (typeof TIMING_ORDER)[number]);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    if (await hasSnapshot(TIMING_ORDER[i])) return TIMING_ORDER[i];
  }
  return null;
}

export function detectMoves(
  fromTiming: string,
  fromSnapshot: OddsSnapshot,
  toTiming: string,
  toSnapshot: OddsSnapshot,
  matchKey: string,
  leagueId: string,
  kickoffTime: string,
): UpsertSteamMoveInput[] {
  const moves: UpsertSteamMoveInput[] = [];

  const fromBookmakers = new Map(
    fromSnapshot.odds.bookmakers.map((b) => [b.key, b]),
  );

  for (const toBookmaker of toSnapshot.odds.bookmakers) {
    const fromBookmaker = fromBookmakers.get(toBookmaker.key);
    if (!fromBookmaker) continue;

    for (const toMarket of toBookmaker.markets) {
      if (!ALLOWED_MARKETS.includes(toMarket.key)) continue;

      const fromMarket = fromBookmaker.markets.find(
        (m) => m.key === toMarket.key,
      );
      if (!fromMarket) continue;

      for (const toOutcome of toMarket.outcomes) {
        const fromOutcome = fromMarket.outcomes.find(
          (o) =>
            o.name === toOutcome.name &&
            (toOutcome.point === undefined || o.point === toOutcome.point),
        );
        if (!fromOutcome) continue;

        const movement =
          ((toOutcome.price - fromOutcome.price) / fromOutcome.price) * 100;

        if (Math.abs(movement) >= STEAM_THRESHOLD) {
          moves.push({
            matchKey,
            leagueId,
            kickoffTime,
            market: toMarket.key,
            marketLabel: MARKET_LABELS[toMarket.key] ?? toMarket.key,
            outcome: toOutcome.name,
            point: toOutcome.point,
            bookmaker: toBookmaker.title,
            fromTiming,
            toTiming,
            fromOdds: fromOutcome.price,
            toOdds: toOutcome.price,
            movement,
            direction: movement < 0 ? "shortening" : "drifting",
          });
        }
      }
    }
  }

  return moves;
}
