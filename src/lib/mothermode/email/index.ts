/**
 * Public, browser-safe surface of the Email Marketing Kit. Re-exports the types,
 * the campaign + framework catalogs, and the pure export/render helpers.
 *
 * Does NOT re-export store.ts — that pulls in the service-role Supabase client
 * and must be imported directly by server code (API routes / server-only
 * generators). Same rule as the other kits.
 */
export * from './types';
export * from './triggers';
export * from './frameworks';

export * from './campaigns';
export * from './export';
export * from './tokens';
export * from './flow';
export * from './preview';
export * from './analytics';
export * from './enrollment';
export * from './flowOverlay';