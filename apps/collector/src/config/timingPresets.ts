/**
 * Standard timing offset presets
 *
 * These define when to collect odds relative to match kickoff
 */

import { TimingOffset } from "@odds-collector/shared";

/**
 * Ultra-early pre-opening snapshots (tournaments only).
 *
 * Captures weekly drift in the news-driven pre-opening window — squad
 * announcements, qualifying playoffs, friendlies, injury reports. Liquidity
 * is thin so single news items move odds materially; the existing 15%
 * X-posting threshold + sharp-books filter is the right gate against drift
 * noise.
 */
export const T_MINUS_35D: TimingOffset = {
  name: "t_minus_35d",
  hoursBeforeKickoff: 35 * 24,
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "normal",
  directory: "snapshots/t_minus_35d",
};

export const T_MINUS_28D: TimingOffset = {
  name: "t_minus_28d",
  hoursBeforeKickoff: 28 * 24,
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "normal",
  directory: "snapshots/t_minus_28d",
};

export const T_MINUS_21D: TimingOffset = {
  name: "t_minus_21d",
  hoursBeforeKickoff: 21 * 24,
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "normal",
  directory: "snapshots/t_minus_21d",
};

export const T_MINUS_14D: TimingOffset = {
  name: "t_minus_14d",
  hoursBeforeKickoff: 14 * 24,
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "normal",
  directory: "snapshots/t_minus_14d",
};

/**
 * Opening odds - 7 days before kickoff
 * Early market positioning, less sharp
 */
export const OPENING: TimingOffset = {
  name: "opening",
  hoursBeforeKickoff: 168, // 7 days
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "important",
  directory: "snapshots/opening",
};

/**
 * Mid-week odds - 3 days before kickoff
 * More informed markets, moderate sharpness
 */
export const MID_WEEK: TimingOffset = {
  name: "mid_week",
  hoursBeforeKickoff: 72, // 3 days
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "important",
  directory: "snapshots/mid_week",
};

/**
 * Day-before odds - 24 hours before kickoff
 * Sharp markets, close to team news
 */
export const DAY_BEFORE: TimingOffset = {
  name: "day_before",
  hoursBeforeKickoff: 24, // 1 day
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "important",
  directory: "snapshots/day_before",
};

/**
 * T-4h before kickoff
 * Closing window opens — team news starts landing
 */
export const T_MINUS_4H: TimingOffset = {
  name: "t_minus_4h",
  hoursBeforeKickoff: 4,
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "important",
  directory: "snapshots/t_minus_4h",
};

/**
 * T-90m before kickoff
 * Traditional pre-closing snapshot. Previously named "closing" in this
 * codebase — renamed so CLOSING semantically means the final snapshot.
 */
export const T_MINUS_90M: TimingOffset = {
  name: "t_minus_90m",
  hoursBeforeKickoff: 1.5,
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "critical",
  directory: "snapshots/t_minus_90m",
};

/**
 * T-60m before kickoff
 * High-attention events (e.g. World Cup) only — densifies the closing curve.
 */
export const T_MINUS_60M: TimingOffset = {
  name: "t_minus_60m",
  hoursBeforeKickoff: 1,
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "critical",
  directory: "snapshots/t_minus_60m",
};

/**
 * T-30m before kickoff
 * Late steam-move window
 */
export const T_MINUS_30M: TimingOffset = {
  name: "t_minus_30m",
  hoursBeforeKickoff: 0.5,
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "critical",
  directory: "snapshots/t_minus_30m",
};

/**
 * T-15m before kickoff
 * High-attention events only — last steam wave before the closing snapshot.
 */
export const T_MINUS_15M: TimingOffset = {
  name: "t_minus_15m",
  hoursBeforeKickoff: 0.25,
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "critical",
  directory: "snapshots/t_minus_15m",
};

/**
 * Closing line - 10 minutes before kickoff
 * Final snapshot; CLV analysis anchors here.
 */
export const CLOSING: TimingOffset = {
  name: "closing",
  hoursBeforeKickoff: 1 / 6, // 10 minutes
  markets: "h2h,alternate_totals,alternate_spreads,btts,double_chance",
  priority: "critical",
  directory: "snapshots/closing",
};

/**
 * Preset collections
 */
export const TimingPresets = {
  /** Only closing line (minimum for CLV analysis) */
  MINIMAL: [CLOSING],

  /** Opening + Closing (track movement) */
  BASIC: [OPENING, CLOSING],

  /** Opening, Mid-week, Closing (good balance) */
  STANDARD: [OPENING, MID_WEEK, CLOSING],

  /** Full 7-stage curve with dense closing window (intelligence hub default) */
  COMPREHENSIVE: [
    OPENING,
    MID_WEEK,
    DAY_BEFORE,
    T_MINUS_4H,
    T_MINUS_90M,
    T_MINUS_30M,
    CLOSING,
  ],

  /**
   * 13-stage curve for marquee tournaments (World Cup):
   *   - 4 weekly ultra-early snapshots (T-35d → T-14d) to capture the
   *     news-driven pre-opening window (qualifying playoffs, friendlies,
   *     squad announcements). Discovery silently skips offsets in the past,
   *     so matches whose kickoff is closer than a given offset start the
   *     curve later.
   *   - The standard 7-stage closing curve from OPENING (T-7d) to CLOSING
   *     (T-10m), densified with T-60m and T-15m for the team-news + final
   *     liquidity waves.
   */
  WORLD_CUP: [
    T_MINUS_35D,
    T_MINUS_28D,
    T_MINUS_21D,
    T_MINUS_14D,
    OPENING,
    MID_WEEK,
    DAY_BEFORE,
    T_MINUS_4H,
    T_MINUS_90M,
    T_MINUS_60M,
    T_MINUS_30M,
    T_MINUS_15M,
    CLOSING,
  ],
};

export type TimingPresetName = keyof typeof TimingPresets;
