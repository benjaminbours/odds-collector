import { Breadcrumb } from "@/components/Breadcrumb";
import { SteamMovesClient } from "@/components/SteamMovesClient";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { MatchIndex, OddsSnapshot, BookmakerMarket } from "@odds-collector/shared";
import { LEAGUES, CURRENT_SEASON } from "@odds-collector/shared";
import "@/styles/steam-moves-page.css";

// Revalidate every 30 minutes
export const revalidate = 1800;

export interface SteamMove {
  leagueId: string;
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  market: string;
  marketLabel: string;
  outcome: string;
  point?: number;
  fromTiming: string;
  toTiming: string;
  bookmaker: string;
  fromOdds: number;
  toOdds: number;
  movement: number;
  direction: "shortening" | "drifting";
}

export interface SteamMovesData {
  season: string;
  steamMoves: SteamMove[];
  generatedAt: string;
  availableMarkets: string[];
  hasMorePast: boolean;
}

const TIMING_ORDER = ["opening", "mid_week", "day_before", "closing"];
const STEAM_THRESHOLD = 5;

// Markets to include (normalized keys)
const ALLOWED_MARKETS = ["h2h", "spreads", "alternate_spreads", "totals", "alternate_totals", "btts", "double_chance"];

const MARKET_LABELS: Record<string, string> = {
  h2h: "Money Line",
  spreads: "Spread",
  alternate_spreads: "Spread",
  totals: "Totals",
  alternate_totals: "Totals",
  btts: "Both Teams to Score",
  double_chance: "Double Chance",
};

function getMarketLabel(marketKey: string): string {
  return MARKET_LABELS[marketKey] || marketKey;
}

function isAllowedMarket(marketKey: string): boolean {
  return ALLOWED_MARKETS.includes(marketKey);
}

function calculateMovement(fromOdds: number, toOdds: number): number {
  return ((toOdds - fromOdds) / fromOdds) * 100;
}

interface OutcomeData {
  name: string;
  price: number;
  point?: number;
}

function getOutcomesFromMarket(market: BookmakerMarket): OutcomeData[] {
  return market.outcomes.map((o) => ({
    name: o.name,
    price: o.price,
    point: o.point,
  }));
}

function findMatchingOutcome(
  outcomes: OutcomeData[],
  targetName: string,
  targetPoint?: number
): OutcomeData | undefined {
  return outcomes.find((o) => {
    const nameMatch = o.name === targetName;
    if (targetPoint !== undefined) {
      return nameMatch && o.point === targetPoint;
    }
    return nameMatch;
  });
}

// Only fetch matches within a date range for performance
async function getSteamMoves(): Promise<SteamMovesData> {
  const season = CURRENT_SEASON;
  const now = new Date();

  // Calculate date boundaries: upcoming (next 14 days) + recent past (last 7 days)
  const pastCutoff = new Date(now);
  pastCutoff.setDate(pastCutoff.getDate() - 7);
  const futureCutoff = new Date(now);
  futureCutoff.setDate(futureCutoff.getDate() + 14);

  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.ODDS_BUCKET;

    const steamMoves: SteamMove[] = [];
    const marketsFound = new Set<string>();
    let hasOlderMatches = false;

    for (const league of LEAGUES) {
      const indexKey = `odds_data_v2/leagues/${league.id}/${season}/by_match.json`;
      const indexObject = await bucket.get(indexKey);

      if (!indexObject) continue;

      const indexData: MatchIndex = await indexObject.json();

      // Filter matches by date range
      const matchEntries = Object.entries(indexData.matches).filter(([, matchEntry]) => {
        const kickoff = new Date(matchEntry.kickoffTime);
        if (kickoff < pastCutoff) {
          hasOlderMatches = true;
          return false;
        }
        return kickoff <= futureCutoff;
      });

      // Process matches in parallel batches for better performance
      const batchSize = 10;
      for (let i = 0; i < matchEntries.length; i += batchSize) {
        const batch = matchEntries.slice(i, i + batchSize);

        await Promise.all(batch.map(async ([matchKey, matchEntry]) => {
          const availableTimings = TIMING_ORDER.filter(
            (t) => matchEntry.snapshots[t]
          );

          if (availableTimings.length < 2) return;

          // Fetch all snapshots for this match
          const snapshotPromises = availableTimings.map(async (timing) => {
            const path = matchEntry.snapshots[timing];
            const obj = await bucket.get(path);
            if (!obj) return { timing, snapshot: null };
            const snapshot: OddsSnapshot = await obj.json();
            return { timing, snapshot };
          });

          const snapshotResults = await Promise.all(snapshotPromises);
          const snapshots: Record<string, OddsSnapshot> = {};
          for (const { timing, snapshot } of snapshotResults) {
            if (snapshot) snapshots[timing] = snapshot;
          }

          // Compare consecutive timings
          for (let j = 0; j < availableTimings.length - 1; j++) {
            const fromTiming = availableTimings[j];
            const toTiming = availableTimings[j + 1];
            const fromSnapshot = snapshots[fromTiming];
            const toSnapshot = snapshots[toTiming];

            if (!fromSnapshot || !toSnapshot) continue;

            const fromBookmakers = new Map(
              fromSnapshot.odds.bookmakers.map((b) => [b.key, b])
            );

            for (const toBookmaker of toSnapshot.odds.bookmakers) {
              const fromBookmaker = fromBookmakers.get(toBookmaker.key);
              if (!fromBookmaker) continue;

              for (const toMarket of toBookmaker.markets) {
                if (!isAllowedMarket(toMarket.key)) continue;

                const fromMarket = fromBookmaker.markets.find(
                  (m) => m.key === toMarket.key
                );
                if (!fromMarket) continue;

                const normalizedLabel = getMarketLabel(toMarket.key);
                marketsFound.add(normalizedLabel);

                const fromOutcomes = getOutcomesFromMarket(fromMarket);
                const toOutcomes = getOutcomesFromMarket(toMarket);

                for (const toOutcome of toOutcomes) {
                  const fromOutcome = findMatchingOutcome(
                    fromOutcomes,
                    toOutcome.name,
                    toOutcome.point
                  );

                  if (!fromOutcome) continue;

                  const movement = calculateMovement(
                    fromOutcome.price,
                    toOutcome.price
                  );

                  if (Math.abs(movement) >= STEAM_THRESHOLD) {
                    steamMoves.push({
                      leagueId: league.id,
                      matchKey,
                      homeTeam: matchEntry.homeTeam,
                      awayTeam: matchEntry.awayTeam,
                      kickoffTime: matchEntry.kickoffTime,
                      market: toMarket.key,
                      marketLabel: normalizedLabel,
                      outcome: toOutcome.name,
                      point: toOutcome.point,
                      fromTiming,
                      toTiming,
                      bookmaker: toBookmaker.title,
                      fromOdds: fromOutcome.price,
                      toOdds: toOutcome.price,
                      movement,
                      direction: movement < 0 ? "shortening" : "drifting",
                    });
                  }
                }
              }
            }
          }
        }));
      }
    }

    // Sort by kickoff time (chronologically)
    steamMoves.sort((a, b) =>
      new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime()
    );

    return {
      season,
      steamMoves,
      generatedAt: new Date().toISOString(),
      availableMarkets: Array.from(marketsFound).sort(),
      hasMorePast: hasOlderMatches,
    };
  } catch (error) {
    console.error("Error fetching steam moves:", error);
    return {
      season,
      steamMoves: [],
      generatedAt: new Date().toISOString(),
      availableMarkets: [],
      hasMorePast: false,
    };
  }
}

export default async function SteamMovesPage() {
  const data = await getSteamMoves();

  return (
    <main className="container">
      <div className="steam-moves-page">
        <Breadcrumb items={[{ label: "Steam Moves" }]} />

        <header className="steam-moves-page__header">
          <h1 className="steam-moves-page__title">Steam Moves</h1>
          <p className="steam-moves-page__subtitle">
            Significant odds movements (&gt;5%) detected across bookmakers
          </p>
        </header>

        <SteamMovesClient
          initialData={data}
          availableMarkets={data.availableMarkets}
        />
      </div>
    </main>
  );
}
