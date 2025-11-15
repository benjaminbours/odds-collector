import { OddsSnapshot, MatchIndex } from '../config/types';

/**
 * Storage interface for odds snapshots and indexes
 * Implemented by R2Storage and LocalStorage
 */
export interface IStorage {
  /**
   * Save odds snapshot
   */
  saveSnapshot(
    leagueId: string,
    season: string,
    snapshot: OddsSnapshot
  ): Promise<void>;

  /**
   * Get odds snapshot
   */
  getSnapshot(
    leagueId: string,
    season: string,
    snapshotId: string
  ): Promise<OddsSnapshot | null>;

  /**
   * List all snapshots for a league/season
   */
  listSnapshots(leagueId: string, season: string): Promise<string[]>;

  /**
   * Save index file
   */
  saveIndex(
    leagueId: string,
    season: string,
    indexType: string,
    index: MatchIndex
  ): Promise<void>;

  /**
   * Get index file
   */
  getIndex(
    leagueId: string,
    season: string,
    indexType: string
  ): Promise<MatchIndex | null>;

  /**
   * Delete a snapshot
   */
  deleteSnapshot(
    leagueId: string,
    season: string,
    snapshotId: string
  ): Promise<void>;
}
