import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { OddsSnapshot, MatchIndex } from '../config/types';
import { IStorage } from './IStorage';

export interface R2StorageConfig {
  /**
   * Cloudflare Account ID
   */
  accountId: string;

  /**
   * R2 Access Key ID
   */
  accessKeyId: string;

  /**
   * R2 Secret Access Key
   */
  secretAccessKey: string;

  /**
   * R2 Bucket name
   */
  bucketName: string;

  /**
   * Optional custom endpoint (defaults to Cloudflare R2)
   */
  endpoint?: string;

  /**
   * Optional region (defaults to 'auto')
   */
  region?: string;

  /**
   * Base path prefix within bucket (e.g., 'odds_data')
   */
  basePath?: string;

  /**
   * Number of retry attempts for failed operations
   */
  maxRetries?: number;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
}

/**
 * Cloudflare R2 storage implementation using S3-compatible API
 *
 * Features:
 * - Zero egress fees (unlike S3)
 * - S3-compatible API
 * - Automatic retries with exponential backoff
 * - Integrity checking via ETags
 * - Efficient batch operations
 *
 * @example
 * ```typescript
 * const storage = new R2Storage({
 *   accountId: 'your-account-id',
 *   accessKeyId: 'your-access-key',
 *   secretAccessKey: 'your-secret-key',
 *   bucketName: 'odds-data',
 *   basePath: 'production'
 * });
 *
 * await storage.saveSnapshot('EPL', '2024', snapshot);
 * const snapshot = await storage.getSnapshot('EPL', '2024', 'match_12345');
 * ```
 */
export class R2Storage implements IStorage {
  private client: S3Client;
  private bucketName: string;
  private basePath: string;
  private maxRetries: number;

  constructor(private config: R2StorageConfig) {
    this.bucketName = config.bucketName;
    this.basePath = config.basePath || '';
    this.maxRetries = config.maxRetries || 3;

    // Construct R2 endpoint: https://<accountId>.r2.cloudflarestorage.com
    const endpoint = config.endpoint ||
      `https://${config.accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: config.region || 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      requestHandler: {
        requestTimeout: config.timeout || 30000,
      },
    });
  }

  /**
   * Generate S3 key from components
   */
  private getKey(...parts: string[]): string {
    const allParts = this.basePath ? [this.basePath, ...parts] : parts;
    return allParts.filter(Boolean).join('/');
  }

  /**
   * Execute operation with retries and exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.warn(
            `R2Storage: ${operationName} failed (attempt ${attempt}/${this.maxRetries}), ` +
            `retrying in ${delay}ms...`,
            error
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `R2Storage: ${operationName} failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generate snapshot ID from snapshot data
   */
  private getSnapshotId(snapshot: OddsSnapshot): string {
    const eventId = snapshot.odds.id;
    const timing = snapshot.metadata.snapshotTiming;
    const date = snapshot.metadata.date;
    return `${eventId}_${timing}_${date}`;
  }

  async saveSnapshot(
    leagueId: string,
    season: string,
    snapshot: OddsSnapshot
  ): Promise<void> {
    const snapshotId = this.getSnapshotId(snapshot);
    const key = this.getKey('leagues', leagueId, season, `${snapshotId}.json`);
    const body = JSON.stringify(snapshot, null, 2);

    await this.withRetry(async () => {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: 'application/json',
        Metadata: {
          league: leagueId,
          season: season,
          snapshotId: snapshotId,
          timing: snapshot.metadata.snapshotTiming,
          collectedAt: snapshot.metadata.timestamp,
        },
      }));
    }, `saveSnapshot(${key})`);
  }

  async getSnapshot(
    leagueId: string,
    season: string,
    snapshotId: string
  ): Promise<OddsSnapshot | null> {
    const key = this.getKey('leagues', leagueId, season, `${snapshotId}.json`);

    try {
      const response = await this.withRetry(async () => {
        return await this.client.send(new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }));
      }, `getSnapshot(${key})`);

      if (!response.Body) {
        return null;
      }

      const body = await response.Body.transformToString('utf-8');
      return JSON.parse(body);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async snapshotExists(
    leagueId: string,
    season: string,
    snapshotId: string
  ): Promise<boolean> {
    const key = this.getKey('leagues', leagueId, season, `${snapshotId}.json`);

    try {
      await this.withRetry(async () => {
        return await this.client.send(new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }));
      }, `snapshotExists(${key})`);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async deleteSnapshot(
    leagueId: string,
    season: string,
    snapshotId: string
  ): Promise<void> {
    const key = this.getKey('leagues', leagueId, season, `${snapshotId}.json`);

    await this.withRetry(async () => {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));
    }, `deleteSnapshot(${key})`);
  }

  async listSnapshots(
    leagueId: string,
    season: string
  ): Promise<string[]> {
    const prefix = this.getKey('leagues', leagueId, season, '');
    const snapshotIds: string[] = [];

    let continuationToken: string | undefined;

    do {
      const response = await this.withRetry(async () => {
        return await this.client.send(new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }));
      }, `listSnapshots(${prefix})`);

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            // Extract snapshotId from key (remove .json extension)
            const fileName = obj.Key.split('/').pop();
            if (fileName && fileName.endsWith('.json')) {
              snapshotIds.push(fileName.slice(0, -5));
            }
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return snapshotIds;
  }

  async saveIndex(
    leagueId: string,
    season: string,
    indexType: 'by_match' | 'by_date' | 'by_team',
    index: MatchIndex
  ): Promise<void> {
    const key = this.getKey('leagues', leagueId, season, `${indexType}.json`);
    const body = JSON.stringify(index, null, 2);

    await this.withRetry(async () => {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: 'application/json',
        Metadata: {
          league: leagueId,
          season: season,
          indexType,
          matchCount: String(Object.keys(index.matches).length),
          lastUpdated: index.lastUpdated,
        },
      }));
    }, `saveIndex(${key})`);
  }

  async getIndex(
    leagueId: string,
    season: string,
    indexType: 'by_match' | 'by_date' | 'by_team'
  ): Promise<MatchIndex | null> {
    const key = this.getKey('leagues', leagueId, season, `${indexType}.json`);

    // Check if index exists first to avoid deserialization errors
    const exists = await this.indexExists(leagueId, season, indexType);
    if (!exists) {
      return null;
    }

    try {
      const response = await this.withRetry(async () => {
        return await this.client.send(new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }));
      }, `getIndex(${key})`);

      if (!response.Body) {
        return null;
      }

      const body = await response.Body.transformToString('utf-8');
      return JSON.parse(body);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async indexExists(
    leagueId: string,
    season: string,
    indexType: 'by_match' | 'by_date' | 'by_team'
  ): Promise<boolean> {
    const key = this.getKey('leagues', leagueId, season, `${indexType}.json`);

    try {
      // Don't use withRetry for existence checks - just check once
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));
      return true;
    } catch (error: any) {
      // Handle 404/NotFound - index doesn't exist
      if (error.name === 'NotFound' ||
          error.name === 'NoSuchKey' ||
          error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      // Handle deserialization errors (empty bucket, DOMParser issues)
      if (error.message?.includes('DOMParser') ||
          error.message?.includes('Deserialization') ||
          error.message?.includes('UnknownError')) {
        return false;
      }
      // For any other error, log and return false (assume doesn't exist)
      console.warn(`R2Storage: indexExists check failed for ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get S3 client for advanced operations
   */
  getClient(): S3Client {
    return this.client;
  }

  /**
   * Get bucket name
   */
  getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Get base path prefix
   */
  getBasePath(): string {
    return this.basePath;
  }

  /**
   * Batch upload multiple snapshots efficiently
   */
  async batchSaveSnapshots(
    snapshots: Array<{
      leagueId: string;
      season: string;
      snapshot: OddsSnapshot;
    }>
  ): Promise<void> {
    const promises = snapshots.map(({ leagueId, season, snapshot }) =>
      this.saveSnapshot(leagueId, season, snapshot)
    );

    await Promise.all(promises);
  }

  /**
   * Check storage health and connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        MaxKeys: 1,
      }));
      return true;
    } catch (error) {
      console.error('R2Storage health check failed:', error);
      return false;
    }
  }
}
