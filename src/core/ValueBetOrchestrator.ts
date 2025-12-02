/**
 * Value Bet Orchestrator
 *
 * Coordinates value bet detection with the Rust backend and stores results in D1.
 *
 * Called by OddsCollector after fetching opening odds to detect and track value bets.
 */

import { ValueBetService, CreateValueBetParams } from './ValueBetService';
import type {
  EventOdds,
  DetectValueBetsRequest,
  DetectValueBetsResponse,
  CreateValueBetRequest,
} from '../config/types';

export interface ValueBetOrchestratorConfig {
  /** Rust backend URL (e.g., https://oddslab-backend.fly.dev) */
  backendUrl: string;
  /** Internal API key for backend authentication */
  backendApiKey: string;
  /** D1 database for storing value bets */
  db: D1Database;
  /** Default model ID to use for tracking */
  modelId?: string;
}

export class ValueBetOrchestrator {
  private backendUrl: string;
  private backendApiKey: string;
  private valueBetService: ValueBetService;
  private modelId: string;

  constructor(config: ValueBetOrchestratorConfig) {
    this.backendUrl = config.backendUrl.replace(/\/$/, ''); // Remove trailing slash
    this.backendApiKey = config.backendApiKey;
    this.valueBetService = new ValueBetService({ db: config.db });
    this.modelId = config.modelId ?? 'oddslab_default';
  }

  /**
   * Detect and store value bets for a match at opening timing
   *
   * @param params Match details and odds snapshot
   * @returns Number of value bets detected and stored
   */
  async detectAndStoreValueBets(params: {
    eventId: string;
    homeTeam: string;
    awayTeam: string;
    matchDate: string;
    kickoffTime: string;
    leagueId: string;
    season: string;
    oddsSnapshot: EventOdds;
  }): Promise<number> {
    console.log(
      `🔍 Detecting value bets for ${params.homeTeam} vs ${params.awayTeam}...`
    );

    try {
      // 1. Call backend to detect value bets
      const response = await this.callBackendDetection(params);

      if (response.valueBets.length === 0) {
        console.log('   📊 No value bets detected');
        return 0;
      }

      console.log(`   📊 Found ${response.valueBets.length} value bets`);

      // 2. Store each value bet in D1
      let storedCount = 0;
      for (const valueBet of response.valueBets) {
        try {
          await this.storeValueBet(params, valueBet);
          storedCount++;
          console.log(
            `   ✅ Stored: ${valueBet.outcome} - EV: ${(valueBet.openingEv * 100).toFixed(1)}% @ ${valueBet.bookmakerName}`
          );
        } catch (error) {
          console.error(`   ❌ Failed to store value bet: ${error}`);
        }
      }

      return storedCount;
    } catch (error) {
      console.error(`   ❌ Value bet detection failed: ${error}`);
      throw error;
    }
  }

  /**
   * Update CLV for value bets when closing odds are collected
   *
   * @param eventId Event ID to update CLV for
   * @param closingOdds Closing odds snapshot
   * @returns Number of value bets updated
   */
  async updateClv(
    eventId: string,
    closingOdds: EventOdds
  ): Promise<number> {
    console.log(`📊 Updating CLV for event ${eventId}...`);

    try {
      // Get existing value bets for this event
      const existingBets = await this.valueBetService.getValueBetsByEventId(eventId);

      if (existingBets.length === 0) {
        console.log('   ℹ️ No value bets found for this event');
        return 0;
      }

      let updatedCount = 0;
      for (const bet of existingBets) {
        // Skip if already updated
        if (bet.closingOdds !== undefined) {
          continue;
        }

        // Find closing odds for this outcome
        const closingOddsValue = this.findOddsForOutcome(
          closingOdds,
          bet.outcome,
          bet.homeTeam,
          bet.awayTeam
        );

        if (closingOddsValue === null) {
          console.log(`   ⚠️ Could not find closing odds for ${bet.outcome}`);
          continue;
        }

        // Calculate CLV
        const closingImpliedProb = 1 / closingOddsValue;
        const clv = bet.openingImpliedProb - closingImpliedProb;

        await this.valueBetService.updateClv(bet.id, {
          closingOdds: closingOddsValue,
          closingImpliedProb,
          clv,
        });

        updatedCount++;
        console.log(
          `   ✅ Updated CLV for ${bet.outcome}: ${(clv * 100).toFixed(2)}%`
        );
      }

      return updatedCount;
    } catch (error) {
      console.error(`   ❌ CLV update failed: ${error}`);
      throw error;
    }
  }

  /**
   * Call the backend detection endpoint
   */
  private async callBackendDetection(params: {
    eventId: string;
    homeTeam: string;
    awayTeam: string;
    matchDate: string;
    kickoffTime: string;
    leagueId: string;
    season: string;
    oddsSnapshot: EventOdds;
  }): Promise<DetectValueBetsResponse> {
    const request: DetectValueBetsRequest = {
      eventId: params.eventId,
      homeTeam: params.homeTeam,
      awayTeam: params.awayTeam,
      matchDate: params.matchDate,
      kickoffTime: params.kickoffTime,
      leagueId: params.leagueId,
      season: params.season,
      oddsSnapshot: params.oddsSnapshot,
    };

    const response = await fetch(
      `${this.backendUrl}/api/internal/detect-value-bets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': this.backendApiKey,
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Backend detection failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Store a value bet in D1
   */
  private async storeValueBet(
    matchParams: {
      eventId: string;
      homeTeam: string;
      awayTeam: string;
      matchDate: string;
      kickoffTime: string;
      leagueId: string;
      season: string;
    },
    valueBet: CreateValueBetRequest
  ): Promise<void> {
    const createParams: CreateValueBetParams = {
      modelId: this.modelId,
      eventId: matchParams.eventId,
      leagueId: matchParams.leagueId,
      season: matchParams.season,
      homeTeam: matchParams.homeTeam,
      awayTeam: matchParams.awayTeam,
      matchDate: matchParams.matchDate,
      kickoffTime: matchParams.kickoffTime,
      valueBet,
    };

    await this.valueBetService.createValueBet(createParams);
  }

  /**
   * Find odds for a specific outcome in the odds snapshot
   */
  private findOddsForOutcome(
    oddsSnapshot: EventOdds,
    outcome: string,
    homeTeam: string,
    awayTeam: string
  ): number | null {
    // Determine which team/draw to look for
    let targetName: string;
    if (outcome === 'home') {
      targetName = homeTeam;
    } else if (outcome === 'away') {
      targetName = awayTeam;
    } else {
      targetName = 'Draw';
    }

    // Find best odds across all bookmakers
    let bestOdds: number | null = null;

    for (const bookmaker of oddsSnapshot.bookmakers) {
      const h2hMarket = bookmaker.markets.find((m) => m.key === 'h2h');
      if (!h2hMarket) continue;

      const marketOutcome = h2hMarket.outcomes.find((o) => {
        if (outcome === 'draw') {
          return o.name.toLowerCase() === 'draw';
        }
        return this.normalizeTeamName(o.name) === this.normalizeTeamName(targetName);
      });

      if (marketOutcome && (bestOdds === null || marketOutcome.price > bestOdds)) {
        bestOdds = marketOutcome.price;
      }
    }

    return bestOdds;
  }

  /**
   * Normalize team name for comparison
   */
  private normalizeTeamName(name: string): string {
    return name
      .toLowerCase()
      .replace(/ fc$/i, '')
      .replace(/ f\.c\.$/i, '')
      .replace(/\./g, '')
      .replace(/'/g, '')
      .trim();
  }
}
