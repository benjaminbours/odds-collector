import type { OddsSnapshot } from "@odds-collector/shared";
import type { IStorage } from "../storage/IStorage";
import { SteamMovesRepository } from "./SteamMovesRepository";
import { MatchMetadataRepository } from "./MatchMetadataRepository";
import { detectMoves, getPrecedingTiming } from "./steamMoveDetector";

export class SteamMoveOrchestrator {
  constructor(
    private storage: IStorage,
    private steamRepo: SteamMovesRepository,
    private matchRepo: MatchMetadataRepository,
  ) {}

  async detectAndStore(params: {
    matchKey: string;
    leagueId: string;
    kickoffTime: string;
    currentTiming: string;
    currentSnapshot: OddsSnapshot;
  }): Promise<void> {
    const { matchKey, leagueId, kickoffTime, currentTiming, currentSnapshot } =
      params;

    try {
      const prevTiming = getPrecedingTiming(currentTiming);
      if (!prevTiming) return; // opening has no prior

      const prevPath = await this.matchRepo.getSnapshotPath(matchKey, prevTiming);
      if (!prevPath) return; // prior timing was skipped or failed

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
