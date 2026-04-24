import { OddsSnapshot, MatchIndex } from '@odds-collector/shared';

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
  ): Promise<string>;

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

  /**
   * Read a snapshot by its full storage path (as stored in D1 snapshots.r2_path).
   */
  readByPath(storagePath: string): Promise<OddsSnapshot | null>;
}
