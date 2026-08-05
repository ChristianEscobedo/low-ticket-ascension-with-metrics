/**
 * Endpoint learning (roadmap 4.3): per-endpoint outcome stats + the
 * winner-first ordering for the discovered pool.
 *
 * Recording is best-effort (swallowed, like telemetry — a dead stats table
 * never breaks a scrape). Reads degrade to []. The ordering is PURE so it
 * is unit-testable without the DB.
 */
import { createClient } from '@supabase/supabase-js';

const TABLE = 'mothermode_monid_endpoint_stats';
const COLUMNS = 'endpoint, runs, failures, last_ok_at, last_fail_at, updated_at';

export interface EndpointStat {
  endpoint: string;
  runs: number;
  failures: number;
  lastOkAt: string | null;
  lastFailAt: string | null;
}

export interface EndpointStatRow {
  endpoint: string;
  runs: number | null;
  failures: number | null;
  last_ok_at: string | null;
  last_fail_at: string | null;
}

/** Defensive row -> stat. */
export function rowToEndpointStat(row: EndpointStatRow): EndpointStat {
  return {
    endpoint: row.endpoint,
    runs:
      typeof row.runs === 'number' && Number.isFinite(row.runs)
        ? Math.max(0, Math.floor(row.runs))
        : 0,
    failures:
      typeof row.failures === 'number' && Number.isFinite(row.failures)
        ? Math.max(0, Math.floor(row.failures))
        : 0,
    lastOkAt: row.last_ok_at,
    lastFailAt: row.last_fail_at,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Winner-first ordering (pure). Score: successes minus failures, with a
 * failure in the last 3 days costing double (a recently-broken endpoint
 * goes last even if its lifetime record is fine). Unknown endpoints score
 * 0 and keep their discovered order relative to each other.
 */
export function rankEndpoints<T extends { id: string }>(
  candidates: T[],
  stats: EndpointStat[],
  now = Date.now(),
): T[] {
  const byEndpoint = new Map(stats.map((s) => [s.endpoint, s]));
  const scored = candidates.map((c, index) => {
    const s = byEndpoint.get(c.id);
    if (!s) return { c, index, score: 0 };
    const successes = Math.max(0, s.runs - s.failures);
    let score = successes - s.failures;
    if (s.lastFailAt) {
      const age = now - new Date(s.lastFailAt).getTime();
      if (Number.isFinite(age) && age < 3 * DAY_MS) score -= 2 * s.failures;
    }
    return { c, index, score };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((s) => s.c);
}

let _service: ReturnType<typeof createClient> | null = null;
function serviceClient() {
  if (_service) return _service;
  _service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  return _service;
}

/** Admin read: all stats. [] on failure (ordering then = discovered order). */
export async function listEndpointStats(): Promise<EndpointStat[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS);
    if (error || !data) return [];
    return (data as EndpointStatRow[]).map(rowToEndpointStat);
  } catch {
    return [];
  }
}

/**
 * Record one run's outcome. Best-effort: failures are SWALLOWED (a dead
 * stats table must never break a scrape, exactly like call telemetry).
 */
export async function recordEndpointOutcome(
  endpoint: string,
  outcome: 'ok' | 'fail',
): Promise<void> {
  const clean = (endpoint || '').trim();
  if (!clean) return;
  try {
    const { data: existing } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .eq('endpoint', clean)
      .maybeSingle();
    const now = new Date().toISOString();
    const prev = existing ? rowToEndpointStat(existing as EndpointStatRow) : null;
    await (serviceClient() as any).from(TABLE).upsert({
      endpoint: clean,
      runs: (prev?.runs ?? 0) + 1,
      failures: (prev?.failures ?? 0) + (outcome === 'fail' ? 1 : 0),
      last_ok_at: outcome === 'ok' ? now : (prev?.lastOkAt ?? null),
      last_fail_at: outcome === 'fail' ? now : (prev?.lastFailAt ?? null),
      updated_at: now,
    });
  } catch {
    /* stats never break a scrape */
  }
}
