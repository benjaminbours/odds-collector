/**
 * Standard timing offset presets
 *
 * These define when to collect odds relative to match kickoff
 */

import { TimingOffset } from "./types";

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
 * Closing line - 90 minutes before kickoff
 * Sharpest odds, critical for CLV analysis
 */
export const CLOSING: TimingOffset = {
  name: "closing",
  hoursBeforeKickoff: 1.5, // 90 minutes
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

  /** All timing points (maximum data) */
  COMPREHENSIVE: [OPENING, MID_WEEK, DAY_BEFORE, CLOSING],
};
