# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Odds Collector is an automated sports odds collection toolkit that provides event-based scheduling with significant cost savings (72-90%) compared to historical API fetching. It's an infrastructure library, not a complete betting system - it handles discovery, scheduling, collection, and storage of sports odds data.

## Development Commands

### Building & Testing
- `npm run build` - Compile TypeScript to dist/
- `npm run dev` - Watch mode compilation
- `npm test` - Run Jest tests
- `npm run lint` - Run ESLint on TypeScript files
- `npm run format` - Format code with Prettier

### Working with Examples
Each example directory has its own package.json:
- **basic-usage**: `npm start` (uses ts-node)
- **standalone-service**: `npm start` or `npm run dev` (with nodemon)
- **cloudflare-worker**: `npm run dev`, `npm run deploy`
- **docker**: `npm run docker:build`, `npm run docker:run`, `npm run compose:up`

## Architecture

### Three-Layer Design

**Core Layer** (`src/core/`):
- `OddsCollector.ts` - Main orchestrator coordinating discovery, scheduling, and execution
- `JobScheduler.ts` - SQLite-based persistent job queue with status tracking and retries
- `IndexBuilder.ts` - Generates O(1) lookup indexes (by_match, by_date, by_team)

**Provider Layer** (`src/providers/`):
- `IProvider.ts` - Abstract odds data source interface
- `TheOddsApiProvider.ts` - The Odds API integration (reference implementation)
- Custom providers implement IOddsProvider to integrate other APIs

**Storage Layer** (`src/storage/`):
- `IStorage.ts` - Abstract storage backend interface
- `LocalStorage.ts` - Filesystem implementation
- `R2Storage.ts` - Cloudflare R2 implementation
- `S3Storage.ts` - AWS S3 implementation

### Core Workflow

1. **Event Discovery** (OddsCollector.run())
   - Fetch upcoming events 7-14 days ahead using provider's fetchEvents()
   - For each event + timing offset, schedule a job in SQLite
   - Discovery API calls are FREE (event listings)

2. **Job Execution** (OddsCollector.run())
   - Query SQLite for jobs due now (±5 min window)
   - Fetch LIVE odds using provider's fetchEventOdds() (90% cheaper than historical)
   - Create snapshot with metadata and odds
   - Save to storage using configured backend
   - Update job status and record metrics

3. **Index Building** (IndexBuilder.updateMatchIndex())
   - Collect snapshot metadata from completed jobs
   - Update primary match index (by_match.json)
   - Build derived indexes (by_date.json, by_team.json)

### File Structure Pattern

```
storage_root/
└── {league_id}/{season}/
    ├── index/
    │   ├── by_match.json   # Primary: matchKey → snapshot paths
    │   ├── by_date.json    # Derived: date → match keys
    │   └── by_team.json    # Derived: team → match keys
    └── snapshots/
        ├── opening/        # 7 days before kickoff
        ├── mid_week/       # 3 days before
        ├── day_before/     # 24 hours before
        └── closing/        # 90 minutes before
            └── {date}/
                └── {home}_vs_{away}_{eventId}.json
```

### Database Schema (SQLite)

**scheduled_jobs**:
- Primary keys: id (autoincrement)
- Indexes: (scheduled_time, status), (event_id, timing_offset), (league_id, match_date)
- Status values: pending, running, completed, failed
- Tracks: attempts, last_attempt, error messages, snapshot paths

**collection_metrics**:
- Daily aggregated metrics per league
- Tracks: jobs_scheduled, jobs_completed, jobs_failed, api_requests, api_cost_tokens

## Key Design Principles

### Cost Optimization Strategy
The fundamental cost savings comes from scheduling LIVE API fetches ahead of time rather than using expensive historical APIs after the fact:
- Historical API: 10 × markets × regions tokens per event
- Live API: markets × regions tokens per event
- Discovery API: FREE (event listings)

By discovering events 7-14 days ahead and scheduling collection jobs at optimal times (opening, mid-week, day-before, closing), the system achieves 72-90% cost reduction while capturing 4× more data points per match.

### Plugin Architecture
Both providers and storage backends use interface-based abstraction. This allows:
- Easy integration with multiple odds APIs (not tied to The Odds API)
- Flexible storage backends (filesystem, R2, S3, or custom databases)
- Testing with mock implementations

### Separation of Concerns
- **OddsCollector**: Workflow orchestration only
- **JobScheduler**: Job persistence and status management only
- **IndexBuilder**: Index generation only
- **Provider**: External API integration only
- **Storage**: Data persistence only

Each component has a single responsibility and can be tested/replaced independently.

## Important Implementation Notes

### When Implementing Custom Providers
1. Return data in the standard OddsEvent/EventOdds format defined in IProvider.ts
2. Implement cost estimation in estimateCost() for metrics tracking
3. Handle rate limiting within the provider (don't expose to collector)
4. Throw descriptive errors for the scheduler's retry mechanism

### When Implementing Custom Storage
1. All paths are relative (no absolute paths in interface)
2. Implement atomic writes where possible (write to temp, then rename)
3. Handle concurrent access gracefully (multiple jobs may write simultaneously)
4. Return null (not throw) when files don't exist in loadSnapshot/loadIndex

### Working with the Job Scheduler
- Jobs have a ±5 minute execution window around scheduled_time
- Default max attempts is 3 before marking as permanently failed
- Call cleanup() periodically to remove old completed jobs (default 90 days)
- Use getFailedJobs() to implement custom retry logic
- The scheduler uses SQLite transactions for job status updates

### Index Building
- Call updateMatchIndex() after job execution to keep indexes current
- Indexes are built incrementally (don't rebuild from scratch each time)
- Match keys follow format: {homeTeam}_{awayTeam}_{matchDate}
- Team names should be normalized before creating match keys (not done by library)

## Configuration Details

### Timing Presets (src/config/timingPresets.ts)
Pre-configured strategies for when to collect odds:
- OPENING_ONLY: Just opening lines (7 days before)
- CLOSING_ONLY: Just closing lines (90 min before)
- COMPREHENSIVE: Four snapshots (opening, mid-week, day-before, closing)
- Custom: Define your own TimingOffset[] array

### Request Delays
- Default: 1100ms between API requests
- Prevents rate limiting (The Odds API allows ~1 req/sec)
- Configure via requestDelay in OddsCollectorConfig

### Job Execution Limits
- Default: maxJobsPerRun = 100
- Limits jobs executed per run() call
- Prevents timeout in serverless environments (Cloudflare Workers 30s limit)

## TypeScript Configuration

- Target: ES2020
- Module: CommonJS (for Node.js compatibility)
- Strict mode enabled
- Declaration files generated in dist/
- Source maps enabled for debugging

## What This Library Does NOT Include

This is infrastructure only. It does not include:
- Prediction models or betting strategies
- Team name normalization (you must normalize before scheduling)
- League configuration data (seasons, team lists, etc.)
- Historical data backfills
- UI components or dashboards
- Authentication/authorization
- Multi-provider aggregation (one provider per collector instance)

These are intentionally left to the consuming application's domain logic.

## Deployment Considerations

### Cloudflare Workers
- Use R2Storage backend
- Set maxJobsPerRun based on CPU time limits (default 100 works for 30s limit)
- Configure cron triggers for run() (e.g., every 5-10 minutes)
- SQLite job database stored in R2 (load at start, save on completion)

### Standalone Node.js
- Use LocalStorage or S3Storage backend
- Run as systemd service or with PM2
- Set up cron job or setInterval for run()
- SQLite database persists on filesystem

### Docker
- Mount volume for SQLite database and local storage
- Use environment variables for API keys and configuration
- Consider using S3Storage for better container portability

## Error Handling Philosophy

The library uses a "fail soft" approach:
- Provider errors → skip job, mark as failed, continue with others
- Storage errors → fail specific job, continue execution
- Index build errors → log error, don't block collection

Jobs track attempts and errors in the database. Implement application-level monitoring by querying collection_metrics and checking for high failure rates using JobScheduler.getMetrics().
