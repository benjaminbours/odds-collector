import type { OddsSnapshot, SteamMove } from "@odds-collector/shared";
import type { IStorage } from "../storage/IStorage";
import { SteamMovesRepository } from "./SteamMovesRepository";
import { MatchMetadataRepository } from "./MatchMetadataRepository";
import { detectMoves, findPrecedingAvailableTiming } from "./steamMoveDetector";
import type { XPostOrchestrator } from "./XPostOrchestrator";

export class SteamMoveOrchestrator {
  constructor(
    private storage: IStorage,
    private steamRepo: SteamMovesRepository,
    private matchRepo: MatchMetadataRepository,
    /** Optional — when provided, qualifying moves are also tweeted. */
    private xPostOrchestrator: XPostOrchestrator | null = null,
  ) {}

  async detectAndStore(params: {
    matchKey: string;
    leagueId: string;
    homeTeam: string;
    awayTeam: string;
    kickoffTime: string;
    currentTiming: string;
    currentSnapshot: OddsSnapshot;
  }): Promise<void> {
    const {
      matchKey,
      leagueId,
      homeTeam,
      awayTeam,
      kickoffTime,
      currentTiming,
      currentSnapshot,
    } = params;

    try {
      const prevTiming = await findPrecedingAvailableTiming(
        currentTiming,
        async (t) => (await this.matchRepo.getSnapshotPath(matchKey, t)) !== null,
      );
      if (!prevTiming) return; // first stored snapshot for this match

      const prevPath = await this.matchRepo.getSnapshotPath(matchKey, prevTiming);
      if (!prevPath) return;

      const prevSnapshot = await this.storage.readByPath(prevPath);
      if (!prevSnapshot) return;

      const moves = detectMoves(
        prevTiming,
        prevSnapshot,
        currentTiming,
        currentSnapshot,
        matchKey,
        leagueId,
        kickoffTime,
      );

      for (const move of moves) {
        await this.steamRepo.upsertMove(move);

        if (this.xPostOrchestrator) {
          // Enrich with team names (the D1 row + UpsertSteamMoveInput drop them
          // since they're joined from `matches` on read; the formatter needs
          // them for the tweet body).
          const fullMove: SteamMove = { ...move, homeTeam, awayTeam };
          await this.xPostOrchestrator.maybePostMove(fullMove);
        }
      }

      if (moves.length > 0) {
        console.log(
          `     🔥 ${moves.length} steam move(s) detected (${prevTiming} → ${currentTiming})`,
        );
      }
    } catch (error) {
      console.error(
        `     ⚠️ Steam move detection error:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
