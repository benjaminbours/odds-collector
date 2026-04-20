# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Odds Collector (OddsLab) is an automated sports odds collection and intelligence system. It discovers upcoming football matches, schedules dense odds snapshots at pre-match timings, stores them in Cloudflare R2 + D1, and exposes a Next.js dashboard for analysis. It also detects value bets (via an external model backend) and tracks their CLV and settlement outcomes.

It is a deployed product targeting Cloudflare (Workers + R2 + D1), not a generic library.

## Repository Layout (npm workspaces monorepo)

```
apps/
  collector/                # Cloudflare Worker — odds ingestion + scheduling + APIs
    src/
      core/                 # OddsCollector, JobScheduler, MatchMetadataRepository,
                            # ValueBetService, ValueBetOrchestrator
      providers/            # TheOddsApiProvider (only provider)
      storage/              # IStorage, R2Storage, LocalStorage
      config/               # timingPresets, leagues, types
      scripts/              # backfill, populateMatchMetadata (ts-node CLIs)
      worker/index.ts       # Cloudflare Worker entry (scheduled + fetch)
    migrations/             # D1 SQL migrations (0001..0006)
    wrangler.toml
  dashboard/                # Next.js 15 app deployed via OpenNext → Cloudflare Workers
    src/
      app/                  # Routes: /, /leagues, /steam-moves, /api/*
      components/           # MatchCard, OddsChart, SteamMovesList, etc.
      lib/matches-db.ts     # D1 reads for the dashboard
    wrangler.jsonc
packages/
  shared/                   # Shared TS types (OddsSnapshot, EventOdds, ValueBet, …)
  team-normalization/       # Canonical team name normalization per league
```

## Development Commands

### Monorepo root
- `npm run build` — build all workspaces
- `npm run dev:collector` / `npm run dev:dashboard`
- `npm run deploy:collector` / `npm run deploy:dashboard`
- `npm run lint` / `npm run format` — runs across workspaces if script present

### Collector (`apps/collector`)
- `npm run dev` — `wrangler dev`
- `npm run deploy` — `wrangler deploy`
- `npm run tail` — stream worker logs
- `npm run backfill` — ts-node backfill script
- `npm run populate-match-metadata` — ts-node metadata backfill

### Dashboard (`apps/dashboard`)

Before the first `npm run dev`, authenticate wrangler manually:

```
cd apps/dashboard && npx wrangler login
```

Why: `next.config.ts` calls `initOpenNextCloudflareForDev({ remoteBindings: true })`, which triggers a wrangler OAuth flow if no cached token exists. With `next dev --turbopack`, the config is evaluated in two processes and both race to bind wrangler's OAuth callback port (8976), causing `EADDRINUSE: ::1:8976` and crashing the dev server. Logging in once caches the token so the callback server is never started.

Deploy: `npm run deploy` (runs `opennextjs-cloudflare build && opennextjs-cloudflare deploy`).

## Architecture

### Three-Layer Design (inside `apps/collector/src/`)

**Core Layer** (`core/`):
- `OddsCollector.ts` — main orchestrator (discovery + execution + metadata persistence)
- `JobScheduler.ts` — D1-backed persistent job queue with status + retries
- `MatchMetadataRepository.ts` — writes matches + snapshots rows into D1 (replaces the retired R2 JSON indexes)
- `ValueBetService.ts` — CRUD + track record aggregates for value bets
- `ValueBetOrchestrator.ts` — calls external model backend at opening snapshot and persists detected value bets

**Provider Layer** (`providers/`):
- `TheOddsApiProvider.ts` — The Odds API integration

**Storage Layer** (`storage/`):
- `IStorage.ts` — abstract snapshot storage interface
- `R2Storage.ts` — production storage (Cloudflare R2)
- `LocalStorage.ts` — filesystem (dev/scripts)

> Old `IndexBuilder` / `S3Storage` and the R2 JSON indexes (`by_match.json`, `by_date.json`, `by_team.json`) have been retired. Match + snapshot metadata now lives in D1, and the dashboard reads D1 directly.

### Core Workflow

1. **Discovery** (daily 06:00 UTC cron, or manual `POST /trigger?discovery=true`)
   - Fetch upcoming events for each configured league via provider's `fetchEvents()`
   - For each event × each configured timing offset, insert a job row in D1 `scheduled_jobs`
   - Discovery API calls are FREE (event listings)

2. **Execution** (every 5 minutes cron)
   - Query D1 for pending jobs within a ±5 min window of `scheduled_time`
   - Fetch LIVE odds via `fetchEventOdds()` using the configured `REGIONS` (currently `"eu,uk"`)
   - Persist snapshot JSON to R2; upsert `matches` + `snapshots` rows in D1
   - At the opening timing (only), optionally call the external model backend to detect value bets
   - Update job status + record `collection_metrics`

3. **Closing / CLV**
   - When a closing snapshot is collected for a match that has open value bets, CLV is computed and patched via `PATCH /api/value-bets/:id/clv`
   - Settlement outcome is patched via `PATCH /api/value-bets/:id/outcome` from the backend after the match

### Storage Layout

**R2** (`soccer-predictor` bucket, base path `odds_data_v2`):
```
{league_id}/{season}/
  snapshots/
    opening/           day_before/     t_minus_30m/
    mid_week/          t_minus_4h/     closing/
    t_minus_90m/
      {date}/
        {home}_vs_{away}_{eventId}.json
```
(Raw snapshot JSON only — no more index files.)

**D1** (`odds-collector-db`): see migrations below.

### D1 Schema (migrations `0001`–`0006`)

- `scheduled_jobs` — job queue (pending/running/completed/failed, attempts, error, snapshot_path)
- `collection_metrics` — daily aggregates per league
- `matches` — canonical match metadata keyed by `match_key` (`{home}_{away}_{matchDate}`)
- `snapshots` — `(match_key, timing) → r2_path, collected_at` (replaces R2 indexes)
- `value_bets` — individual detections: model/odds/CLV/outcome/posting state
- `value_bet_stats` — pre-aggregated track-record stats by scope

Migration `0004` renamed the legacy `closing` timing (formerly 90 min pre-kickoff) to `t_minus_90m` so that `closing` now means the T-10m final snapshot. `0005` fixed stragglers. `0006` heals stuck `running` jobs.

## Timing Presets (`apps/collector/src/config/timingPresets.ts`)

Seven offsets are defined:

| Name          | Before kickoff | Priority   |
|---------------|---------------:|------------|
| `opening`     | 168 h (7 d)    | important  |
| `mid_week`    | 72 h (3 d)     | important  |
| `day_before`  | 24 h           | important  |
| `t_minus_4h`  | 4 h            | important  |
| `t_minus_90m` | 1.5 h          | critical   |
| `t_minus_30m` | 0.5 h          | critical   |
| `closing`     | 10 min         | critical   |

Presets:
- `MINIMAL`: `[closing]`
- `BASIC`: `[opening, closing]`
- `STANDARD`: `[opening, mid_week, closing]`
- `COMPREHENSIVE`: all seven (production default, dense closing curve for CLV / steam-move analysis)

All offsets currently request markets: `h2h, alternate_totals, alternate_spreads, btts, double_chance`.

## Regions / Bookmakers

`REGIONS` env var is passed to the-odds-api event-odds endpoint. Current production value: `"eu,uk"`.

- `eu` — includes Pinnacle (sharp reference)
- `uk` — adds Betfair Exchange + major UK books

Each extra region multiplies credit cost by `markets × regions` per event fetch.

## Cron Schedule (`apps/collector/wrangler.toml`)

```
0 6 * * *                               # Daily discovery at 06:00 UTC
5,10,...,55 6 * * *                     # Execution every 5 min during hour 6 (skip :00 to not overlap discovery)
*/5 0-5,7-23 * * *                      # Execution every 5 min all other hours
```

The 5-minute cadence is required for T-10m closing precision.

## Worker HTTP Endpoints (`apps/collector/src/worker/index.ts`)

- `GET /` or `/dashboard` — HTML or JSON status dashboard (Accept-header switch)
- `GET /health` — basic health check
- `POST /trigger` (Bearer auth with `ODDS_API_KEY`) — manual run; `?discovery=true` forces a discovery pass
- `GET /status` — 302 → `/dashboard`
- `GET /download/{league}/{season}/{snapshotId}` — fetch a stored snapshot
- Value-bet API:
  - `GET /api/track-record?model_id=…`
  - `GET /api/value-bets?status=&league_id=&model_id=&limit=&offset=`
  - `GET /api/value-bets/:id`
  - `POST /api/value-bets` — internal, `X-Internal-Key`
  - `PATCH /api/value-bets/:id/clv` — internal
  - `PATCH /api/value-bets/:id/outcome` — internal
  - `PATCH /api/value-bets/:id/posted` — internal

CORS allowlist: `localhost:8080`, `127.0.0.1:8080`, `app.oddslab.gg`, `oddslab.gg`.

## Leagues (`apps/collector/src/config/leagues.ts`)

Currently active:
- `england_premier_league` → `soccer_epl`
- `italy_serie_a` → `soccer_italy_serie_a`

Team-name normalization is handled by `@odds-collector/team-normalization` per league.

## Key Design Principles

### Cost Optimization
The fundamental cost lever is scheduling LIVE API fetches at key timings instead of using the expensive historical endpoint:
- Historical API: `10 × markets × regions` tokens per event
- Live API: `markets × regions` tokens per event
- Discovery API: FREE

With the 7-snapshot `COMPREHENSIVE` preset × 2 regions (`eu,uk`), cost per match is `7 × markets × 2`, but each match yields 7 price points across the pre-match curve and cross-book coverage for CLV/steam-move analysis.

### Plugin Architecture
Providers and storage backends are interface-based so additional providers / storages can be added without touching core orchestration.

### Single Responsibility
- `OddsCollector` — orchestration only
- `JobScheduler` — job persistence + status
- `MatchMetadataRepository` — match/snapshot metadata in D1
- `ValueBetOrchestrator` / `ValueBetService` — value bet detection + persistence
- Provider — external API integration only
- Storage — snapshot bytes only

## Important Implementation Notes

### Custom Providers
1. Return data in the `OddsEvent` / `EventOdds` shapes from `@odds-collector/shared`
2. Implement `estimateCost()` for metrics
3. Handle rate limiting internally (don't leak to collector)
4. Throw descriptive errors so the scheduler's retry logic can act

### Custom Storage
1. All paths are relative
2. Prefer atomic writes (temp → rename where possible)
3. Handle concurrent writes gracefully
4. Return `null` (not throw) when a file is missing

### JobScheduler
- Execution window: ±5 min around `scheduled_time`
- Default max attempts: 3 before permanent failure
- `cleanup()` removes old completed jobs (default 90 days)
- `getFailedJobs()` for custom retry logic
- Stuck `running` jobs are healed by a dedicated path (see migration `0006`)

### Match / Snapshot Metadata
- `MatchMetadataRepository` upserts `matches` and `snapshots` rows on every completed job — no more post-run R2 index rebuild
- `match_key` format: `{homeTeam}_{awayTeam}_{matchDate}` — team names must be normalized before this is constructed (the library doesn't normalize on your behalf)

### Dashboard Reads
- `apps/dashboard/src/lib/matches-db.ts` reads D1 directly via remote bindings (OpenNext + wrangler)
- Do not reintroduce R2-index reads — they are retired

## Configuration Details

### Request Delays
- Default: 1100ms between API requests (the-odds-api allows ~1 req/sec)
- Override via `requestDelay` on `OddsCollectorConfig`

### Job Execution Limits
- Default `maxJobsPerRun = 100`
- Keeps each cron invocation under the Workers CPU budget

### Value Bet Detection
- Opt-in via `ENABLE_VALUE_BET_DETECTION=true` + `BACKEND_URL` + `BACKEND_API_KEY`
- Fires only at the `opening` timing; opening odds + model probability → EV/Kelly
- CLV is patched in when the `closing` snapshot for that match is collected

## TypeScript Configuration
- Target: ES2020
- Strict mode enabled
- Collector: CommonJS output for Workers runtime
- Shared packages emit `.d.ts` for cross-workspace consumers

## What This Project Does NOT Include
- Prediction models / betting strategies (lives in an external backend; reached via `BACKEND_URL`)
- League configuration data beyond what's in `leagues.ts`
- Historical backfills (beyond the ts-node scripts)
- Authentication/authorization beyond the shared `ODDS_API_KEY` + `X-Internal-Key`
- Multi-provider aggregation (one provider per collector instance)

## Deployment

Cloudflare-only. Both the collector Worker and the dashboard (Next.js via OpenNext) run on Workers; storage is R2 + D1. The older "standalone Node service / Docker" examples from earlier versions have been removed — don't reintroduce them.

## Error Handling Philosophy

"Fail soft":
- Provider errors → skip job, mark failed, continue others
- Storage errors → fail that job, continue run
- Metadata/value-bet errors → log, don't block collection

Per-job attempts + errors live in D1. Monitor with `collection_metrics` and `JobScheduler.getMetrics()`.
