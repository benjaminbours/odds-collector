import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { MatchIndex, OddsSnapshot, BookmakerOdds } from '@odds-collector/shared';
import { LEAGUES, CURRENT_SEASON } from '@odds-collector/shared';

interface SteamMove {
  leagueId: string;
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  outcome: 'home' | 'draw' | 'away';
  fromTiming: string;
  toTiming: string;
  bookmaker: string;
  fromOdds: number;
  toOdds: number;
  movement: number; // percentage change
  direction: 'shortening' | 'drifting';
}

const TIMING_ORDER = ['opening', 'mid_week', 'day_before', 'closing'];
const STEAM_THRESHOLD = 5; // 5% movement threshold

function getH2hOdds(bookmaker: BookmakerOdds): { home: number; draw: number; away: number } | null {
  const h2hMarket = bookmaker.markets.find((m) => m.key === 'h2h');
  if (!h2hMarket) return null;

  const home = h2hMarket.outcomes.find((o) => o.name === 'Home' || o.name.includes('Home'))?.price;
  const draw = h2hMarket.outcomes.find((o) => o.name === 'Draw')?.price;
  const away = h2hMarket.outcomes.find((o) => o.name === 'Away' || o.name.includes('Away'))?.price;

  // If we can't find home/draw/away by name, try by position
  if (!home && h2hMarket.outcomes.length === 3) {
    return {
      home: h2hMarket.outcomes[0].price,
      draw: h2hMarket.outcomes[1].price,
      away: h2hMarket.outcomes[2].price,
    };
  }

  if (home && draw && away) {
    return { home, draw, away };
  }

  return null;
}

function calculateMovement(fromOdds: number, toOdds: number): number {
  return ((toOdds - fromOdds) / fromOdds) * 100;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = searchParams.get('season') || CURRENT_SEASON;
  const leagueFilter = searchParams.get('league');

  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.ODDS_BUCKET;

    const steamMoves: SteamMove[] = [];
    const leaguesToCheck = leagueFilter
      ? LEAGUES.filter((l) => l.id === leagueFilter)
      : LEAGUES;

    for (const league of leaguesToCheck) {
      // Fetch match index
      const indexKey = `odds_data_v2/leagues/${league.id}/${season}/by_match.json`;
      const indexObject = await bucket.get(indexKey);

      if (!indexObject) continue;

      const indexData: MatchIndex = await indexObject.json();

      // Process each match
      for (const [matchKey, matchEntry] of Object.entries(indexData.matches)) {
        const availableTimings = TIMING_ORDER.filter(
          (t) => matchEntry.snapshots[t]
        );

        if (availableTimings.length < 2) continue;

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
        for (let i = 0; i < availableTimings.length - 1; i++) {
          const fromTiming = availableTimings[i];
          const toTiming = availableTimings[i + 1];
          const fromSnapshot = snapshots[fromTiming];
          const toSnapshot = snapshots[toTiming];

          if (!fromSnapshot || !toSnapshot) continue;

          // Find common bookmakers
          const fromBookmakers = new Map(
            fromSnapshot.odds.bookmakers.map((b) => [b.key, b])
          );

          for (const toBookmaker of toSnapshot.odds.bookmakers) {
            const fromBookmaker = fromBookmakers.get(toBookmaker.key);
            if (!fromBookmaker) continue;

            const fromOdds = getH2hOdds(fromBookmaker);
            const toOdds = getH2hOdds(toBookmaker);

            if (!fromOdds || !toOdds) continue;

            // Check each outcome
            const outcomes: Array<'home' | 'draw' | 'away'> = ['home', 'draw', 'away'];
            for (const outcome of outcomes) {
              const movement = calculateMovement(fromOdds[outcome], toOdds[outcome]);

              if (Math.abs(movement) >= STEAM_THRESHOLD) {
                steamMoves.push({
                  leagueId: league.id,
                  matchKey,
                  homeTeam: matchEntry.homeTeam,
                  awayTeam: matchEntry.awayTeam,
                  kickoffTime: matchEntry.kickoffTime,
                  outcome,
                  fromTiming,
                  toTiming,
                  bookmaker: toBookmaker.title,
                  fromOdds: fromOdds[outcome],
                  toOdds: toOdds[outcome],
                  movement,
                  direction: movement < 0 ? 'shortening' : 'drifting',
                });
              }
            }
          }
        }
      }
    }

    // Sort by absolute movement magnitude (biggest moves first)
    steamMoves.sort((a, b) => Math.abs(b.movement) - Math.abs(a.movement));

    return NextResponse.json({
      season,
      steamMoves: steamMoves.slice(0, 100), // Return top 100
      total: steamMoves.length,
    });
  } catch (error) {
    console.error('Error detecting steam moves:', error);
    return NextResponse.json(
      { error: 'Failed to detect steam moves' },
      { status: 500 }
    );
  }
}
