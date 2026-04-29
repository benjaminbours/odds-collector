/**
 * Canonical timing-offset order, earliest to latest.
 *
 * Single source of truth for both the collector (steam-move detection
 * chains snapshots by walking this order) and the dashboard (chart x-axis,
 * timing badges, snapshot tables). Includes tournament-only entries
 * (t_minus_35d → t_minus_14d, t_minus_60m, t_minus_15m); presets that
 * don't collect at those timings simply produce no snapshot for them.
 */
export const TIMING_ORDER = [
  "t_minus_35d",
  "t_minus_28d",
  "t_minus_21d",
  "t_minus_14d",
  "opening",
  "mid_week",
  "day_before",
  "t_minus_4h",
  "t_minus_90m",
  "t_minus_60m",
  "t_minus_30m",
  "t_minus_15m",
  "closing",
] as const;

export type TimingName = (typeof TIMING_ORDER)[number];
