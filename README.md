# Odds Collector

> Automated sports odds collection service deployed on Cloudflare Workers

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Cloudflare Worker service that automatically collects sports betting odds using The Odds API. Features event-based scheduling with Cloudflare D1 (SQLite) and R2 storage for cost-efficient data collection.

## Local Development Setup

### Prerequisites

- Node.js 20+
- npm
- Cloudflare account with Wrangler CLI configured

### Installation

```bash
# Install dependencies
npm install

# Create .dev.vars file with required secrets
cp .dev.vars.example .dev.vars
```

### Configuration

Edit `.dev.vars` with your credentials:

```bash
ODDS_API_KEY=your_odds_api_key
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
```

### Database Setup

```bash
# Create D1 database (first time only)
npx wrangler d1 create odds-collector-db

# Update wrangler.toml with the database_id from above command

# Apply migrations
npx wrangler d1 migrations apply odds-collector-db --local
```

### Development Commands

```bash
# Run development server
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Deployment

```bash
# Apply database migrations to production
npx wrangler d1 migrations apply odds-collector-db

# Deploy to Cloudflare Workers
npm run deploy

# View logs
npm run tail
```

## Configuration

Edit `wrangler.toml` to configure:

- **Leagues**: Set `LEAGUES` variable (e.g., `["england_premier_league","italy_serie_a"]`)
- **Timing Preset**: Set `TIMING_PRESET` (options: `MINIMAL`, `BASIC`, `STANDARD`, `COMPREHENSIVE`)
- **Cron Schedule**: Adjust `triggers.crons` for collection frequency

## Architecture

- **Worker**: Cloudflare Worker with cron triggers
- **Database**: Cloudflare D1 (SQLite) for job scheduling
- **Storage**: Cloudflare R2 for odds snapshots
- **Provider**: The Odds API integration

## License

MIT © Benjamin Bours
