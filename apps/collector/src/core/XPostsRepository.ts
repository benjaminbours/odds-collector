/**
 * D1-backed log of X (Twitter) posts attempted for steam moves.
 *
 * Composite PK mirrors `steam_moves`, so a successful post and the move
 * that triggered it are 1:1 and dedup is a single lookup.
 *
 * Only moves we *attempted* to post are recorded — filtered-out moves
 * (wrong bookmaker, below threshold, posting disabled) leave no row.
 */

import type { SteamMove } from "@odds-collector/shared";
import { toPointKey } from "./SteamMovesRepository";

export type XPostStatus = "posted" | "failed";

export interface XPostRecord {
  status: XPostStatus;
  attempts: number;
  tweetId: string | null;
  postedAt: string | null;
  error: string | null;
}

type MoveKey = Pick<
  SteamMove,
  "matchKey" | "market" | "outcome" | "point" | "bookmaker" | "fromTiming" | "toTiming"
>;

export class XPostsRepository {
  constructor(private db: D1Database) {}

  async getStatus(move: MoveKey): Promise<XPostRecord | null> {
    const row = await this.db
      .prepare(
        `SELECT status, attempts, tweet_id, posted_at, error
           FROM x_posts
          WHERE match_key = ? AND market = ? AND outcome = ?
            AND point_key = ? AND bookmaker = ?
            AND from_timing = ? AND to_timing = ?`,
      )
      .bind(
        move.matchKey,
        move.market,
        move.outcome,
        toPointKey(move.point),
        move.bookmaker,
        move.fromTiming,
        move.toTiming,
      )
      .first<{
        status: XPostStatus;
        attempts: number;
        tweet_id: string | null;
        posted_at: string | null;
        error: string | null;
      }>();

    if (!row) return null;
    return {
      status: row.status,
      attempts: row.attempts,
      tweetId: row.tweet_id,
      postedAt: row.posted_at,
      error: row.error,
    };
  }

  async recordPosted(move: MoveKey, tweetId: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO x_posts (
           match_key, market, outcome, point_key, bookmaker, from_timing, to_timing,
           status, tweet_id, posted_at, attempts
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'posted', ?, CURRENT_TIMESTAMP, 1)
         ON CONFLICT(match_key, market, outcome, point_key, bookmaker, from_timing, to_timing)
         DO UPDATE SET
           status     = 'posted',
           tweet_id   = excluded.tweet_id,
           posted_at  = CURRENT_TIMESTAMP,
           error      = NULL,
           attempts   = attempts + 1,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        move.matchKey,
        move.market,
        move.outcome,
        toPointKey(move.point),
        move.bookmaker,
        move.fromTiming,
        move.toTiming,
        tweetId,
      )
      .run();
  }

  async recordFailed(move: MoveKey, error: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO x_posts (
           match_key, market, outcome, point_key, bookmaker, from_timing, to_timing,
           status, error, attempts
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?, 1)
         ON CONFLICT(match_key, market, outcome, point_key, bookmaker, from_timing, to_timing)
         DO UPDATE SET
           status     = 'failed',
           error      = excluded.error,
           attempts   = attempts + 1,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        move.matchKey,
        move.market,
        move.outcome,
        toPointKey(move.point),
        move.bookmaker,
        move.fromTiming,
        move.toTiming,
        error.slice(0, 500),
      )
      .run();
  }
}
