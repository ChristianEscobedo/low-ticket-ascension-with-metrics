/**
 * Research scraper cache. Monid and RapidAPI are pay-per-run, so the agent
 * must never pay twice for the same query inside a TTL window. One table, one
 * rule: key -> payload with an expires_at.
 *
 * The pure half (key building, expiry math) is import-safe everywhere; the
 * store half is service-role only like the rest of the research module.
 */
import { createClient } from '@supabase/supabase-js';

const TABLE = 'mothermode_research_cache';

/** Default freshness window for a scraper result: 7 days. */
export const RESEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Deterministic cache key for a tool call. Args are sorted so `{a:1,b:2}` and
 * `{b:2,a:1}` hit the same row; whitespace inside values is collapsed so
 * "mom  burnout" and "mom burnout" share one paid run.
 */
export function buildCacheKey(
  namespace: string,
  args: Record<string, unknown>,
): string {
  const parts = Object.keys(args)
    .sort()
    .map((k) => {
      const v = args[k];
      const clean =
        typeof v === 'string'
          ? v.trim().toLowerCase().replace(/\s+/g, ' ')
          : JSON.stringify(v) ?? '';
      return `${k}=${clean}`;
    });
  return `${namespace}:${parts.join('&')}`;
}

/** True when a stored expires_at is still in the future. */
export function cacheFresh(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t > Date.now();
}

// Service-role client, lazy (same convention as store.ts).
let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/**
 * Read a fresh cache row, or null on miss / expiry / any failure. The cache is
 * an optimization — a broken cache must never break a tool call, only cost it
 * one extra paid run.
 */
export async function readResearchCache<T = unknown>(
  cacheKey: string,
): Promise<T | null> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select('payload, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    if (!cacheFresh(data.expires_at)) return null;
    return data.payload as T;
  } catch {
    return null;
  }
}

/**
 * Write a cache row (upsert). Best-effort: a failed write loses money on the
 * next identical query but must not fail the tool call that just succeeded.
 */
export async function writeResearchCache(
  cacheKey: string,
  payload: unknown,
  ttlMs: number = RESEARCH_CACHE_TTL_MS,
): Promise<void> {
  try {
    await (serviceClient() as any).from(TABLE).upsert({
      cache_key: cacheKey,
      payload,
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
    });
  } catch {
    /* best-effort */
  }
}
