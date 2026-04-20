/**
 * Standard timing offset presets
 *
 * These define when to collect odds relative to match kickoff
 */

import { TimingOffset } from "@odds-collector/shared";

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
};
