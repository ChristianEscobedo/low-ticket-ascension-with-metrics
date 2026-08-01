/**
 * Watchlists (roadmap 4.2): the rows + the due-read the weekly digest
 * uses. Admin-only: service-role client, lazy like the other research
 * stores. Reads DEGRADE ([] / null); writes throw.
 */
import { createClient } from '@supabase/supabase-js';
// The trigger metrics read the planner's rollups (service-role, like this
// store). The evaluator itself stays pure for the tests.
import {
  getClickRollupsSafe,
  getPieceAttributionSafe,
  sumPieceAttribution,
} from '@/lib/mothermode/planner/links';

const TABLE = 'mothermode_research_watchlists';
const COLUMNS =
  'id, session_id, recipe_slug, cadence, last_run_at, status, created_at, metric_trigger, last_triggered_at';

export interface ResearchWatchlist {
  id: string;
  sessionId: string;
  recipeSlug: string;
  cadence: 'weekly';
  lastRunAt: string | null;
  status: 'active' | 'paused';
  /** The metric threshold that also runs this play (NULL = plain weekly). */
  trigger: WatchTrigger | null;
  lastTriggeredAt: string | null;
  createdAt: string | null;
}

export interface WatchlistRow {
  id: string;
  session_id: string;
  recipe_slug: string | null;
  cadence: string | null;
  last_run_at: string | null;
  status: string | null;
  created_at: string | null;
  /** Optional at the DB boundary: a checkout running ahead of the triggers
   *  migration selects without them and degrades to "no trigger". */
  metric_trigger?: unknown;
  last_triggered_at?: string | null;
}

/** Defensive row -> watchlist. */
export function rowToWatchlist(row: WatchlistRow): ResearchWatchlist {
  return {
    id: row.id,
    sessionId: row.session_id,
    recipeSlug: (row.recipe_slug || '').trim() || 'niche-watch',
    cadence: 'weekly',
    lastRunAt: row.last_run_at,
    status: row.status === 'paused' ? 'paused' : 'active',
    trigger: normalizeWatchTrigger(row.metric_trigger),
    lastTriggeredAt: row.last_triggered_at ?? null,
    createdAt: row.created_at,
  };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Is this watchlist due? Never run, or last run older than its cadence. */
export function isWatchlistDue(
  w: Pick<ResearchWatchlist, 'lastRunAt' | 'status'>,
  now = Date.now(),
): boolean {
  if (w.status !== 'active') return false;
  if (!w.lastRunAt) return true;
  const t = new Date(w.lastRunAt).getTime();
  return Number.isFinite(t) && now - t >= WEEK_MS;
}

// ---------------------------------------------------------------------------
// Metric triggers (Phase 2): "when 30-day clicks drop below 100, run the
// sweep" — off the SAME rollups the dashboards read, never a second source
// ---------------------------------------------------------------------------

/**
 * The trigger vocabulary. ONLY metrics the existing rollups produce —
 * there is no impressions table, so there is no CTR trigger, and adding
 * one here would silently never fire. `recentClicks` is the 30-day
 * windowed count (the traffic-died signal); the rest are all-time
 * attributed totals, which only rise — pair them with `gte` for a
 * milestone or `lt` for a "still hasn't happened" nudge.
 */
export const TRIGGER_METRICS = [
  'recentClicks',
  'totalClicks',
  'optins',
  'purchases',
  'revenueCents',
] as const;
export type TriggerMetric = (typeof TRIGGER_METRICS)[number];

export interface WatchTrigger {
  metric: TriggerMetric;
  /** lt = "drops below" (a floor), gte = "reaches" (a milestone). */
  op: 'lt' | 'gte';
  /** Counts for count metrics, CENTS for revenueCents. */
  value: number;
  /** Min hours between fires. Absent = TRIGGER_DEFAULT_COOLDOWN_HOURS. */
  cooldownHours?: number;
}

/** A fired run costs money; 24h between fires of the same trigger. */
export const TRIGGER_DEFAULT_COOLDOWN_HOURS = 24;
/** Cooldown cap: a month. Longer wants a calendar, not a cooldown. */
const TRIGGER_MAX_COOLDOWN_HOURS = 24 * 30;

/** Coerce the metric_trigger JSONB (or a POST body), or null when invalid. */
export function normalizeWatchTrigger(value: unknown): WatchTrigger | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const metric = rec.metric;
  if (
    typeof metric !== 'string' ||
    !(TRIGGER_METRICS as readonly string[]).includes(metric)
  ) {
    return null;
  }
  const op = rec.op;
  if (op !== 'lt' && op !== 'gte') return null;
  const v =
    typeof rec.value === 'number' && Number.isFinite(rec.value)
      ? rec.value
      : NaN;
  if (!Number.isFinite(v)) return null;
  const cooldown =
    typeof rec.cooldownHours === 'number' &&
    Number.isFinite(rec.cooldownHours) &&
    rec.cooldownHours > 0
      ? Math.min(rec.cooldownHours, TRIGGER_MAX_COOLDOWN_HOURS)
      : undefined;
  return {
    metric: metric as TriggerMetric,
    op,
    value: v,
    ...(cooldown !== undefined ? { cooldownHours: cooldown } : {}),
  };
}

/** The metrics a trigger can read. Null per family = that read failed. */
export interface WatchTriggerMetrics {
  /** Human clicks in the 30-day window (row-capped — a floor past it). */
  recentClicks: number | null;
  /** All-time clicks from the counter. */
  totalClicks: number | null;
  optins: number | null;
  purchases: number | null;
  revenueCents: number | null;
}

export interface TriggerVerdict {
  tripped: boolean;
  /** The observed value (null when the read failed). */
  observed: number | null;
  /** One clause, either way — the digest log and the UI both print it. */
  reason: string;
}

/**
 * Evaluate one trigger against the metrics. THE SPENDING RULE: an unknown
 * (null) observation NEVER trips — a failed rollup firing a paid run is
 * the expensive direction of wrong, so the answer for "we couldn't read
 * it" is silence, and the reason says so.
 */
export function evaluateWatchTrigger(
  trigger: WatchTrigger,
  metrics: WatchTriggerMetrics,
): TriggerVerdict {
  const observed = metrics[trigger.metric] ?? null;
  if (observed === null || !Number.isFinite(observed)) {
    return {
      tripped: false,
      observed: null,
      reason: `${trigger.metric} is unknown right now — a trigger never fires on a failed read`,
    };
  }
  const tripped =
    trigger.op === 'lt' ? observed < trigger.value : observed >= trigger.value;
  const bound = trigger.op === 'lt' ? 'below' : 'at or past';
  return {
    tripped,
    observed,
    reason: tripped
      ? `${trigger.metric} is ${observed} — ${bound} ${trigger.value}`
      : `${trigger.metric} is ${observed} (fires ${bound} ${trigger.value})`,
  };
}

/** Is this watch's trigger inside its cooldown window? */
export function isTriggerCoolingDown(
  w: Pick<ResearchWatchlist, 'lastTriggeredAt' | 'trigger'>,
  now = Date.now(),
): boolean {
  if (!w.lastTriggeredAt) return false;
  const t = new Date(w.lastTriggeredAt).getTime();
  if (!Number.isFinite(t)) return false;
  const hours = w.trigger?.cooldownHours ?? TRIGGER_DEFAULT_COOLDOWN_HOURS;
  return now - t < hours * 3_600_000;
}

/**
 * Read the trigger metrics: the click rollups (counter + 30d window) and
 * the attribution totals (leads/sales/revenue), each family nulling
 * independently on failure — the evaluator turns each null into silence.
 */
export async function readWatchTriggerMetrics(): Promise<WatchTriggerMetrics> {
  const [rollups, attribution] = await Promise.all([
    getClickRollupsSafe(),
    getPieceAttributionSafe(),
  ]);
  const totals = attribution ? sumPieceAttribution(attribution) : null;
  return {
    recentClicks: rollups ? rollups.recentClicks : null,
    totalClicks: rollups ? rollups.totalClicks : null,
    optins: totals ? totals.optins : null,
    purchases: totals ? totals.purchases : null,
    revenueCents: totals ? totals.revenueCents : null,
  };
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

/** Add a watch (idempotent per session+recipe: re-adding reactivates).
 *  `trigger` sets the metric threshold when given — null CLEARS it. */
export async function upsertWatchlist(input: {
  sessionId: string;
  recipeSlug?: string;
  trigger?: WatchTrigger | null;
}): Promise<ResearchWatchlist> {
  const slug = (input.recipeSlug || '').trim() || 'niche-watch';
  const triggerRow =
    input.trigger !== undefined
      ? { metric_trigger: input.trigger ?? null }
      : {};
  // One watch per session+recipe: update in place when it exists.
  const { data: existing } = await (serviceClient() as any)
    .from(TABLE)
    .select('id')
    .eq('session_id', input.sessionId)
    .eq('recipe_slug', slug)
    .maybeSingle();
  if (existing) {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .update({ status: 'active', ...triggerRow })
      .eq('id', existing.id)
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return rowToWatchlist(data as WatchlistRow);
  }
  const { data, error } = await (serviceClient() as any)
    .from(TABLE)
    .insert({ session_id: input.sessionId, recipe_slug: slug, ...triggerRow })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return rowToWatchlist(data as WatchlistRow);
}

/** Admin read: all watchlists, newest first. [] on failure. */
export async function listWatchlists(): Promise<ResearchWatchlist[]> {
  try {
    const { data, error } = await (serviceClient() as any)
      .from(TABLE)
      .select(COLUMNS)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return (data as WatchlistRow[]).map(rowToWatchlist);
  } catch {
    return [];
  }
}

/** Admin read: the DUE watchlists (active + never run or stale). */
export async function listDueWatchlists(): Promise<ResearchWatchlist[]> {
  const all = await listWatchlists();
  return all.filter((w) => isWatchlistDue(w));
}

/** Stamp a successful queue (or pause/unpause, or a trigger fire). */
export async function updateWatchlist(
  id: string,
  patch: Partial<{
    lastRunAt: string;
    status: 'active' | 'paused';
    lastTriggeredAt: string;
    trigger: WatchTrigger | null;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.lastRunAt !== undefined) row.last_run_at = patch.lastRunAt;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.lastTriggeredAt !== undefined)
    row.last_triggered_at = patch.lastTriggeredAt;
  if (patch.trigger !== undefined) row.metric_trigger = patch.trigger ?? null;
  const { error } = await (serviceClient() as any)
    .from(TABLE)
    .update(row)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Remove a watch. */
export async function deleteWatchlist(id: string): Promise<void> {
  const { error } = await (serviceClient() as any)
    .from(TABLE)
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
