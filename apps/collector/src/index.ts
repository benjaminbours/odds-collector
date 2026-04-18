/**
 * Odds Collector - Cloudflare Worker for automated football odds collection
 *
 * Main exports for programmatic use
 */

// Core types - re-export shared types and collector-specific types
export * from '@odds-collector/shared';
export { CollectorLeagueConfig, ScheduledJob, CollectionMetrics, CreateValueBetRequest, DetectValueBetsRequest, DetectValueBetsResponse } from './config/types';
export * from './config/timingPresets';
export { LEAGUES, getLeagueConfig } from './config/leagues';

// Providers
export { TheOddsApiProvider, TheOddsApiConfig } from './providers/TheOddsApiProvider';

// Storage
// Note: LocalStorage is Node.js only and not exported here (Cloudflare Workers don't support fs/path)
// Import directly from './storage/LocalStorage' if needed in Node.js scripts
export { R2Storage, R2StorageConfig } from './storage/R2Storage';

// Core
export { JobScheduler, JobSchedulerConfig } from './core/JobScheduler';
export { OddsCollector, OddsCollectorConfig } from './core/OddsCollector';
export { MatchMetadataRepository } from './core/MatchMetadataRepository';

// Utils
export * from './utils/pathUtils';

// Worker (for Cloudflare Workers deployment)
export { default as worker } from './worker/index';
