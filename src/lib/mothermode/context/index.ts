/**
 * Public, browser-safe surface of the context bridge. Re-exports the types, the
 * pure adapters, and the prompt-join helpers. Does NOT re-export resolve.ts —
 * that pulls in the service-role kit stores and must be imported directly by
 * server code (API routes / server-only generators).
 */
export * from './types';
export * from './prompt';
export * from './fromOffer';
export * from './fromKits';
export * from './fromInline';


