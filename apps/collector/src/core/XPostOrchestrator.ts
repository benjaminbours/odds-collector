/**
 * Filters detected steam moves and posts the qualifying ones to X.
 *
 * v1 policy (intentionally conservative — tune from observation):
 *   - Sharp books only: bookmaker title contains "Pinnacle" or "Betfair".
 *   - h2h market only.
 *   - direction === "shortening".
 *   - |movement| ≥ 15% (well above the 5% detection threshold).
 *
 * Dedup against `x_posts` ensures the same move is never posted twice. If a
 * post failed previously, we retry on later runs up to MAX_ATTEMPTS.
 *
 * A per-run hard cap prevents runaway posting if a future config change
 * floods the pipeline.
 */

import type { SteamMove } from "@odds-collector/shared";
import { XClient } from "./XClient";
import { XPostsRepository } from "./XPostsRepository";
import { formatSteamMoveTweet } from "./formatSteamMoveTweet";

export interface XPostOrchestratorConfig {
  xClient: XClient;
  xPostsRepo: XPostsRepository;
  /** league_id → hashtag (sans `#`). Returning undefined skips that league. */
  leagueHashtag: (leagueId: string) => string | undefined;
  /** Override defaults in tests. */
  movementThreshold?: number;
  maxAttempts?: number;
  maxPostsPerRun?: number;
}

const SHARP_BOOKMAKER_KEYWORDS = ["pinnacle", "betfair"];

export class XPostOrchestrator {
  private postedThisRun = 0;
  private readonly movementThreshold: number;
  private readonly maxAttempts: number;
  private readonly maxPostsPerRun: number;

  constructor(private config: XPostOrchestratorConfig) {
    this.movementThreshold = config.movementThreshold ?? 15;
    this.maxAttempts = config.maxAttempts ?? 3;
    this.maxPostsPerRun = config.maxPostsPerRun ?? 10;
  }

  async maybePostMove(move: SteamMove): Promise<void> {
    if (!this.passesFilter(move)) return;

    if (this.postedThisRun >= this.maxPostsPerRun) {
      console.warn(
        `     ⚠️ X post cap (${this.maxPostsPerRun}/run) reached — skipping ${move.matchKey}/${move.bookmaker}/${move.outcome}`,
      );
      return;
    }

    const existing = await this.config.xPostsRepo.getStatus(move);
    if (existing?.status === "posted") return;
    if (existing?.status === "failed" && existing.attempts >= this.maxAttempts) {
      return;
    }

    const leagueHashtag = this.config.leagueHashtag(move.leagueId);
    if (!leagueHashtag) return;

    const text = formatSteamMoveTweet({ move, leagueHashtag });

    try {
      const result = await this.config.xClient.postTweet(text);
      await this.config.xPostsRepo.recordPosted(move, result.id);
      this.postedThisRun++;
      console.log(
        `     🐦 X posted: ${move.bookmaker} ${move.outcome} ${move.fromOdds}→${move.toOdds} (tweet ${result.id})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.config.xPostsRepo.recordFailed(move, msg);
      console.error(`     ⚠️ X post failed (${move.matchKey}): ${msg}`);
    }
  }

  private passesFilter(move: SteamMove): boolean {
    if (move.market !== "h2h") return false;
    if (move.direction !== "shortening") return false;
    if (Math.abs(move.movement) < this.movementThreshold) return false;

    const bookLower = move.bookmaker.toLowerCase();
    if (!SHARP_BOOKMAKER_KEYWORDS.some((b) => bookLower.includes(b))) {
      return false;
    }

    return true;
  }
}
