import * as fs from 'fs';
import * as path from 'path';
import { OddsSnapshot, MatchIndex } from '../config/types';
import { IStorage } from './IStorage';

export interface LocalStorageConfig {
  /**
   * Base directory for storing odds data
   */
  basePath: string;
}

/**
 * Local filesystem storage implementation
 *
 * Features:
 * - Simple file-based storage for development and testing
 * - Hierarchical directory structure
 * - JSON file format
 * - Atomic writes (write to temp, then rename)
 *
 * @example
 * ```typescript
 * const storage = new LocalStorage({
 *   basePath: '/Users/benjaminbours/perso/footdata/shared/odds_data'
 * });
 *
 * await storage.saveSnapshot('EPL', '2024-2025', snapshot);
 * const snapshot = await storage.getSnapshot('EPL', '2024-2025', 'match_12345');
 * ```
 */
export class LocalStorage implements IStorage {
  private basePath: string;

  constructor(private config: LocalStorageConfig) {
    this.basePath = config.basePath;
    this.ensureDirectoryExists(this.basePath);
  }

  /**
   * Generate file path from components
   */
  private getPath(...parts: string[]): string {
    return path.join(this.basePath, ...parts);
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Generate snapshot ID from snapshot data (matches R2Storage)
   */
  private getSnapshotId(snapshot: OddsSnapshot): string {
    const eventId = snapshot.odds.id;
    const timing = snapshot.metadata.snapshotTiming;
    const date = snapshot.metadata.date;
    return `${eventId}_${timing}_${date}`;
  }

  /**
   * Save odds snapshot to filesystem (flat structure matching R2)
   */
  async saveSnapshot(
    leagueId: string,
    season: string,
    snapshot: OddsSnapshot
  ): Promise<void> {
    const snapshotId = this.getSnapshotId(snapshot);

    // Path: {league}/{season}/{snapshotId}.json (flat, matches R2)
    const dirPath = this.getPath(leagueId, season);
    this.ensureDirectoryExists(dirPath);

    const filePath = path.join(dirPath, `${snapshotId}.json`);
    const tempPath = filePath + '.tmp';

    // Write to temp file first for atomic write
    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), 'utf8');

    // Rename to final path (atomic on most filesystems)
    fs.renameSync(tempPath, filePath);
  }

  /**
   * Get odds snapshot from filesystem
   */
  async getSnapshot(
    leagueId: string,
    season: string,
    snapshotId: string
  ): Promise<OddsSnapshot | null> {
    const filePath = this.getPath(leagueId, season, `${snapshotId}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as OddsSnapshot;
  }

  /**
   * List all snapshots for a league/season
   */
  async listSnapshots(leagueId: string, season: string): Promise<string[]> {
    const seasonPath = this.getPath(leagueId, season);

    if (!fs.existsSync(seasonPath)) {
      return [];
    }

    // Get all JSON files directly in season directory
    const files = fs.readdirSync(seasonPath)
      .filter((f: string) => f.endsWith('.json'))
      .map((f: string) => f.replace('.json', ''));

    return files;
  }

  /**
   * Save index file
   */
  async saveIndex(
    leagueId: string,
    season: string,
    indexType: string,
    index: MatchIndex
  ): Promise<void> {
    const dirPath = this.getPath(leagueId, season, 'index');
    this.ensureDirectoryExists(dirPath);

    const filePath = path.join(dirPath, `${indexType}.json`);
    const tempPath = filePath + '.tmp';

    // Write to temp file first
    fs.writeFileSync(tempPath, JSON.stringify(index, null, 2), 'utf8');

    // Rename to final path
    fs.renameSync(tempPath, filePath);
  }

  /**
   * Get index file
   */
  async getIndex(
    leagueId: string,
    season: string,
    indexType: string
  ): Promise<MatchIndex | null> {
    const filePath = this.getPath(leagueId, season, 'index', `${indexType}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as MatchIndex;
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(
    leagueId: string,
    season: string,
    snapshotId: string
  ): Promise<void> {
    const filePath = this.getPath(leagueId, season, `${snapshotId}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
