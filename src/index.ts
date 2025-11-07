/**
 * Odds Collector - Cloudflare Worker for automated football odds collection
 *
 * Main exports for programmatic use
 */

// Core types
export * from './config/types';
export * from './config/timingPresets';
export { LEAGUES, getLeagueConfig } from './config/leagues';

// Providers
export { TheOddsApiProvider, TheOddsApiConfig } from './providers/TheOddsApiProvider';

// Storage
export { R2Storage, R2StorageConfig } from './storage/R2Storage';

// Core
export { JobScheduler, JobSchedulerConfig } from './core/JobScheduler';
export { OddsCollector, OddsCollectorConfig } from './core/OddsCollector';
export { IndexBuilder, IndexBuilderConfig } from './core/IndexBuilder';

// Utils
export * from './utils/pathUtils';

// Worker (for Cloudflare Workers deployment)
export { default as worker } from './worker/index';
